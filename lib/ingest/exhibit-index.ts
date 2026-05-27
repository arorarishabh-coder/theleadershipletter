/**
 * Index-driven discovery.
 *
 * Trial exhibit lists/indexes (filed as court documents) catalog every admitted
 * exhibit with a human-readable description. The best of them (e.g. US v. Google
 * doc 887) describe internal documents richly — "Email from Lewis Denizen
 * (Google) to Andrew Moore (Google), Re: Permission to ramp up Google Shopping…
 * 2012.12.12". That description IS the curator's signal: author, recipient,
 * subject, date. This module parses that catalog and selects the instructive
 * internal correspondence — the way Internal Tech Emails picks winners — instead
 * of blind full-text guessing.
 *
 * Two realities from the data (2026-05-26):
 *  - Some indexes (FTC v. Meta's public index) list only PUBLIC source materials
 *    (articles, journals); internal-email descriptions are redacted. The selector
 *    correctly yields little there.
 *  - Where descriptions are rich (Google), the catalog is excellent — but the
 *    individual exhibit PDFs don't always resolve on RECAP (released elsewhere).
 *    So resolution is best-effort; the described catalog is itself the deliverable.
 */

import { searchRecapDocuments, siteUrl, storageUrl, type RecapDocResult } from "./courtlistener";
import { fetchDocument } from "./fetch";
import type { WatchedCase } from "./watchlist";
import type { DiscoveredDocument } from "./discovery";

// Lettered trial-exhibit numbers across formats: UPX0007/PX1102 (Google, no sep)
// and PX-0001 / "DX- 3641" (Epic — hyphenated, OCR-spaced). Optional space/hyphen.
const EXHIBIT_NO = /\b((?:U?PX|U?DX|D?TX|PTX|JTX|JX|GX|UPXD)\s*-?\s*\d{2,5}[A-Z]?)\b/gi;
// Numbered rows: "1 3/3/2015 Email from …" (Musk-style integer + date, no PX/DX).
const NUM_DATE_ROW = /\b(\d{1,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+/g;
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
const LONG_DATE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+(\d{1,2}),?\s+(\d{4})\b/i;
// Trailing court metadata that ends a description (Bates paren, sealing, volume).
const TRAIL = /\([A-Z0-9]{2,}\s*-\s*\d+|\b(?:PUBLIC|SEALED|CONFIDENTIAL|HIGHLY CONFIDENTIAL|REDACTED)\b|\bVol\.\s*\d+/;
// Leading Bates tokens, e.g. "GOOG-DOJ-00091432" or OCR'd "GOOG - DOJ - 00091432"
// (allow spaces around the hyphens). Several may precede the description.
const BATES = /^(?:\s*[A-Z][A-Z0-9]*(?:\s*[-_]\s*[A-Z0-9]+)+\s*)+/;
// A date like 2012.12.12 or 2019.06.07 (optional trailing *).
const DATE = /\b(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?\*?/;
const SEALING = /\b(PUBLIC|SEALED|CONFIDENTIAL|HIGHLY CONFIDENTIAL|PARTIALLY SEALED|REDACTED)\b/;

const INTERNAL = /\b(e-?mail|message|memo|memorandum|\bchat\b|text message|\bim\b|presentation|slide deck|\bdeck\b|note to|letter (from|to))\b/i;
const PUBLIC_SOURCE =
  /\b(article|blog post|\bblog\b|webpage|web page|video|press release|public document|journal article|working paper|\bbook\b|podcast|tweet|court filing|hearing transcript|earnings call|10-?[kq]\b|annual report|deposition|expert report|declaration|complaint)\b/i;

export interface IndexEntry {
  exhibitNo: string;
  description: string;
  date?: string; // ISO if parseable
  score: number; // instructiveness score (higher = better curation candidate)
}

export interface IndexDiscovery {
  indexDocId?: string;
  indexPages?: number;
  totalEntries: number;
  selected: IndexEntry[];
  resolved: DiscoveredDocument[];
  unresolved: IndexEntry[];
}

/** Find the richest exhibit list/index document on a docket. */
async function findExhibitList(court: string, docketNumber: string): Promise<RecapDocResult | null> {
  const results = await searchRecapDocuments({
    court,
    docketNumber,
    query: '"exhibit list" OR "exhibit index" OR "index of exhibits"',
    orderBy: "score desc",
    limit: 20,
  });
  const candidates = results
    .filter((r) => r.is_available && r.filepath_local && (r.page_count ?? 0) >= 10)
    .filter((r) => /exhibit (list|index)|index of (admitted )?exhibits/i.test(r.short_description || ""))
    // Prefer the largest — the most complete catalog.
    .sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0));
  return candidates[0] ?? null;
}

function toIso(m: RegExpMatchArray): string | undefined {
  const y = m[1];
  const mo = m[2]?.padStart(2, "0");
  const d = m[3]?.padStart(2, "0");
  if (!y) return undefined;
  return d ? `${y}-${mo}-${d}` : mo ? `${y}-${mo}-01` : `${y}-01-01`;
}

function mdyToIso(s: string): string | undefined {
  const m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!m) return undefined;
  let y = m[3];
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function extractDate(s: string): string | undefined {
  const iso = s.match(DATE);
  if (iso) return toIso(iso);
  const mdy = mdyToIso(s);
  if (mdy) return mdy;
  const ld = s.match(LONG_DATE);
  if (ld) return `${ld[3]}-${MONTHS[ld[1].slice(0, 3).toLowerCase()]}-${ld[2].padStart(2, "0")}`;
  return undefined;
}

function makeEntry(no: string, chunk: string, anchorDate?: string): IndexEntry | null {
  const rest = chunk.replace(BATES, "").trim();
  const tm = rest.search(TRAIL);
  const description = (tm >= 0 ? rest.slice(0, tm) : rest).replace(/[\s,;]+$/, "").trim().slice(0, 220);
  if (description.length < 8) return null;
  const date = anchorDate ? mdyToIso(anchorDate) : extractDate(rest);
  return { exhibitNo: no, description, date, score: 0 };
}

/** Slice descriptions between consecutive anchor matches. */
function parseAnchored(
  t: string,
  re: RegExp,
  getNo: (m: RegExpExecArray) => string,
  anchorDateGroup?: number,
): IndexEntry[] {
  const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const anchors: Array<{ no: string; start: number; end: number; date?: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(t))) {
    anchors.push({ no: getNo(m), start: m.index, end: m.index + m[0].length, date: anchorDateGroup ? m[anchorDateGroup] : undefined });
  }
  const entries: IndexEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (seen.has(a.no)) continue; // first occurrence wins
    const chunk = t.slice(a.end, anchors[i + 1]?.start ?? Math.min(t.length, a.end + 400));
    const e = makeEntry(a.no, chunk, a.date);
    if (!e) continue;
    seen.add(a.no);
    entries.push(e);
  }
  return entries;
}

