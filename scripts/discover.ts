/**
 * RECAP discovery CLI.
 *
 * Finds internal-correspondence exhibits across the federal-case watchlist via
 * the CourtListener RECAP API, scores them by email signal, and writes a
 * reviewable candidate file. Optionally pipes candidates straight into the
 * ingest pipeline.
 *
 * Usage:
 *   npm run discover                              # all watchlist cases → candidate file
 *   npm run discover -- --case=ftc-v-meta         # one case
 *   npm run discover -- --case=epic-v-apple --limit=5
 *   npm run discover -- --since=2025-01-01        # only entries filed since a date
 *   npm run discover -- --query='"From:" "Instagram"'   # custom full-text query
 *   npm run discover -- --case=ftc-v-meta --ingest-dry  # discover → pipeline dry-run (fetch+extract, no Claude)
 *   npm run discover -- --case=ftc-v-meta --ingest      # discover → full pipeline (needs ANTHROPIC_API_KEY)
 *   npm run discover -- --from-edgar --marquee --ingest --force  # regenerate even posts that already exist
 *
 * By default ingest SKIPS any candidate whose post already exists on disk (slug ===
 * source.id), so re-runs only add net-new content. Pass --force to regenerate.
 *
 * COURTLISTENER_API_TOKEN (optional) raises the rate limit. ANTHROPIC_API_KEY is
 * only required for --ingest.
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { discoverFromWatchlist, type DiscoveredDocument } from "@/lib/ingest/discovery";
import { discoverFromIndex } from "@/lib/ingest/exhibit-index";
import { discoverFromDoj } from "@/lib/ingest/doj-exhibits";
import { discoverFromEdgar, discoverFromEdgarMarquee } from "@/lib/ingest/edgar";
import { WATCHED_CASES } from "@/lib/ingest/watchlist";
import { runPipeline } from "@/lib/ingest/pipeline";

interface Args {
  caseIds?: string[];
  query?: string;
  limit?: number;
  since?: string;
  minPages?: number;
  maxPages?: number;
  out?: string;
  ingest: boolean;
  ingestDry: boolean;
  screen: boolean;
  force: boolean;
  fromIndex: boolean;
  fromDoj: boolean;
  fromEdgar: boolean;
  marquee: boolean;
  noResolve: boolean;
  minThemeFit?: number;
  minLessonClarity?: number;
  json: boolean;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const val = (k: string) => {
    const m = a.find((x) => x.startsWith(`--${k}=`));
    return m ? m.split("=").slice(1).join("=") : undefined;
  };
  const caseRaw = val("case");
  const num = (k: string) => {
    const v = val(k);
    return v != null ? parseInt(v, 10) : undefined;
  };
  return {
    caseIds: caseRaw ? caseRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    query: val("query"),
    limit: num("limit"),
    since: val("since"),
    minPages: num("min-pages"),
    maxPages: num("max-pages"),
    out: val("out"),
    ingest: a.includes("--ingest"),
    ingestDry: a.includes("--ingest-dry"),
    screen: a.includes("--screen"),
    force: a.includes("--force"),
    fromIndex: a.includes("--from-index"),
    fromDoj: a.includes("--from-doj"),
    fromEdgar: a.includes("--from-edgar"),
    marquee: a.includes("--marquee"),
    noResolve: a.includes("--no-resolve"),
    minThemeFit: num("min-theme-fit"),
    minLessonClarity: num("min-lesson-clarity"),
    json: a.includes("--json"),
  };
}

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

async function runFromIndex(args: Args) {
  const cases = args.caseIds?.length
    ? WATCHED_CASES.filter((c) => args.caseIds!.includes(c.id))
    : WATCHED_CASES.filter((c) => c.system === "recap");

  console.log("\n=== The Leadership Letter · Index-Driven Discovery ===");
  const allResolved: DiscoveredDocument[] = [];

  for (const c of cases) {
    console.log(`\n── ${c.caseName} ──`);
    const result = await discoverFromIndex(c, { limit: args.limit ?? 25, resolve: !args.noResolve });
    if (!result.indexDocId) {
      console.log("  No usable exhibit list/index found on this docket.");
      continue;
    }
    console.log(
      `  Index: doc ${result.indexDocId} (${result.indexPages}pp) · parsed ${result.totalEntries} entries · selected ${result.selected.length} instructive · resolved ${result.resolved.length} on RECAP`,
    );
    if (result.selected.length) {
      console.log(`\n  Top instructive entries (by description):`);
      for (const e of result.selected.slice(0, 15)) {
        const resolved = result.resolved.some((d) => d.id.endsWith(e.exhibitNo.toLowerCase()));
        console.log(`   [${String(e.score).padStart(2)}] ${resolved ? "✓" : "·"} ${pad(e.exhibitNo, 9)} ${e.date ?? "          "} ${e.description.slice(0, 92)}`);
      }
    }
    allResolved.push(...result.resolved);

    // Write the full catalog for review
    const dir = path.join(process.cwd(), "content", "discovered");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `index-${c.id}.json`), JSON.stringify(result, null, 2), "utf8");
  }

  console.log(`\n=== ${allResolved.length} exhibits resolved to fetchable docs across ${cases.length} case(s) ===`);

  if ((args.ingest || args.ingestDry || args.screen) && allResolved.length) {
    if (!args.ingestDry && !process.env.ANTHROPIC_API_KEY) {
      console.error("\n--ingest/--screen requires ANTHROPIC_API_KEY.\n");
      process.exit(1);
    }
    console.log(`\n=== Feeding ${allResolved.length} resolved exhibits into pipeline ===`);
    const results = await runPipeline({
      sources: allResolved,
      dryRun: args.ingestDry,
      gateOnly: args.screen,
      minThemeFit: args.minThemeFit,
      minLessonClarity: args.minLessonClarity,
      forceRefresh: args.force,
    });
    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed === 0 ? 0 : 2);
  }
}

async function runFromEdgar(args: Args) {
  console.log(`\n=== The Leadership Letter · SEC EDGAR Discovery${args.marquee ? " · MARQUEE letter-writers" : " (daily-flow firehose)"} ===`);
  if (args.since) console.log(`Filed since: ${args.since}`);
  const result = args.marquee
    ? await discoverFromEdgarMarquee({ limit: args.limit ?? 30 })
    : await discoverFromEdgar({
        queries: args.query ? [args.query] : undefined,
        since: args.since,
        limit: args.limit ?? 30,
      });
  console.log(`Full-text hits: ${result.hits} · candidate letters: ${result.documents.length}\n`);
  for (const d of result.documents.slice(0, 20)) {
    console.log(`  ${pad(d.knownCompany, 34)} ${d.dateAuthored || "          "} ${d.sourceCase}`);
  }

  if (args.ingest || args.ingestDry || args.screen) {
    if (!result.documents.length) {
      console.log("\nNothing to ingest.");
      process.exit(0);
    }
    if (!args.ingestDry && !process.env.ANTHROPIC_API_KEY) {
      console.error("\n--ingest/--screen requires ANTHROPIC_API_KEY.\n");
      process.exit(1);
    }
    console.log(`\n=== Feeding ${result.documents.length} EDGAR filings into pipeline ===`);
    const results = await runPipeline({
      sources: result.documents,
      dryRun: args.ingestDry,
      gateOnly: args.screen,
      minThemeFit: args.minThemeFit,
      minLessonClarity: args.minLessonClarity,
      forceRefresh: args.force,
    });
    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed === 0 ? 0 : 2);
  }
}

async function runFromDoj(args: Args) {
  const cases = (args.caseIds?.length
    ? WATCHED_CASES.filter((c) => args.caseIds!.includes(c.id))
    : WATCHED_CASES
  ).filter((c) => c.exhibitArchiveUrls?.length);

  console.log("\n=== The Leadership Letter · DOJ Archive Discovery (off-RECAP) ===");
  if (!cases.length) {
    console.log("No watchlist cases have exhibitArchiveUrls configured.");
    return;
  }
  const allResolved: DiscoveredDocument[] = [];

  for (const c of cases) {
    console.log(`\n── ${c.caseName} ──`);
    const result = await discoverFromDoj(c, args.limit ?? 25);
    console.log(`  DOJ archive: parsed ${result.exhibits} exhibits · selected ${result.selected.length} instructive (each has a fetchable PDF)`);
    for (const e of result.selected.slice(0, 15)) {
      console.log(`   [${String(e.score).padStart(2)}] ${pad(e.exhibitNo, 9)} ${e.date ?? "          "} ${e.description.slice(0, 92)}`);
    }
    allResolved.push(...result.resolved);
  }

  console.log(`\n=== ${allResolved.length} exhibits resolved to fetchable PDFs ===`);

  if (args.ingest || args.ingestDry || args.screen) {
    if (!allResolved.length) {
      console.log("Nothing to ingest.");
      process.exit(0);
    }
    if (!args.ingestDry && !process.env.ANTHROPIC_API_KEY) {
      console.error("\n--ingest/--screen requires ANTHROPIC_API_KEY.\n");
      process.exit(1);
    }
    console.log(`\n=== Feeding ${allResolved.length} DOJ exhibits into pipeline ===`);
    const results = await runPipeline({
      sources: allResolved,
      dryRun: args.ingestDry,
      gateOnly: args.screen,
      minThemeFit: args.minThemeFit,
      minLessonClarity: args.minLessonClarity,
      forceRefresh: args.force,
    });
    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed === 0 ? 0 : 2);
  }
}

async function main() {
  const args = parseArgs();

  // ---- Index-driven discovery: parse the trial exhibit list, select instructive
  // internal correspondence by description, best-effort resolve to fetchable docs. ----
  if (args.fromEdgar) {
    await runFromEdgar(args);
    return;
  }
  if (args.fromDoj) {
    await runFromDoj(args);
    return;
  }
  if (args.fromIndex) {
    await runFromIndex(args);
    return;
  }

  console.log("\n=== The Leadership Letter · RECAP Discovery ===");
  console.log(`Watchlist scope: ${args.caseIds?.join(", ") ?? "all cases"}`);
  console.log(`Query: ${args.query ?? "(per-case targeted query from watchlist internalSignals)"}`);
  if (args.since) console.log(`Filed since: ${args.since}`);
  if (!process.env.COURTLISTENER_API_TOKEN) {
    console.log("Note: no COURTLISTENER_API_TOKEN set — using anonymous (lower) rate limit.\n");
  } else {
    console.log("");
  }

  const report = await discoverFromWatchlist({
    caseIds: args.caseIds,
    query: args.query,
    perCaseLimit: args.limit,
    since: args.since,
    minPages: args.minPages,
    maxPages: args.maxPages,
  });

  // Per-case summary
  console.log("Per-case results:");
  for (const c of report.perCase) {
    const status = c.error ? `ERROR: ${c.error}` : `fetched ${c.fetched}, kept ${c.kept}`;
    console.log(`  ${pad(c.caseId, 26)} ${status}`);
  }
  for (const s of report.skipped) {
    console.log(`  ${pad(s.caseId, 26)} skipped — ${s.reason}`);
  }

  // Candidate table
  console.log(`\nTotal candidates: ${report.documents.length}`);
  if (report.documents.length) {
    console.log(`\n  ${pad("score", 6)}${pad("pages", 6)}${pad("id", 38)}title`);
    console.log("  " + "-".repeat(90));
    for (const d of report.documents) {
      console.log(
        `  ${pad(String(d.cl.signalScore), 6)}${pad(String(d.cl.pageCount ?? "?"), 6)}${pad(d.id, 38)}${pad(d.documentTitle, 50)}`,
      );
    }
  }

  if (args.json) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(report.documents, null, 2));
  }

  // Write candidate file
  const dir = path.join(process.cwd(), "content", "discovered");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const outPath = args.out ?? path.join(dir, `discovered-${stamp}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nCandidates written to: ${outPath}`);

  // Screen-only: cheap relevance-gate pass (fetch → OCR → gate), no enrich/lesson.
  if (args.screen) {
    if (!report.documents.length) {
      console.log("\nNothing to screen.");
      process.exit(0);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("\n--screen requires ANTHROPIC_API_KEY (it runs the Haiku relevance gate).\n");
      process.exit(1);
    }
    console.log(`\n=== Screening ${report.documents.length} candidates through the relevance gate ===`);
    const results = await runPipeline({
      sources: report.documents,
      gateOnly: true,
      minThemeFit: args.minThemeFit,
      minLessonClarity: args.minLessonClarity,
      forceRefresh: args.force,
    });
    const passed = results.filter((r) => r.ok);
    console.log(`\n=== Screen result: ${passed.length}/${results.length} passed the gate ===`);
    if (passed.length) {
      console.log("Passed (worth a lesson):");
      passed.forEach((r) => console.log(`  ✓ ${r.sourceId}`));
    }
    process.exit(0);
  }

  // Optional pipeline run
  if (args.ingest || args.ingestDry) {
    if (!report.documents.length) {
      console.log("\nNothing to ingest.");
      process.exit(0);
    }
    if (args.ingest && !process.env.ANTHROPIC_API_KEY) {
      console.error("\n--ingest requires ANTHROPIC_API_KEY. Use --ingest-dry to fetch+extract without Claude.\n");
      process.exit(1);
    }
    console.log(`\n=== Feeding ${report.documents.length} candidates into pipeline (${args.ingestDry ? "DRY RUN" : "LIVE"}) ===`);
    const sources: DiscoveredDocument[] = report.documents;
    const results = await runPipeline({
      sources,
      dryRun: args.ingestDry,
      minThemeFit: args.minThemeFit,
      minLessonClarity: args.minLessonClarity,
      forceRefresh: args.force,
    });
    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed === 0 ? 0 : 2);
  }
}

main().catch((e) => {
  console.error("Discovery crashed:", e);
  process.exit(1);
});
