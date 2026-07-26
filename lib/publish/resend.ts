/**
 * Resend publish adapter — the daily newsletter delivery layer.
 *
 * Why Resend: it's the one ESP whose free tier (1,000 contacts, ~3,000 emails/mo,
 * 100/day) accepts our *own rendered HTML* programmatically. Beehiiv's Create Post
 * is Enterprise-only and MailerLite's HTML-via-API + RSS-to-email are paid — both
 * dead ends at $0. Resend's Broadcasts API takes an `html` body directly.
 *
 * Model (verified against the account): this workspace is on the AUDIENCES model
 * (audience_id), not segments. Each daily post becomes a Broadcast targeting the
 * configured audience.
 *
 *   Create:  POST https://api.resend.com/broadcasts
 *            { audience_id, from, subject, name, html, reply_to? } -> { id }
 *   Send:    POST https://api.resend.com/broadcasts/{id}/send  { scheduled_at? }
 *   List:    GET  https://api.resend.com/broadcasts            (dedup by name=slug)
 *   Contact: POST https://api.resend.com/audiences/{id}/contacts { email, unsubscribed }
 *
 * Default status is "draft" (create, don't send) so a human approves in the Resend
 * dashboard — a daily email is irreversible and the gate is good, not infallible.
 * Set CRON_AUTO_CONFIRM=true to send automatically.
 *
 * Requires RESEND_API_KEY + RESEND_AUDIENCE_ID. RESEND_FROM sets the sender
 * (onboarding@resend.dev works for testing; verify a domain for real sends).
 * SITE_URL makes the source screenshot resolve in the email.
 */

import type { Post } from "@/lib/types";
import { buildPostHtml } from "@/lib/publish/beehiiv";
import { craftEmailSubject, craftEmailPreview } from "@/lib/publish/email-craft";

const API = "https://api.resend.com";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Wrap the post body in a complete, email-client-safe HTML document with the
 * masthead and an unsubscribe footer. {{{RESEND_UNSUBSCRIBE_URL}}} is Resend's
 * merge tag — it renders a per-recipient one-click unsubscribe link (required
 * for broadcasts / CAN-SPAM compliance).
 */