/**
 * Parse an exhibit-list document into structured entries. Handles three real
 * formats: lettered no-separator (Google "PX0099"), lettered hyphenated (Epic
 * "PX-0001"/"DX- 3641"), and integer+date rows (Musk "1 3/3/2015 Email from …").
 */
export function parseExhibitList(text: string): IndexEntry[] {
  const t = text.replace(/‐/g, "-").replace(/\s+/g, " ");
  // Primary: lettered exhibit numbers. Normalize "DX- 3641" → "DX-3641".
  let entries = parseAnchored(t, EXHIBIT_NO, (m) => m[1].replace(/\s+/g, "").toUpperCase());
  // Fallback: integer + date rows when there are essentially no lettered anchors.
  if (entries.length < 5) {
    entries = parseAnchored(t, NUM_DATE_ROW, (m) => `EX-${m[1]}`, 2);
  }
  return entries;
}

const STRATEGIC =
  /\b(re:|strategy|strategic|compet(e|ition|itor)|acquisition|acquire|buy|threat|monopoly|\bdeal\b|pricing|launch|kill|shut ?down|moat|defaults?|revenue share|board|layoff|reorg|roadmap)\b/i;

/** Select and rank the instructive internal-correspondence entries. */
export function selectInstructive(
  entries: IndexEntry[],
  c: WatchedCase,
  limit: number,
): IndexEntry[] {
  const people = c.internalSignals?.people ?? [];
  const scored = entries
    .filter((e) => INTERNAL.test(e.description) && !PUBLIC_SOURCE.test(e.description))
    .map((e) => {
      let s = 0;
      if (/\be-?mail\b/i.test(e.description)) s += 3;
      if (/\b(presentation|deck|memo|memorandum)\b/i.test(e.description)) s += 2;
      if (/\bfrom\b.*\bto\b/i.test(e.description)) s += 1; // "from X to Y" — clear correspondence
      if (STRATEGIC.test(e.description)) s += 2;
      if (people.some((p) => new RegExp(`\\b${p}\\b`, "i").test(e.description))) s += 2;
      return { ...e, score: s };
    })
    .sort((a, b) => b.score - a.score || a.exhibitNo.localeCompare(b.exhibitNo));
  return scored.slice(0, limit);
}

