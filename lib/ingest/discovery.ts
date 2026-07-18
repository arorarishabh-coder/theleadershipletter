/**
 * RECAP discovery layer.
 *
 * Replaces the hand-curated static registry with live, docket-driven discovery:
 * for each federal case on the watchlist, find newly-surfaced exhibits that look
 * like internal corporate correspondence, score them by "email signal", and emit
 * pipeline-ready SourceDocuments. This is the mechanism that lets the project
 * scale the way Internal Tech Emails does — tracking dockets instead of
 * hand-listing documents.
 *
 * Note: scoring + this module's filters are a cheap first pass. The Haiku triage
 * stage in the pipeline is the real gate that decides whether a candidate is
 * genuinely internal correspondence worth publishing.
 */

import { searchRecapDocuments, siteUrl, storageUrl, type RecapDocResult } from "./courtlistener";
import { WATCHED_CASES, marqueeRecapCases, type WatchedCase } from "./watchlist";
import type { SourceDocument } from "./types";

/** Fallback query when a case has no internalSignals configured. */
const DEFAULT_QUERY = '"From:" "Subject:"';

/**
 * Build a per-case full-text query that biases toward EXECUTIVE correspondence
 * rather than lawyer/procedural filings. Generic "From:"/"Subject:" matches every
 * meet-and-confer letter; pairing the email-header signal with internal email
 * domains and principal names surfaces the actual internal emails.
 */
function caseQuery(c: WatchedCase): string {
  const sig = c.internalSignals;
  if (!sig) return DEFAULT_QUERY;
  const terms = [
    ...(sig.domains ?? []).map((d) => `"@${d}"`),
    ...(sig.people ?? []).map((p) => `"${p}"`),
  ];
  if (!terms.length) return DEFAULT_QUERY;
  return `"From:" (${terms.join(" OR ")})`;
}

// Trial/deposition exhibits (admitted evidence) carry PX####/DX####/PTX#### style
// numbers — the strongest signal that a document is real evidentiary correspondence.
const TRIAL_EXHIBIT = /\b(P|D|PT|DT|JX|PX|DX)\s?-?\s?\d{2,5}\b/i;
// Law-firm / procedural correspondence to deprioritize.
const LAWYER_NOISE =
  /\b(meet and confer|dear (counsel|mr\.|ms\.|judge)|LLP|PLLC|magistrate|interrogator|protective order|privilege log|deposition notice|scheduling order|motion to compel)\b/i;

/** A discovered document: a pipeline SourceDocument plus RECAP provenance. */
export interface DiscoveredDocument extends SourceDocument {
  cl: {
    docketId: number;
    documentId: number;
    pacerDocId: string | null;
    pageCount: number | null;
    filepathLocal: string;
    docketUrl: string;
    signalScore: number;
    filingDescription: string;
    /** Short preview of CL's matched snippet — provenance display only, never republished as content. */
    snippetPreview: string;
  };
}

export interface DiscoverOptions {
  /** Limit discovery to these watched-case ids. */
  caseIds?: string[];
  /** Override the full-text query. */
  query?: string;
  /** Max kept candidates per case after scoring. Default 8. */
  perCaseLimit?: number;
  /** Only entries filed on/after this ISO date (for incremental runs). */
  since?: string;
  /** Page-count bounds for kept candidates. Defaults 1..30. */
  minPages?: number;
  maxPages?: number;
}

export interface DiscoverReport {
  documents: DiscoveredDocument[];
  perCase: Array<{ caseId: string; caseName: string; fetched: number; kept: number; error?: string }>;
  skipped: Array<{ caseId: string; reason: string }>;
}

const EMAIL_HEADER = /\b(from|to|subject|sent|cc|bcc)\s*:/i;
// Reply chains / forwarded blocks — the strongest "this is a real email" signal.
const EMAIL_THREAD =
  /(-{2,}\s*original message|on .{0,80}\bwrote:|begin forwarded message|^\s*(re|fwd):\s)/im;
