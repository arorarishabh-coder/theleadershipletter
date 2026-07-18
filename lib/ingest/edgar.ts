/**
 * SEC EDGAR discovery — the indefinite daily-flow source.
 *
 * Unlike litigation exhibits (lumpy, tied to trial cycles), EDGAR is a continuous
 * firehose of public-domain filings. The high-signal material for this product is
 * CEO/Chair shareholder letters and strategy memos filed as 8-K Exhibit 99.1 (the
 * Buffett / Bezos / Dimon genre). We surface them via EDGAR full-text search for
 * letter-opening phrases, then feed the exhibit document through the normal
 * pipeline (gate → lesson → screenshot). The gate filters the boilerplate
 * "financial highlights" exhibits from the substantive letters.
 *
 * SEC fair-access: declare a contact User-Agent; stay under 10 req/s.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DiscoveredDocument } from "./discovery";

const EFTS = "https://efts.sec.gov/LATEST/search-index";
const ARCHIVE = "https://www.sec.gov/Archives/edgar/data";
const UA = "The Leadership Letter research@corporateletters.example.com";

// Letter-opening phrases that reliably mark a CEO/Chair letter to shareholders.
const DEFAULT_QUERIES = [
  '"dear fellow shareholders"',
  '"to our shareholders"',
  '"dear shareholders"',
  '"letter to shareholders"',
  '"dear fellow stockholders"',
  '"to our stockholders"',
];

// Marquee letter-writers — companies known for substantive shareholder letters
// filed on EDGAR (vs. earnings-PR boilerplate). Scoping to their CIKs yields a
// near-100% gate pass rate, unlike the blind full-text firehose (~25%).
const MARQUEE_WRITERS: Array<{ name: string; cik: string; leaderSlugs: string[] }> = [
  { name: "Netflix", cik: "0001065280", leaderSlugs: [] },
  { name: "Amazon", cik: "0001018724", leaderSlugs: ["jeff-bezos"] },
  { name: "Coinbase", cik: "0001679788", leaderSlugs: [] },
  { name: "JPMorgan Chase", cik: "0000019617", leaderSlugs: [] },
  { name: "Berkshire Hathaway", cik: "0001067983", leaderSlugs: [] },
  // Added 2026-06-25 — each verified via EDGAR full-text to actually file
  // shareholder/founder LETTERS as 8-K EX-99.1 (letter-opening phrase hit counts
  // in parens). leaderSlugs left empty until each CEO is added to lib/taxonomy
  // PERSONS (else the post is browse-orphaned — see the taxonomy gotcha).
  { name: "Pinterest", cik: "0001506293", leaderSlugs: [] }, // 47
  { name: "Block", cik: "0001512673", leaderSlugs: [] }, // 42 — Square/Block letters
  { name: "DoorDash", cik: "0001792789", leaderSlugs: [] }, // 30
  { name: "Snap", cik: "0001564408", leaderSlugs: [] }, // 8
  { name: "Palantir", cik: "0001321655", leaderSlugs: [] }, // 7 — Karp quarterly letters
  { name: "Roku", cik: "0001428439", leaderSlugs: [] }, // 6
];

// Self-expanding registry: scripts/scout.ts proposes + validates new letter-writers
// and appends them here as JSON, so the marquee set grows over time WITHOUT editing
// source. Merged with the static list (dedup by CIK) at discovery time.
export interface MarqueeWriter {
  name: string;
  cik: string;
  leaderSlugs: string[];
}
const DISCOVERED_WRITERS_PATH = path.join(process.cwd(), "content", "discovered", "marquee-writers.json");

const normCik = (cik: string) => String(cik).replace(/^0+/, "");

/** Static marquee writers ∪ scout-discovered writers (deduped by CIK). */
export async function loadMarqueeWriters(): Promise<MarqueeWriter[]> {
  const merged: MarqueeWriter[] = [...MARQUEE_WRITERS];
  const seen = new Set(merged.map((w) => normCik(w.cik)));
  try {
    const raw = await fs.readFile(DISCOVERED_WRITERS_PATH, "utf8");
    const discovered = JSON.parse(raw) as Array<Partial<MarqueeWriter>>;
    for (const w of discovered) {
      if (!w.cik || !w.name) continue;
      const k = normCik(w.cik);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push({ name: w.name, cik: w.cik, leaderSlugs: w.leaderSlugs ?? [] });
    }
  } catch {
    // No registry yet — static list only.
  }
  return merged;
}