/** Best-effort: resolve an exhibit number to a fetchable RECAP document. */
async function resolveOnRecap(
  c: WatchedCase,
  entry: IndexEntry,
): Promise<DiscoveredDocument | null> {
  const results = await searchRecapDocuments({
    court: c.court!,
    docketNumber: c.docketNumber,
    query: `"${entry.exhibitNo}"`,
    limit: 8,
  });
  const norm = (s: string) => s.replace(/[\s-]/g, "").toLowerCase();
  const wanted = norm(entry.exhibitNo);
  const hit = results
    .filter((r) => r.is_available && r.filepath_local && (r.page_count ?? 999) <= 40)
    // Confident match: the doc's own short_description names this exhibit (not a brief that merely cites it).
    .filter((r) => norm(r.short_description || "").includes(wanted))
    .sort((a, b) => (a.page_count ?? 999) - (b.page_count ?? 999))[0];
  if (!hit) return null;

  return {
    id: `cl-${c.court}-idx-${entry.exhibitNo.toLowerCase()}`,
    url: siteUrl(hit.absolute_url),
    fetchUrl: storageUrl(hit.filepath_local!),
    documentTitle: `${c.caseName} — ${entry.exhibitNo}: ${entry.description.slice(0, 90)}`,
    knownAuthors: [],
    knownLeaderSlugs: c.knownLeaderSlugs,
    knownCompany: c.knownCompany,
    recipientNames: [],
    dateAuthored: entry.date ?? hit.entry_date_filed ?? "",
    sourceType: "court_exhibit",
    sourceCase: c.caseName,
    sourceCitation: `${c.docketNumber} (${c.court!.toUpperCase()}), Trial Ex. ${entry.exhibitNo}`,
    licensingPath: "public_domain",
    hintedTopics: c.hintedTopics,
    cl: {
      docketId: hit.docket_id,
      documentId: hit.id,
      pacerDocId: hit.pacer_doc_id,
      pageCount: hit.page_count,
      filepathLocal: hit.filepath_local!,
      docketUrl: siteUrl(hit.absolute_url),
      signalScore: entry.score,
      filingDescription: entry.description,
      snippetPreview: entry.description.slice(0, 200),
    },
  };
}

export interface IndexDiscoverOptions {
  limit?: number; // max selected entries to consider. Default 25.
  resolve?: boolean; // attempt RECAP resolution (extra API calls). Default true.
}

export async function discoverFromIndex(
  c: WatchedCase,
  opts: IndexDiscoverOptions = {},
): Promise<IndexDiscovery> {
  if (c.system !== "recap" || !c.court) {
    return { totalEntries: 0, selected: [], resolved: [], unresolved: [] };
  }
  const limit = opts.limit ?? 25;

  const indexDoc = await findExhibitList(c.court, c.docketNumber);
  if (!indexDoc?.filepath_local) {
    return { totalEntries: 0, selected: [], resolved: [], unresolved: [] };
  }

  // Exhibit lists run dozens of pages; fetch the whole thing.
  const fetched = await fetchDocument(storageUrl(indexDoc.filepath_local), {
    pdfPageRange: [1, indexDoc.page_count ?? 100],
  });
  const entries = parseExhibitList(fetched.text ?? "");
  const selected = selectInstructive(entries, c, limit);

  const resolved: DiscoveredDocument[] = [];
  const unresolved: IndexEntry[] = [];
  if (opts.resolve !== false) {
    for (const e of selected) {
      const doc = await resolveOnRecap(c, e);
      if (doc) resolved.push(doc);
      else unresolved.push(e);
      await new Promise((r) => setTimeout(r, 350));
    }
  } else {
    unresolved.push(...selected);
  }

  return {
    indexDocId: `${indexDoc.document_number}${indexDoc.attachment_number ? `-${indexDoc.attachment_number}` : ""}`,
    indexPages: indexDoc.page_count ?? undefined,
    totalEntries: entries.length,
    selected,
    resolved,
    unresolved,
  };
}