const SENT_FROM_DEVICE = /sent from my (iphone|ipad|blackberry|mobile|phone)/i;
// Chat/message-thread exhibits — WhatsApp/SMS/iMessage/Slack/Signal transcripts.
const MESSAGE_THREAD =
  /(@s\.whatsapp\.net|\bwhatsapp\b|\bimessage\b|\bsms\b|text message|\bslack\b|\bsignal\b|group chat|chat (thread|log|transcript)|\[redacted\]@)/i;

// ---- Noise types that dominated the unfiltered top-6 (push these DOWN) ----
const PRESS_RELEASE =
  /(for immediate release|press release|media (contact|inquir)|investor relations|forward-looking statements|today announced|announced today|completes? (its )?acquisition|definitive agreement to acquire|\bnewsroom\b)/i;
const CALENDAR_INVITE =
  /(\bwhen:\s|\bwhere:\s|\blocation:\s|microsoft teams meeting|join (the )?(zoom |microsoft |teams )?meeting|google meet|webex|dial-?in|conference (call|line|id)|recurrence:|\b(accepted|tentative|declined):|meeting (invite|invitation|request)|\.ics\b)/i;
// The document is itself a court filing (not an email attached to one).
const COURT_FILING =
  /^\s*(declaration|motion|order|notice|stipulation|brief|memorandum|transcript|statement|summons|certificate|praecipe|minute entry|judgment|subpoena|response|reply|opposition|proposed order|joint (status|submission)|civil cover)/i;
const NOT_CORRESPONDENCE =
  /(index of exhibits|exhibit (list|index)|witness list|table of (contents|authorities)|master (index|exhibit)|cover sheet|\bdocket\b)/i;

function scoreSignal(r: RecapDocResult, c: WatchedCase): number {
  let s = 0;
  const short = r.short_description || "";
  const desc = r.description || "";
  const snip = r.snippet || "";
  const domains = c.internalSignals?.domains ?? [];
  const people = c.internalSignals?.people ?? [];

  // ---- POSITIVE: genuine internal-email signals ----
  if (TRIAL_EXHIBIT.test(short)) s += 4; // admitted evidence (PX####/DX####)
  const fullHeader = /\bfrom:\s/i.test(snip) && /\bsubject:\s/i.test(snip);
  if (fullHeader) s += 5; // a real email header block (From + Subject)
  else if (EMAIL_HEADER.test(snip)) s += 2;
  if (EMAIL_THREAD.test(snip)) s += 3; // reply/forward chain
  if (SENT_FROM_DEVICE.test(snip)) s += 2;
  // Chat/message-thread exhibits (WhatsApp/SMS/iMessage/Slack) — just as valid as
  // email, but lack From/Subject headers, so reward their own fingerprints.
  if (MESSAGE_THREAD.test(snip) || MESSAGE_THREAD.test(desc)) s += 4;
  if (domains.some((d) => snip.toLowerCase().includes(`@${d.toLowerCase()}`))) s += 4; // internal domain
  if (people.some((p) => new RegExp(`\\b${p}\\b`, "i").test(snip))) s += 1;
  if (/e-?mail/i.test(short)) s += 1;
  if (/^\s*exhibit/i.test(short) && !PRESS_RELEASE.test(snip)) s += 1;

  // Short standalone docs are more likely a single email; huge docs are bundles/filings.
  const pages = r.page_count ?? 999;
  if (pages >= 1 && pages <= 8) s += 2;
  else if (pages <= 20) s += 1;
  else if (pages > 40) s -= 2;

  // ---- NEGATIVE: the noise that was crowding out real emails ----
  if (PRESS_RELEASE.test(snip) || PRESS_RELEASE.test(desc)) s -= 6;
  if (CALENDAR_INVITE.test(snip)) s -= 6;
  if (COURT_FILING.test(short)) s -= 5;
  if (NOT_CORRESPONDENCE.test(short)) s -= 5;
  if (LAWYER_NOISE.test(snip) || LAWYER_NOISE.test(desc)) s -= 3;

  return s;
}

function sanitizeDocket(n: string): string {
  return n.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
}