export interface EdgarHit {
  accession: string; // e.g. 0001077183-21-000106
  filename: string; // e.g. exhibit991-2020annualrep.htm
  cik: string; // no leading zeros
  company: string; // cleaned display name
  form: string; // e.g. EX-99.1
  date: string; // ISO
  description: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cleanCompany(displayName: string): string {
  // "NEOGENOMICS INC  (NEO)  (CIK 0001077183)" → "NEOGENOMICS INC"
  return displayName.replace(/\s*\(.*$/, "").trim();
}

function cikFrom(displayName: string): string {
  const m = displayName.match(/CIK\s*(\d+)/i);
  return m ? String(Number(m[1])) : ""; // strip leading zeros
}

/** One EDGAR full-text search query → hits. Optionally scoped to one or more CIKs. */
export async function searchEdgar(
  query: string,
  opts: { forms?: string; since?: string; limit?: number; ciks?: string } = {},
): Promise<EdgarHit[]> {
  const forms = opts.forms ?? "8-K";
  const limit = opts.limit ?? 20;
  const hits: EdgarHit[] = [];
  let from = 0;
  let pages = 0;
  while (hits.length < limit && pages < 5) {
    const qs = new URLSearchParams({ q: query, forms });
    if (opts.ciks) qs.set("ciks", opts.ciks);
    if (opts.since) {
      qs.set("startdt", opts.since);
      qs.set("enddt", new Date().toISOString().slice(0, 10));
    }
    if (from) qs.set("from", String(from));
    const res = await fetch(`${EFTS}?${qs.toString()}`, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const json = (await res.json()) as { hits?: { hits?: Array<{ _id: string; _source: Record<string, unknown> }> } };
    const rows = json.hits?.hits ?? [];
    if (rows.length === 0) break;
    for (const h of rows) {
      const [accession, filename] = h._id.split(":");
      const display = ((h._source.display_names as string[]) ?? [])[0] ?? "";
      hits.push({
        accession,
        filename: filename ?? "",
        cik: cikFrom(display),
        company: cleanCompany(display),
        form: (h._source.file_type as string) || (h._source.root_form as string) || "",
        date: (h._source.file_date as string) || "",
        description: (h._source.file_description as string) || "",
      });
    }
    from += rows.length;
    pages += 1;
    await sleep(250); // SEC fair-access
  }
  return hits.slice(0, limit);
}

function docUrl(h: EdgarHit): string {
  return `${ARCHIVE}/${h.cik}/${h.accession.replace(/-/g, "")}/${h.filename}`;
}

/**
 * EDGAR full-text search sometimes matches the 8-K COVER page (the form body)
 * rather than the EX-99.1 letter exhibit. When the matched file isn't itself an
 * exhibit, look up the filing's index.json and point at the real EX-99.1.
 */
async function resolveFetchUrl(h: EdgarHit): Promise<string> {
  if (/^ex[-.]?99/i.test(h.form)) return docUrl(h); // already an exhibit
  const base = `${ARCHIVE}/${h.cik}/${h.accession.replace(/-/g, "")}`;
  try {
    const res = await fetch(`${base}/index.json`, { headers: { "User-Agent": UA } });
    if (!res.ok) return docUrl(h);
    // index.json's `type` field is only an icon hint, not the SEC doc type — match
    // on the document FILENAME, which conventionally encodes EX-99.1.
    const json = (await res.json()) as { directory?: { item?: Array<{ name?: string }> } };
    const names = (json.directory?.item ?? [])
      .map((i) => i.name || "")
      .filter((n) => /\.(html?|txt)$/i.test(n) && !/-?index|index-?headers/i.test(n));
    const pick =
      names.find((n) => /(ex|dex)[-_.]?99[-_.]?1|exhibit[-_.]?99[-_.]?1|ex99d1/i.test(n)) ||
      names.find((n) => /(ex|dex)[-_.]?99|exhibit[-_.]?99/i.test(n));
    return pick ? `${base}/${pick}` : docUrl(h);
  } catch {
    return docUrl(h);
  }
}

function filingIndexUrl(h: EdgarHit): string {
  return `${ARCHIVE}/${h.cik}/${h.accession.replace(/-/g, "")}/`;
}

function toDiscovered(h: EdgarHit): DiscoveredDocument {
  return {
    id: `edgar-${h.accession.replace(/-/g, "")}`,
    url: filingIndexUrl(h),
    fetchUrl: docUrl(h),
    documentTitle: `${h.company} — ${h.form} (${h.date})`,
    knownAuthors: [],
    knownLeaderSlugs: [], // pipeline derives from PERSONS match on content
    knownCompany: h.company, // gate's estimatedCompany usually refines this
    recipientNames: ["Shareholders"],
    dateAuthored: h.date,
    sourceType: "sec_edgar",
    sourceCase: `SEC EDGAR · ${h.form}`,
    sourceCitation: `${h.company} · ${h.form} · filed ${h.date} · Accession ${h.accession}`,
    licensingPath: "public_domain",
    hintedTopics: [],
    cl: {
      docketId: 0,
      documentId: 0,
      pacerDocId: null,
      pageCount: null,
      filepathLocal: "",
      docketUrl: filingIndexUrl(h),
      signalScore: 0,
      filingDescription: h.description || h.form,
      snippetPreview: `${h.company} ${h.form} ${h.date}`,
    },
  };
}

export interface EdgarDiscovery {
  hits: number;
  documents: DiscoveredDocument[];
}

export async function discoverFromEdgar(
  opts: { queries?: string[]; forms?: string; since?: string; perQuery?: number; limit?: number } = {},
): Promise<EdgarDiscovery> {
  const queries = opts.queries ?? DEFAULT_QUERIES;
  const perQuery = opts.perQuery ?? 8;
  const limit = opts.limit ?? 30;

  const seen = new Set<string>();
  const documents: DiscoveredDocument[] = [];
  let totalHits = 0;

  for (const q of queries) {
    if (documents.length >= limit) break;
    const hits = await searchEdgar(q, { forms: opts.forms, since: opts.since, limit: perQuery });
    totalHits += hits.length;
    for (const h of hits) {
      if (!h.filename || !h.cik) continue;
      const key = `${h.accession}:${h.filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const doc = toDiscovered(h);
      doc.fetchUrl = await resolveFetchUrl(h);
      // Blind full-text sweep of every 8-K filer — high yield of obscure small-caps.
      // Tagged so the pipeline quarantines these from the auto-send queue (review-only).
      doc.discoveryLane = "firehose";
      documents.push(doc);
      if (documents.length >= limit) break;
    }
  }
  return { hits: totalHits, documents };
}

/** Marquee mode: pull recent substantive letters from known great letter-writers. */
export async function discoverFromEdgarMarquee(
  opts: { perCompany?: number; limit?: number; queries?: string[] } = {},
): Promise<EdgarDiscovery> {
  const perCompany = opts.perCompany ?? 3;
  const limit = opts.limit ?? 30;
  const queries = opts.queries ?? DEFAULT_QUERIES;

  const seen = new Set<string>();
  const documents: DiscoveredDocument[] = [];
  let totalHits = 0;

  const writers = await loadMarqueeWriters();
  for (const w of writers) {
    if (documents.length >= limit) break;
    const collected: EdgarHit[] = [];
    const seenInCo = new Set<string>();
    for (const q of queries) {
      const hits = await searchEdgar(q, { forms: "8-K", ciks: w.cik, limit: 5 });
      totalHits += hits.length;
      for (const h of hits) {
        const k = `${h.accession}:${h.filename}`;
        if (!seenInCo.has(k)) {
          seenInCo.add(k);
          collected.push(h);
        }
      }
    }
    // Most recent letters first.
    collected.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const h of collected.slice(0, perCompany)) {
      if (!h.filename || !h.cik) continue;
      const key = `${h.accession}:${h.filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const doc = toDiscovered(h);
      doc.fetchUrl = await resolveFetchUrl(h);
      doc.knownCompany = w.name; // clean name (gate's estimatedCompany still refines)
      doc.knownLeaderSlugs = w.leaderSlugs;
      doc.discoveryLane = "marquee"; // scoped to known great writers — trusted for auto-send
      documents.push(doc);
      if (documents.length >= limit) break;
    }
  }
  return { hits: totalHits, documents };
}
