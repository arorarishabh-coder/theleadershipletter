/**
 * Email subject + preview-text crafting for the daily broadcast.
 *
 * Why this exists: opens are the whole ballgame for a newsletter, and two inbox
 * fields decide them — the SUBJECT and the PREVIEW TEXT (the grey line next to
 * it). We were shipping the bare on-site title as the subject and NO preview
 * text at all, which is the single biggest silent open-rate leak.
 *
 * The brand's edge is that every edition is a REAL corporate document. So the
 * subject leads with that fact — author + year + the document's own words —
 * instead of a generic leadership-guru title the timeline (and the inbox)
 * tunes out. Compare:
 *
 *   before:  "How to Walk Away Without Burning the Bridge"
 *   after:   Amodei, 2026: “Re: Redline”                      (has a real subject)
 *   after:   Zuckerberg, 2012: “I wonder if we should buy Instagram”
 *
 * Everything here is DETERMINISTIC and computed at send time from fields the
 * post already has — no LLM in the critical send path, no backfill, no schema
 * change. `post.emailSubjectLine` / `post.emailPreview` are optional override
 * slots so a future precomputed (e.g. LLM-crafted) value can win without any
 * change to the send path or this module.
 */

import type { Post } from "@/lib/types";

// Gmail/Apple Mail truncate the subject around 70 chars on desktop and ~40 on
// mobile — front-load meaning and keep the whole thing tight.
const SUBJECT_MAX = 78;
const PREVIEW_MAX = 140;

/** Last name (or short single-token name) for the anchor, e.g. "Dario Amodei" → "Amodei". */
function shortName(full: string): string {
  const clean = full.replace(/\[.*?\]/g, "").trim(); // drop "[redacted]" fragments
  if (!clean) return "";
  // Keep a single evocative token: prefer the last word unless it's an initial/suffix.
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length >= 2) return parts[parts.length - 2];
  // If the "last name" is just an initial, fall back to the first token.
  if (last.replace(/\./g, "").length <= 1) return parts[0];
  return last;
}

// Role words that mark an "author" as an entity, not a person — shareholder/board
// letters sign as "Roku Management", "DoorDash Leadership", "Square Investor
// Relations Team", "DSP Group Board of Directors". The company is a stronger,
// cleaner inbox anchor than the role word.
const ROLE_WORD = /\b(management|leadership|board|directors?|investor relations|relations|shareholders?|committee|the company|executive team|editors?)\b/i;

/** Strip legal suffixes so "Square, Inc." → "Square", "DSP Group Inc" → "DSP Group". */
function cleanCompany(co: string): string {
  return co
    .replace(/[,]?\s*(inc\.?|incorporated|corp\.?|corporation|co\.?|company|llc|l\.l\.c\.|ltd\.?|limited|plc|n\.v\.|s\.a\.|holdings?)\.?$/i, "")
    .replace(/[.,\s]+$/, "")
    .trim();
}

/** The person or company the edition should be attributed to in the subject. */
function anchorLabel(post: Post): string {
  const co = cleanCompany((post.authorsCompany ?? "").trim());
  const author = (post.authorsName ?? []).map((n) => n?.trim()).find(Boolean);
  if (author) {
    // An entity/role author ("… Management", "… Board of Directors") is a weak,
    // noisy anchor — prefer the company name when we have one.
    if (ROLE_WORD.test(author) && co) return co;
    return shortName(author);
  }
  return co;
}

function year(post: Post): string {
  const src = post.dateAuthored || post.publishedAt || "";
  const m = src.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? m[1] : "";
}

/**
 * Clean an email subject for display in quotes: drop the Re:/Fwd:/Fw: reply
 * chain, leading mailing-list "[tag]" prefixes, and trailing " - Source.com"
 * cruft, so the quote shows just the substance ("Redline", not "Re: Redline";
 * "Another header bidding push…", not "Fwd: [programmatic-news] Another…").
 */