function toDiscovered(c: WatchedCase, r: RecapDocResult, score: number): DiscoveredDocument {
  const att = r.attachment_number ?? 0;
  const docNum = r.document_number ?? "0";
  const id = `cl-${c.court}-${sanitizeDocket(c.docketNumber)}-${docNum}-${att}`;
  const shortDesc = r.short_description || `Doc ${docNum}`;
  const citationDoc = att ? `Doc. ${docNum}-${att}` : `Doc. ${docNum}`;
  const filedPart = r.entry_date_filed ? `, filed ${r.entry_date_filed}` : "";

  return {
    id,
    url: siteUrl(r.absolute_url),
    fetchUrl: r.filepath_local ? storageUrl(r.filepath_local) : siteUrl(r.absolute_url),
    documentTitle: `${c.caseName} — ${shortDesc}`,
    knownAuthors: [], // unknown until enrich reads the PDF
    knownLeaderSlugs: c.knownLeaderSlugs,
    knownCompany: c.knownCompany,
    recipientNames: [],
    dateAuthored: r.entry_date_filed ?? "", // placeholder; enrich extracts the email's own date
    sourceType: "court_exhibit",
    sourceCase: c.caseName,
    sourceCitation: `${c.docketNumber} (${(c.court ?? "").toUpperCase()}), ${citationDoc}${filedPart}`,
    licensingPath: "public_domain",
    hintedTopics: c.hintedTopics,
    cl: {
      docketId: r.docket_id,
      documentId: r.id,
      pacerDocId: r.pacer_doc_id,
      pageCount: r.page_count,
      filepathLocal: r.filepath_local ?? "",
      docketUrl: siteUrl(r.absolute_url),
      signalScore: score,
      filingDescription: r.description || "",
      snippetPreview: (r.snippet || "").replace(/\s+/g, " ").slice(0, 200),
    },
  };
}

export async function discoverFromWatchlist(opts: DiscoverOptions = {}): Promise<DiscoverReport> {
  const perCaseLimit = opts.perCaseLimit ?? 8;
  const minPages = opts.minPages ?? 1;
  const maxPages = opts.maxPages ?? 30;

  // Default sweep is pinned to marquee cases (CHARTER "Article Inclusion Spec");
  // an explicit caseIds list overrides and can pull any watched case on demand.
  const cases = opts.caseIds?.length
    ? WATCHED_CASES.filter((c) => opts.caseIds!.includes(c.id))
    : marqueeRecapCases();

  const report: DiscoverReport = { documents: [], perCase: [], skipped: [] };

  for (const c of cases) {
    if (c.system !== "recap" || !c.court) {
      report.skipped.push({
        caseId: c.id,
        reason: c.system === "state" ? "State court — not in RECAP/PACER" : "No court id",
      });
      continue;
    }

    try {
      // Explicit --query overrides; otherwise use the case's targeted query.
      const query = opts.query ?? caseQuery(c);
      const raw = await searchRecapDocuments({
        court: c.court,
        docketNumber: c.docketNumber,
        query,
        filedAfter: opts.since,
        orderBy: "score desc",
        limit: 50,
      });

      const kept = raw
        .filter((r) => r.is_available && r.filepath_local)
        .filter((r) => {
          const p = r.page_count ?? 0;
          return p >= minPages && p <= maxPages;
        })
        // Keep CL's full-text relevance order as the backbone (clRank): for image
        // PDFs the snippet is just the cover stamp, but CL ranked by full OCR text,
        // so a targeted "From: @domain / Person" query already surfaces real emails.
        // Our score mainly DEMOTES reliable non-emails (filings, indexes, PR); ties
        // fall back to CL's relevance order, not an arbitrary page-count sort.
        .map((r, clRank) => ({ r, clRank, score: scoreSignal(r, c) }))
        .sort((a, b) => b.score - a.score || a.clRank - b.clRank)
        .slice(0, perCaseLimit)
        .map(({ r, score }) => toDiscovered(c, r, score));

      report.documents.push(...kept);
      report.perCase.push({ caseId: c.id, caseName: c.caseName, fetched: raw.length, kept: kept.length });
    } catch (e) {
      report.perCase.push({
        caseId: c.id,
        caseName: c.caseName,
        fetched: 0,
        kept: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    await new Promise((r) => setTimeout(r, 700)); // polite delay between cases
  }

  // De-dup across cases by document id (a doc can match multiple queries)
  const seen = new Set<string>();
  report.documents = report.documents.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  return report;
}
