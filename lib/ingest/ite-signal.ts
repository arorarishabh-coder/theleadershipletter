/**
 * ITE-as-signal meta-discovery.
 *
 * Internal Tech Emails (techemails.com) is effectively a hand-curated feed of
 * which court filings just surfaced exec correspondence. We use it as a LEAD,
 * never as a source: read their public Substack RSS, read the source CASE each
 * post cites, then go fetch the PRIMARY court document OURSELVES via RECAP and
 * run it through our pipeline. We never ingest, transcribe, or republish ITE's
 * own text/layout — only the underlying public-record filing.
 *
 * Every ITE post ends with an explicit citation like:
 *   "[This document is from Musk v. Altman (2026).]"
 * which we parse and map to our WATCHED_CASES.
 *
 *   npm run ite-signal                 # report leads → matched cases → primary-doc candidates
 *   npm run ite-signal -- --ingest     # also run the pipeline on the discovered primary docs
 *   npm run ite-signal -- --limit=10
 */

import { discoverFromWatchlist, type DiscoveredDocument } from "./discovery";
import { WATCHED_CASES } from "./watchlist";

const FEED_URL = "https://www.techemails.com/feed";
const USER_AGENT =
  "CorporateLettersResearchBot/0.1 (+research@corporateletters.example.com) editorial-signal";

export interface IteLead {
  title: string;
  link: string;
  date: string;
  /** The source case ITE cites, e.g. "Musk v. Altman". Null if none parsed. */
  citedCase: string | null;
  /** Distinctive proper-name/subject terms pulled from the title (for the RECAP query). */
  terms: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

// Pull the distinctive terms from a headline: quoted phrases + Capitalized runs
// (names like "Mark Zuckerberg", "Mira Murati"), minus generic filler words.
const STOP = new Set(["The", "A", "An", "On", "In", "Of", "And", "To", "Emails", "Email", "Texts", "Messages", "Message", "Begins"]);
function termsFromTitle(title: string): string[] {
  const quoted = [...title.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const names = [...title.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g)].map((m) => m[0]);
  const singles = [...title.matchAll(/\b([A-Z][a-z]{3,})\b/g)].map((m) => m[1]).filter((w) => !STOP.has(w));
  const all = [...quoted, ...names, ...singles];
  return Array.from(new Set(all)).slice(0, 4);
}

/** Fetch + parse the ITE Substack RSS into leads (most recent first). */
export async function fetchIteFeed(limit = 15): Promise<IteLead[]> {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml,application/xml,text/xml" } });
  if (!res.ok) throw new Error(`ITE feed ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const items = xml.split(/<item[>\s]/i).slice(1);
  const leads: IteLead[] = [];
  for (const raw of items.slice(0, limit)) {
    const block = "<item " + raw;
    const title = tag(block, "title");
    const link = tag(block, "link");
    const date = tag(block, "pubDate");
    const content = `${tag(block, "content:encoded")} ${tag(block, "description")}`;
    const cite = content.match(/This document is from\s+([^.[\]]+?)(?:\s*\(\d{4}\))?\s*[.\]]/i);
    const citedCase = cite ? cite[1].trim().replace(/\.$/, "") : null;
    if (title) leads.push({ title, link, date, citedCase, terms: termsFromTitle(title) });
  }
  return leads;
}

/** Normalize a case name for fuzzy matching (drop punctuation, corp suffixes, "v"/"vs"). */
function normCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|llc|corp|corporation|co|ltd|plc|l\.?l\.?c|the|et al)\b/g, "")
    .replace(/\bv(?:s|\.)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Match an ITE-cited case to a WATCHED_CASES entry by fuzzy name overlap. */
export function matchWatchedCase(citedCase: string | null): (typeof WATCHED_CASES)[number] | null {
  if (!citedCase) return null;
  const want = new Set(normCase(citedCase).split(" ").filter((w) => w.length > 2));
  if (!want.size) return null;
  let best: { c: (typeof WATCHED_CASES)[number]; score: number } | null = null;
  for (const c of WATCHED_CASES) {
    const have = new Set(normCase(c.caseName).split(" "));
    let hits = 0;
    for (const w of want) if (have.has(w)) hits++;
    const score = hits / want.size;
    if (score >= 0.5 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}

export interface IteSignalResult {
  lead: IteLead;
  matchedCaseId: string | null;
  /** Primary-doc candidates discovered via RECAP for this lead (empty if unmatched/none). */
  candidates: DiscoveredDocument[];
}

/**
 * Turn ITE leads into primary-document candidates: for each post whose cited case
 * we watch, run a RECAP search scoped to that docket, biased by the post's subject
 * terms, to locate the underlying filing. Never uses ITE's text as content.
 */
export async function runIteSignal(opts: { limit?: number; perCaseLimit?: number } = {}): Promise<{
  results: IteSignalResult[];
  uncovered: Array<{ citedCase: string; title: string }>;
}> {
  const leads = await fetchIteFeed(opts.limit ?? 15);
  const results: IteSignalResult[] = [];
  const uncovered: Array<{ citedCase: string; title: string }> = [];

  for (const lead of leads) {
    // Prefer the explicit "[This document is from X]" citation; fall back to the
    // title ONLY when it's case-shaped ("X v. Y", e.g. "Musk v. Altman begins")
    // to avoid loosely matching a company name in an unrelated title.
    const titleIsCaseLike = /\bv\.?\s/i.test(lead.title);
    const match = matchWatchedCase(lead.citedCase) ?? (titleIsCaseLike ? matchWatchedCase(lead.title) : null);
    if (!match) {
      if (lead.citedCase) uncovered.push({ citedCase: lead.citedCase, title: lead.title });
      results.push({ lead, matchedCaseId: null, candidates: [] });
      continue;
    }
    // Build a targeted query: the post's subject terms as an OR, biased to email
    // headers. Scoped to the matched docket (court+docket come from the case).
    const query = lead.terms.length ? `"From:" (${lead.terms.map((t) => `"${t}"`).join(" OR ")})` : undefined;
    const report = await discoverFromWatchlist({ caseIds: [match.id], query, perCaseLimit: opts.perCaseLimit ?? 5 });
    results.push({ lead, matchedCaseId: match.id, candidates: report.documents });
  }

  // De-dup uncovered by cited case
  const seen = new Set<string>();
  const uniqueUncovered = uncovered.filter((u) => (seen.has(u.citedCase) ? false : (seen.add(u.citedCase), true)));
  return { results, uncovered: uniqueUncovered };
}