function tidySubject(raw: string): string {
  return raw
    .replace(/^((re|fwd?|fw)\s*:\s*)+/i, "") // reply/forward chain
    .replace(/^(\[[^\]]{1,40}\]\s*)+/, "") // "[programmatic-news] " list tags
    .replace(/\s*[-–—]\s*(nytimes\.com|nytimes|the verge|geekwire|bloomberg|wsj\.com|wsj|reuters|cnbc)\s*$/i, "")
    .trim();
}

/**
 * Is the CLEANED subject worth quoting? A bare "Re:" or a tiny stub is not; a
 * real phrase is.
 */
function isEvocativeSubject(raw: string): boolean {
  return tidySubject(raw).length >= 6;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, "") + "…";
}

/**
 * The daily email's subject line. Leads with author + year to signal "this is a
 * real document", then the document's own subject in quotes when it has an
 * evocative one; otherwise the editorial title. Falls back gracefully to the
 * plain title when there's no usable anchor.
 */
export function craftEmailSubject(post: Post): string {
  if (post.emailSubjectLine?.trim()) return post.emailSubjectLine.trim();

  const anchor = anchorLabel(post);
  const yr = year(post);
  const prefix = anchor ? (yr ? `${anchor}, ${yr}: ` : `${anchor}: `) : "";

  const rawSubj = (post.emailSubject ?? "").trim();
  if (rawSubj && isEvocativeSubject(rawSubj)) {
    const quote = tidySubject(rawSubj);
    const room = SUBJECT_MAX - prefix.length - 2; // 2 for the curly quotes
    return `${prefix}“${truncate(quote, Math.max(20, room))}”`;
  }

  // No usable email subject → anchor + editorial title.
  if (prefix) return truncate(`${prefix}${post.title}`, SUBJECT_MAX);
  return truncate(post.title, SUBJECT_MAX);
}

/**
 * Preview text — the grey line the inbox shows after the subject. Uses the
 * document's own opening words (the artifact voice), which reads as "come see
 * the real thing" far better than a marketing tagline. For message threads,
 * leads with the first turn.
 */
export function craftEmailPreview(post: Post): string {
  if (post.emailPreview?.trim()) return truncate(post.emailPreview.trim(), PREVIEW_MAX);

  // Message threads: first speaker's line.
  const turn = post.messageThread?.find((t) => t?.text?.trim());
  if (turn) {
    const sender = turn.sender?.replace(/\[.*?\]/g, "").trim();
    const line = clean(turn.text);
    return truncate(sender ? `${shortName(sender)}: ${line}` : line, PREVIEW_MAX);
  }

  const excerpt = clean(stripAttribution(post.excerptForBlog ?? ""));
  if (excerpt) return truncate(excerpt, PREVIEW_MAX);

  // Last resort: the situation summary, then the title.
  const situation = clean(post.situation ?? "");
  if (situation) return truncate(situation, PREVIEW_MAX);
  return truncate(post.title, PREVIEW_MAX);
}

/**
 * Strip a leading attribution line the excerpt sometimes carries, e.g.
 * `From: Dario Amodei, Anthropic — February 26, 2026:` or `Elon Musk, 2017:`,
 * plus any wrapping quote marks, so the preview starts on the actual words.
 */
function stripAttribution(raw: string): string {
  let s = raw.trim();
  // "From: Name, Co — Month DD, YYYY:\n\n" prefix
  s = s.replace(/^from:\s*[^\n"]{0,80}?:\s*/i, "");
  // "Name, September 20, 2017:" or "Name (11:39 AM):" prefixes at the very start
  s = s.replace(/^[A-Z][^\n"]{0,60}?(,\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}|\(\d{1,2}:\d{2}\s*[AP]M\))\s*:\s*/i, "");
  // Leading wrapping quote.
  s = s.replace(/^["“”']+/, "");
  return s;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/["“”]+$/, "").trim();
}
