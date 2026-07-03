/**
 * ITE-as-signal meta-discovery CLI.
 *
 * Reads Internal Tech Emails' public RSS as a LEAD (which court filings just
 * surfaced exec correspondence), maps each post's cited case to our watchlist,
 * and finds the PRIMARY court document via RECAP so we can ingest it ourselves.
 * We never ingest ITE's own text — only the underlying public-record filing.
 *
 *   npm run ite-signal                 # report leads → matched cases → primary-doc candidates
 *   npm run ite-signal -- --ingest     # also run the pipeline on discovered primary docs
 *   npm run ite-signal -- --limit=10
 */
import "dotenv/config";
import { runIteSignal } from "@/lib/ingest/ite-signal";
import { runPipeline } from "@/lib/ingest/pipeline";
import type { DiscoveredDocument } from "@/lib/ingest/discovery";

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

async function main() {
  const argv = process.argv.slice(2);
  const ingest = argv.includes("--ingest");
  const limit = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "15", 10);

  console.log("\n=== The Leadership Letter · ITE-as-Signal ===");
  console.log("Using techemails.com RSS as a discovery LEAD only — we fetch the primary court doc ourselves.\n");
  if (!process.env.COURTLISTENER_API_TOKEN) {
    console.log("Note: no COURTLISTENER_API_TOKEN — anonymous RECAP rate limit (fewer results).\n");
  }

  const { results, uncovered } = await runIteSignal({ limit });

  const allCandidates: DiscoveredDocument[] = [];
  for (const r of results) {
    const tag = r.matchedCaseId ? `→ ${r.matchedCaseId} · ${r.candidates.length} primary-doc candidate(s)` : (r.lead.citedCase ? "→ (case not watched)" : "→ (no case cited)");
    console.log(`• ${pad(r.lead.title, 46)} ${pad(r.lead.citedCase ?? "—", 34)} ${tag}`);
    allCandidates.push(...r.candidates);
  }

  if (uncovered.length) {
    console.log(`\n=== ${uncovered.length} cited case(s) NOT in the watchlist — candidates to add ===`);
    for (const u of uncovered) console.log(`  ✗ ${pad(u.citedCase, 40)}  (e.g. "${u.title}")`);
  }

  console.log(`\n=== ${allCandidates.length} primary-doc candidate(s) discovered via RECAP ===`);
  for (const d of allCandidates) console.log(`   [${String(d.cl.signalScore).padStart(2)}] ${pad(d.id, 40)} ${pad(d.documentTitle, 50)}`);

  if (ingest && allCandidates.length) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("\n--ingest requires ANTHROPIC_API_KEY.");
      process.exit(1);
    }
    console.log(`\n=== Ingesting ${allCandidates.length} primary docs (pipeline gate is the arbiter) ===`);
    const res = await runPipeline({ sources: allCandidates });
    const ok = res.filter((r) => r.ok).length;
    console.log(`\nIngested ${ok}/${res.length}.`);
  } else if (allCandidates.length) {
    console.log("\n(dry — pass --ingest to run these through the pipeline)");
  }
}

main().catch((e) => {
  console.error("ite-signal crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