export function buildEmailDocument(post: Post, siteUrl = ""): string {
  const body = buildPostHtml(post, siteUrl);
  const postUrl = siteUrl ? `${siteUrl}/post/${post.slug}` : "";
  // Free-week trial CTA — converts daily readers into archive trialists. Only
  // rendered when SITE_URL is set (the link must be absolute). UTM-tagged so the
  // newsletter→trial funnel is measurable.
  const trialUrl = siteUrl
    ? `${siteUrl}/membership?utm_source=newsletter&utm_medium=email&utm_campaign=free_week`
    : "";
  const trialCta = trialUrl
    ? `<div style="margin:36px 0 8px;padding:22px 24px;border:1px solid #1c1a17;background:#f4efe6;text-align:center;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;">Members &middot; The full archive</div>
      <div style="font-size:20px;font-weight:600;margin:8px 0 6px;letter-spacing:-0.01em;">Read every letter, not just today&rsquo;s.</div>
      <div style="font-size:14px;color:#5c574e;margin:0 auto 16px;max-width:420px;">Start a <strong>free 7-day trial</strong> of the full searchable archive — every past edition. No card required.</div>
      <a href="${esc(trialUrl)}" style="display:inline-block;background:#1c1a17;color:#fbf8f1;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:0.18em;text-decoration:none;border:1px solid #1c1a17;">Start your free week &rarr;</a>
    </div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(post.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4efe6;">
  <div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fbf8f1;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;line-height:1.6;">
    <div style="text-align:center;border-bottom:2px solid #1c1a17;padding-bottom:14px;margin-bottom:24px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;">The Daily Edition</div>
      <div style="font-size:26px;font-weight:600;margin-top:6px;">The Leadership Letter</div>
      <div style="font-size:12px;color:#8a8378;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">One real corporate letter, and the lesson it teaches.</div>
    </div>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;">${esc(post.title)}</h1>
    ${body}
    ${trialCta}
    <div style="margin-top:32px;border-top:1px solid #ddd6c8;padding-top:16px;font-size:12px;color:#8a8378;font-family:Arial,Helvetica,sans-serif;text-align:center;">
      ${postUrl ? `<p style="margin:0 0 8px;"><a href="${esc(postUrl)}" style="color:#b5482f;">Read this on the web</a></p>` : ""}
      <p style="margin:0;">You're receiving this because you subscribed to The Leadership Letter daily edition.</p>
      <p style="margin:8px 0 0;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8a8378;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

export interface ResendResult {
  ok: boolean;
  dryRun?: boolean;
  id?: string;
  sent?: boolean;
  error?: string;
  payload?: Record<string, unknown>;
}

export interface PublishOptions {
  status?: "draft" | "confirmed";
  scheduledAt?: string; // ISO 8601 or natural language (Resend accepts both)
  dryRun?: boolean;
}

/** Broadcast create payload. `name` = slug so we can dedup by listing broadcasts. */
export function buildBroadcastPayload(post: Post): Record<string, unknown> {
  const siteUrl = process.env.SITE_URL || "";
  return {
    audience_id: process.env.RESEND_AUDIENCE_ID,
    from: process.env.RESEND_FROM || "The Leadership Letter <onboarding@resend.dev>",
    // Artifact-anchored subject + the document's own opening as preview text —
    // the two inbox fields that decide the open. See lib/publish/email-craft.ts.
    subject: craftEmailSubject(post),
    preview_text: craftEmailPreview(post),
    name: post.slug,
    html: buildEmailDocument(post, siteUrl),
  };
}

/**
 * Already-created broadcast identities ("name:<slug>"), used to dedup so the daily
 * cron creates each post once. Resend is the source of truth (no DB): a draft or
 * sent broadcast for a slug means "don't create another." Matches on the broadcast
 * `name`, which we set to the post slug.
 */
export async function listPublishedIdentities(): Promise<Set<string>> {
  const ids = new Set<string>();
  const key = process.env.RESEND_API_KEY;
  if (!key) return ids;
  const res = await fetch(`${API}/broadcasts`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return ids;
  const json = (await res.json().catch(() => ({}))) as { data?: Array<{ name?: string }> };
  for (const b of json.data ?? []) {
    if (b.name) ids.add(`name:${b.name.trim().toLowerCase()}`);
  }
  return ids;
}

/** Has a broadcast already been created for this post (by slug)? */
export function isPublished(post: Post, published: Set<string>): boolean {
  return published.has(`name:${post.slug.trim().toLowerCase()}`);
}

export interface BroadcastInfo {
  id: string;
  status: string; // "draft" | "queued" | "sending" | "sent" | ...
  sentAt: string | null; // ISO when Resend actually delivered the broadcast
  scheduledAt: string | null;
  createdAt: string;
}

/**
 * Slug of the broadcast with the most recent sent_at — i.e. the article that
 * was actually emailed to the audience most recently. That's the one article
 * non-subscribers (trial_expired, anonymous, etc.) are entitled to read,
 * matching the brand promise "the daily letter is free."
 */
export async function getMostRecentBroadcastSlug(): Promise<string | null> {
  const broadcasts = await listBroadcastsByName();
  let best: { slug: string; sentAt: string } | null = null;
  for (const [slug, info] of broadcasts) {
    if (!info.sentAt) continue;
    if (!best || info.sentAt > best.sentAt) best = { slug, sentAt: info.sentAt };
  }
  return best?.slug ?? null;
}

/**
 * All broadcasts keyed by post slug (lowercased). Powers the admin dashboard
 * — joins Resend's actual send timestamps back onto our content/posts/*.json
 * corpus so "newsletters sent" reflects reality rather than a DB column nobody
 * writes. Cached for 60s via the Next.js fetch revalidation tag.
 */
export async function listBroadcastsByName(): Promise<Map<string, BroadcastInfo>> {
  const map = new Map<string, BroadcastInfo>();
  const key = process.env.RESEND_API_KEY;
  if (!key) return map;
  const res = await fetch(`${API}/broadcasts`, {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return map;
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name?: string;
      status: string;
      sent_at?: string | null;
      scheduled_at?: string | null;
      created_at?: string;
    }>;
  };
  for (const b of json.data ?? []) {
    if (!b.name) continue;
    map.set(b.name.trim().toLowerCase(), {
      id: b.id,
      status: b.status,
      sentAt: b.sent_at ?? null,
      scheduledAt: b.scheduled_at ?? null,
      createdAt: b.created_at ?? "",
    });
  }
  return map;
}

/**
 * Create a broadcast for a post, and (when status="confirmed") send it. Never
 * throws — returns { ok, id, sent | error }.
 */
export async function publishToResend(post: Post, opts: PublishOptions = {}): Promise<ResendResult> {
  const payload = buildBroadcastPayload(post);
  if (opts.dryRun) return { ok: true, dryRun: true, payload };

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Missing RESEND_API_KEY in env." };
  if (!process.env.RESEND_AUDIENCE_ID) return { ok: false, error: "Missing RESEND_AUDIENCE_ID in env." };

  try {
    const createRes = await fetch(`${API}/broadcasts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createJson = (await createRes.json().catch(() => ({}))) as { id?: string };
    if (!createRes.ok || !createJson.id) {
      return { ok: false, error: `Resend create ${createRes.status}: ${JSON.stringify(createJson).slice(0, 300)}`, payload };
    }
    const id = createJson.id;

    // status "draft" => created only (human sends in the dashboard).
    if ((opts.status ?? "draft") !== "confirmed") {
      return { ok: true, id, sent: false, payload };
    }

    const sendRes = await fetch(`${API}/broadcasts/${id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(opts.scheduledAt ? { scheduled_at: opts.scheduledAt } : {}),
    });
    if (!sendRes.ok) {
      const sendJson = await sendRes.json().catch(() => ({}));
      // The broadcast exists as a draft; surface the send failure but keep the id.
      return { ok: false, id, sent: false, error: `Resend send ${sendRes.status}: ${JSON.stringify(sendJson).slice(0, 300)}`, payload };
    }
    return { ok: true, id, sent: true, payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), payload };
  }
}

export interface SubscribeResult {
  ok: boolean;
  already?: boolean;
  error?: string;
}

/** Add (or re-activate) a contact in the audience. Used by /api/subscribe. */
export async function addContact(email: string): Promise<SubscribeResult> {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audienceId) return { ok: false, error: "Newsletter not configured." };

  try {
    const res = await fetch(`${API}/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), unsubscribed: false }),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
    // Resend returns a 4xx for an already-present contact — treat as success.
    if (res.status === 409 || /already|exist/i.test(json.message || json.name || "")) {
      return { ok: true, already: true };
    }
    return { ok: false, error: json.message || `Resend ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
