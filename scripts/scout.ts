/**
 * Source scout — self-expanding discovery.
 *
 * Asks Claude to propose US-listed companies known for substantive shareholder/
 * founder letters that we DON'T already cover, resolves each to an EDGAR CIK,
 * VALIDATES that the company actually files such letters (EDGAR full-text hits),
 * and appends the survivors to content/discovered/marquee-writers.json — which
 * lib/ingest/edgar.ts merges into the marquee set. Run periodically (e.g. weekly,
 * before the content run) to keep the source list growing without manual curation.
 *
 * Validation is the point: Claude proposes, EDGAR is the arbiter — a name only
 * lands in the registry if it resolves to a real CIK AND has letter-phrase 8-K
 * filings, so we never add a dead source.
 *
 * Usage:
 *   npm run scout                 # propose + validate + append (default 15)
 *   npm run scout -- --limit=25
 *   npm run scout -- --dry-run    # propose + validate, print, do NOT append
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { claude, MODELS } from "@/lib/anthropic";
import { loadMarqueeWriters, searchEdgar, type MarqueeWriter } from "@/lib/ingest/edgar";

const UA = "The Leadership Letter research@corporateletters.example.com";
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const REGISTRY = path.join(process.cwd(), "content", "discovered", "marquee-writers.json");
const LETTER_PHRASES = [
  '"dear fellow shareholders"',
  '"to our shareholders"',
  '"dear shareholders"',
  '"letter to shareholders"',
  '"dear fellow stockholders"',
  '"to our stockholders"',
];

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 15;

const normCik = (cik: string) => String(cik).replace(/^0+/, "");

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}
interface Proposal {
  name: string;
  ticker: string;
  reason: string;
}

async function loadTickers(): Promise<TickerRow[]> {
  const res = await fetch(TICKERS_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`EDGAR tickers fetch failed: HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, TickerRow>;
  return Object.values(json);
}

function resolveCik(rows: TickerRow[], ticker?: string, name?: string): { cik: string; title: string } | null {
  if (ticker) {
    const t = ticker.toUpperCase().trim();
    const hit = rows.find((r) => r.ticker.toUpperCase() === t);
    if (hit) return { cik: String(hit.cik_str).padStart(10, "0"), title: hit.title };
  }
  if (name) {
    const n = name.toLowerCase().replace(/\b(inc|corp|corporation|company|co|holdings|group|ltd|plc|the)\b/g, "").replace(/[^a-z0-9]/g, " ").trim();
    const hit = rows.find((r) => {
      const title = r.title.toLowerCase();
      return n.length > 2 && title.includes(n.split(/\s+/)[0]) && title.includes(n.split(/\s+/).slice(-1)[0]);
    });
    if (hit) return { cik: String(hit.cik_str).padStart(10, "0"), title: hit.title };
  }
  return null;
}

async function lettersHitCount(cik: string): Promise<number> {
  let total = 0;
  for (const q of LETTER_PHRASES) {
    const hits = await searchEdgar(q, { forms: "8-K", ciks: cik, limit: 5 });
    total += hits.length;
    if (total >= 3) break; // enough signal; stop hammering EDGAR
  }
  return total;
}

async function propose(existing: string[], count: number): Promise<Proposal[]> {
  const prompt = `You curate sources for "The Leadership Letter", which republishes substantive CEO/founder SHAREHOLDER LETTERS (the Buffett / Bezos / Dimon genre) filed on SEC EDGAR as 8-K Exhibit 99.1, each paired with a leadership lesson.

We ALREADY cover these companies (do NOT repeat any): ${existing.join(", ")}.

Propose ${count} ADDITIONAL US-listed public companies (SEC filers) whose CEOs/founders are known for writing SUBSTANTIVE, candid annual or quarterly shareholder/founder letters with real strategic reasoning and decision-making — NOT boilerplate earnings PR. Favor founder-led technology, consumer, fintech, and finance companies with a documented letter-writing culture. Only US-domiciled filers (they file 8-K, not 6-K).

Return ONLY JSON, no prose:
{"companies":[{"name":"Company name","ticker":"NYSE/Nasdaq ticker","reason":"why their letters are substantive (1 short line)"}]}`;
  const res = await claude.messages.create({
    model: MODELS.enrich,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text : "";
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    return (JSON.parse(m[0]).companies ?? []) as Proposal[];
  } catch {
    return [];
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY required.");
    process.exit(1);
  }
  const existingWriters = await loadMarqueeWriters();
  const existingNames = existingWriters.map((w) => w.name);
  const existingCiks = new Set(existingWriters.map((w) => normCik(w.cik)));

  console.log(`\n=== The Leadership Letter · Source Scout ===`);
  console.log(`Already covered: ${existingNames.length} marquee writers`);
  const proposals = await propose(existingNames, limit);
  console.log(`Claude proposed ${proposals.length} candidates. Validating each against EDGAR...\n`);

  const tickers = await loadTickers();
  const validated: MarqueeWriter[] = [];
  for (const p of proposals) {
    const r = resolveCik(tickers, p.ticker, p.name);
    if (!r) {
      console.log(`  ✗ ${p.name} (${p.ticker || "?"}) — no EDGAR CIK match`);
      continue;
    }
    if (existingCiks.has(normCik(r.cik))) {
      console.log(`  · ${p.name} — already covered (CIK ${r.cik})`);
      continue;
    }
    const hits = await lettersHitCount(r.cik);
    if (hits < 1) {
      console.log(`  ✗ ${p.name} (CIK ${r.cik}) — 0 letter-phrase 8-K hits`);
      continue;
    }
    console.log(`  ✓ ${p.name} (CIK ${r.cik}) — ${hits}+ letter hits :: ${p.reason}`);
    validated.push({ name: p.name, cik: r.cik, leaderSlugs: [] });
    existingCiks.add(normCik(r.cik)); // avoid dupes within this run
  }

  console.log(`\n=== ${validated.length} new validated writer(s) ===`);
  if (!validated.length) return;
  if (dryRun) {
    console.log("(--dry-run — not appended to registry)");
    return;
  }

  let current: MarqueeWriter[] = [];
  try {
    current = JSON.parse(await fs.readFile(REGISTRY, "utf8")) as MarqueeWriter[];
  } catch {
    // first run — registry doesn't exist yet
  }
  const have = new Set(current.map((w) => normCik(w.cik)));
  const added = validated.filter((w) => !have.has(normCik(w.cik)));
  const next = [...current, ...added];
  await fs.mkdir(path.dirname(REGISTRY), { recursive: true });
  await fs.writeFile(REGISTRY, JSON.stringify(next, null, 2), "utf8");
  console.log(`Appended ${added.length} writer(s) → ${REGISTRY} (registry now holds ${next.length}).`);
  console.log(`They'll be picked up automatically on the next \`npm run discover -- --from-edgar --marquee\`.`);
}

main().catch((e) => {
  console.error("Scout crashed:", e);
  process.exit(1);
});
