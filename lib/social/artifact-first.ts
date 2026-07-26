/**
 * Artifact-first social composition — the cold-account reach mode.
 *
 * The growth thesis (see /admin/social playbook + the memo): on a timeline with
 * no followers, the AI "leadership lesson" reads as guru content and gets
 * ignored, while the RAW artifact — a famous exec's actual internal email — is
 * intrinsically shareable (Internal Tech Emails proved it with zero commentary).
 *
 * So this builds a minimal, FACTUAL caption — who / to whom / when / the real
 * subject line — and lets the attached card image carry the content. No lesson,
 * no spin. It's fully deterministic (no Claude call), so it's available the
 * instant a post is selected. The link goes in the FIRST REPLY, not the body
 * (links in-body cut reach ~50%).
 */

import type { Post } from "@/lib/types";
import { SITE } from "@/lib/site";

const TWEET_LIMIT = 280;

function fullName(raw: string): string {
  return raw.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
}

function year(post: Post): string {
  const m = (post.dateAuthored || post.publishedAt || "").match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? m[1] : "";
}

/** Strip trailing " - Source.com" cruft from a subject; keep Re:/Fwd: (it's real). */
function tidySubject(raw: string): string {
  return raw
    .replace(/\s*[-–—]\s*(nytimes\.com|nytimes|the verge|geekwire|bloomberg|wsj\.com|wsj|reuters|cnbc)\s*$/i, "")
    .trim();
}

/** "Square, Inc." → "Square" for a cleaner caption. */
function cleanCompany(co: string): string {
  return co
    .replace(/[,]?\s*(inc\.?|incorporated|corp\.?|corporation|co\.?|llc|ltd\.?|limited|plc|holdings?)\.?$/i, "")
    .replace(/[.,\s]+$/, "")
    .trim();
}

export interface ArtifactFirstPost {
  /** The caption to post (image attached; link in first reply). */
  tweet: string;
  /** Paste into the FIRST REPLY / first comment — the source + article link. */
  replyText: string;
  /** UTM-tagged article link. */
  link: string;
  /** True if within the tweet limit. */
  withinLimit: boolean;
}

/**
 * Build the artifact-first caption + reply for a post. Emails lead with
 * who→whom + the real subject; threads lead with the participants; letters lead
 * with the author + company. Always ends with a pointer to the attached image.
 */
export function buildArtifactFirst(post: Post): ArtifactFirstPost {
  const yr = year(post);
  const company = cleanCompany(post.authorsCompany ?? "");
  const authors = (post.authorsName ?? []).map(fullName).filter(Boolean);
  const isThread = (post.messageThread?.length ?? 0) > 0;

  let lead: string;
  if (isThread && authors.length >= 2) {
    // "Elon Musk and Sam Altman, 2023."
    const named = authors.slice(0, 3);
    const list = named.length === 2 ? named.join(" and ") : named.slice(0, -1).join(", ") + ", and " + named[named.length - 1];
    lead = yr ? `${list}, ${yr}.` : `${list}.`;
  } else {
    const who = authors[0] || company || "An executive";
    const whoLine = company && authors[0] ? `${who} (${company})` : who;
    const to = (post.recipientNames ?? []).map(fullName).filter(Boolean)[0];
    // Omit "to X" when the recipient is the same person as the author (a data
    // quirk in some multi-party exhibits) — "X to X" reads broken.
    const showTo = to && authors[0] && to.toLowerCase() !== authors[0].toLowerCase();
    lead = `${whoLine}${showTo ? ` to ${to}` : ""}${yr ? `, ${yr}` : ""}.`;
  }

  const subj = tidySubject(post.emailSubject ?? "");
  const subjLine = !isThread && subj ? `Subject: “${subj}”` : "";
  const closer = isThread ? "The actual messages 👇" : "The actual email 👇";

  let tweet = [lead, subjLine, closer].filter(Boolean).join("\n\n");
  // Extremely defensive — the pieces are short, but never overflow.
  if (tweet.length > TWEET_LIMIT) tweet = [lead, closer].filter(Boolean).join("\n\n");

  const base = SITE.url.replace(/\/$/, "");
  const link = `${base}/post/${post.slug}?utm_source=twitter&utm_medium=artifact&utm_campaign=${encodeURIComponent(post.slug)}`;
  const source = post.sourceCase ? `Source: ${post.sourceCase}.` : "";
  const replyText = [`${source}`, `Full context + the lesson it teaches: ${link}`].filter(Boolean).join(" ");

  return { tweet, replyText, link, withinLimit: tweet.length <= TWEET_LIMIT };
}
