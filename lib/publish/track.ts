/**
 * First-party open/click tracking for the daily newsletter.
 *
 * WHY THIS EXISTS: Resend reports `open_tracking: true` / `click_tracking: true`
 * on our verified domain, but does not actually apply it. Verified 2026-08-16 by
 * reading the raw source of a message delivered from daily@theleadershipletter.com:
 * no tracking pixel, no rewritten links, and no `X-SES-CONFIGURATION-SET` header
 * (the SES mechanism that injects both) — on BOTH the transactional (POST /emails)
 * and Broadcast paths. Resend asks for no tracking CNAME, so there is no DNS gap to
 * close. That means 478 delivered emails recorded zero opens not because nobody
 * opened, but because the delivered mail carried nothing capable of recording one.
 *
 * So we instrument it ourselves, on our own domain. This is strictly better anyway:
 * we own the data, it lands in the EmailEvent table we already have, and it survives
 * changing ESP.
 *
 * HOW IT WORKS
 *   - Open:  a 1x1 GIF at /api/track/open?p=<slug>&e=<recipient>
 *   - Click: links are rewritten to /api/track/click?p=<slug>&u=<target>&s=<sig>&e=<recipient>
 *
 * The recipient is filled in per-person by Resend's `{{{EMAIL}}}` merge tag, which
 * we verified renders inside both `href` and `img src` attributes in a broadcast
 * (the two-brace `{{EMAIL}}` form does NOT render — it ships literally). That is
 * what makes UNIQUE-recipient rates possible rather than raw hit counts.
 *
 * OPEN-REDIRECT SAFETY: the click target is HMAC-signed at HTML-build time, so
 * /api/track/click will only ever redirect to a URL we ourselves emitted. No host
 * allowlist to maintain, and an attacker can't craft a link through our domain.
 *
 * DEGRADES SAFELY: with no signing secret, or no site URL, links are left exactly
 * as they were and no pixel is added. Tracking is never allowed to break an email.
 */

import crypto from "node:crypto";

/** Resend's per-contact merge tag. Triple braces — the two-brace form is not interpolated. */
export const EMAIL_MERGE_TAG = "{{{EMAIL}}}";

/** Placeholder stored when the merge tag didn't render (or a non-broadcast send). */
export const UNKNOWN_RECIPIENT = "unknown";

/**
 * Signing key. Falls back to AUTH_SECRET so this works on the existing deploy with
 * no new environment variable — TRACK_SECRET only needs setting if we ever want to
 * rotate tracking links independently of session cookies.
 */
export function trackingSecret(): string | null {
  return process.env.TRACK_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

/** Truncated HMAC — 16 hex chars is ample to stop URL forgery and keeps links short. */
export function signTarget(url: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(url).digest("hex").slice(0, 16);
}

export function verifyTarget(url: string, sig: string, secret: string): boolean {
  const expected = signTarget(url, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Decode the handful of HTML entities that appear in our own hrefs. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Escape for re-embedding in an HTML attribute. */
function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export interface TrackOptions {
  slug: string;
  siteUrl: string;
  /** Defaults to the Resend merge tag; pass "" for previews so no tag leaks into the HTML. */
  recipient?: string;
}

function recipientParam(opts: TrackOptions): string {
  const r = opts.recipient ?? EMAIL_MERGE_TAG;
  return r ? `&e=${r === EMAIL_MERGE_TAG ? r : encodeURIComponent(r)}` : "";
}

/** Should this href be rewritten? */
function isTrackableHref(href: string): boolean {
  const h = href.trim();
  if (!/^https?:\/\//i.test(h)) return false; // mailto:, tel:, and merge-tag-only hrefs
  if (/unsubscribe\.resend\.com/i.test(h)) return false; // must stay Resend's one-click link
  if (/\/api\/track\//i.test(h)) return false; // already instrumented
  return true;
}

/** Build the tracked redirect URL for a target, or null if tracking is unavailable. */
export function trackedClickUrl(target: string, opts: TrackOptions): string | null {
  const secret = trackingSecret();
  if (!secret || !opts.siteUrl) return null;
  const clean = decodeEntities(target);
  if (!isTrackableHref(clean)) return null;
  const u = b64urlEncode(clean);
  const s = signTarget(clean, secret);
  return `${opts.siteUrl}/api/track/click?p=${encodeURIComponent(opts.slug)}&u=${u}&s=${s}${recipientParam(opts)}`;
}

/** The 1x1 open pixel `<img>` tag, or "" if tracking is unavailable. */
export function openPixelTag(opts: TrackOptions): string {
  if (!opts.siteUrl) return "";
  const src = `${opts.siteUrl}/api/track/open?p=${encodeURIComponent(opts.slug)}${recipientParam(opts)}`;
  return `<img src="${escAttr(src)}" width="1" height="1" border="0" alt="" style="display:block;width:1px;height:1px;border:0;overflow:hidden;"/>`;
}

/**
 * Rewrite every trackable link in an email document and append the open pixel.
 * Untrackable links (mailto, unsubscribe) and the whole document are otherwise
 * left byte-identical.
 */
export function instrumentEmailHtml(html: string, opts: TrackOptions): string {
  let out = html.replace(/href="([^"]*)"/gi, (whole, href: string) => {
    const tracked = trackedClickUrl(href, opts);
    return tracked ? `href="${escAttr(tracked)}"` : whole;
  });

  const pixel = openPixelTag(opts);
  if (pixel) {
    out = out.includes("</body>") ? out.replace("</body>", `${pixel}</body>`) : out + pixel;
  }
  return out;
}
