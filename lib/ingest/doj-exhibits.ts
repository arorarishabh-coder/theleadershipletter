/**
 * Off-RECAP exhibit fetcher — DOJ public trial-exhibit archives.
 *
 * Some cases (notably US v. Google) release their trial exhibits NOT on PACER/RECAP
 * but on the DOJ Antitrust Division site, as a table of:
 *   <exhibit number> | <descriptive title> | <date posted>
 * where each number links to a downloadable PDF. That single page is therefore
 * BOTH the curated index (rich descriptions) AND the resolver (fetchable URL) —
 * it completes the index-driven loop where RECAP resolution fails.
 *
 * We reuse the index selector (selectInstructive) on the titles, then point each
 * pick at its DOJ PDF URL so the normal pipeline (OCR → relevance gate → lesson)
 * can ingest it.
 */

import { fetchDocument } from "./fetch";
import { selectInstructive, type IndexEntry } from "./exhibit-index";
import type { WatchedCase } from "./watchlist";
import type { DiscoveredDocument } from "./discovery";

const SITE = "https://www.justice.gov";

export interface DojExhibit {
  exhibitNo: string;
  title: string;
  pdfUrl: string;
  date?: string;
}

// Table row: <td><a href="…">UPX0001</a></td><td>Title …</td>
const ROW =
  /<td>\s*<a[^>]*href="([^"]+)"[^>]*>\s*([A-Z]{1,5}\d{3,5}[A-Z]?)\s*<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>/gi;

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#x27;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a trailing "(March 16, 2007)" / "(Apr. 14, 2021)" into an ISO date. */
function parseTrailingDate(title: string): string | undefined {
  const m = title.match(/\(([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})\)\s*$/);
  if (!m) return undefined;
  const d = new Date(m[1].replace(/\./g, ""));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** Fetch + parse one or more DOJ exhibit-archive pages into a flat exhibit list. */
export async function fetchDojExhibits(urls: string[]): Promise<DojExhibit[]> {
  const out: DojExhibit[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const r = await fetchDocument(url);
    const html = r.rawHtml ?? "";
    let m: RegExpExecArray | null;
    ROW.lastIndex = 0;
    while ((m = ROW.exec(html))) {
      const exhibitNo = m[2].trim();
      if (seen.has(exhibitNo)) continue;
      const href = m[1].trim();
      const pdfUrl = href.startsWith("http") ? href : `${SITE}${href}`;
      const title = decodeHtml(m[3]);
      if (title.length < 5) continue;
      seen.add(exhibitNo);
      out.push({ exhibitNo, title, pdfUrl, date: parseTrailingDate(title) });
    }
    await new Promise((res) => setTimeout(res, 400));
  }
  return out;
}

export interface DojDiscovery {
  exhibits: number;
  selected: IndexEntry[];
  resolved: DiscoveredDocument[];
}

export async function discoverFromDoj(c: WatchedCase, limit = 25): Promise<DojDiscovery> {
  if (!c.exhibitArchiveUrls?.length || !c.court) {
    return { exhibits: 0, selected: [], resolved: [] };
  }
  const exhibits = await fetchDojExhibits(c.exhibitArchiveUrls);
  const byNo = new Map(exhibits.map((e) => [e.exhibitNo, e]));

  // Reuse the index selector on the DOJ titles (treat title as the description).
  const entries: IndexEntry[] = exhibits.map((e) => ({
    exhibitNo: e.exhibitNo,
    description: e.title,
    date: e.date,
    score: 0,
  }));
  const selected = selectInstructive(entries, c, limit);

  const resolved: DiscoveredDocument[] = selected.map((e) => {
    const ex = byNo.get(e.exhibitNo)!;
    // Many trial exhibits are cross-company emails (e.g. a Mozilla or Microsoft
    // email entered in the Google case). When the DOJ title names the sender's
    // company in parens right after the name ("from X (Google) to Y"), use it so
    // the byline is accurate. Look only in the "from … to" segment, and reject a
    // trailing "(date)" (some titles end in "(June 16, 2011)" with no company).
    const fromSeg = e.description.match(/\bfrom\b(.*?)(?:\bto\b|$)/i)?.[1] ?? "";
    const coMatch = fromSeg.match(/\(([^)]+)\)/)?.[1]?.trim();
    const senderCo = coMatch && !/\d{4}/.test(coMatch) ? coMatch : undefined;
    return {
      id: `doj-${c.court}-${e.exhibitNo.toLowerCase()}`,
      url: ex.pdfUrl,
      fetchUrl: ex.pdfUrl,
      documentTitle: `${c.caseName} — ${e.exhibitNo}: ${e.description.slice(0, 90)}`,
      knownAuthors: [],
      knownLeaderSlugs: c.knownLeaderSlugs,
      knownCompany: senderCo || c.knownCompany,
      recipientNames: [],
      dateAuthored: e.date ?? "",
      sourceType: "court_exhibit",
      sourceCase: c.caseName,
      sourceCitation: `${c.docketNumber} (${c.court!.toUpperCase()}), Trial Ex. ${e.exhibitNo} — DOJ public archive`,
      licensingPath: "public_domain",
      hintedTopics: c.hintedTopics,
      cl: {
        docketId: 0,
        documentId: 0,
        pacerDocId: null,
        pageCount: null,
        filepathLocal: "",
        docketUrl: ex.pdfUrl,
        signalScore: e.score,
        filingDescription: e.description,
        snippetPreview: e.description.slice(0, 200),
      },
    };
  });

  return { exhibits: exhibits.length, selected, resolved };
}
