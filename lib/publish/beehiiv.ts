/**
 * Beehiiv publish adapter — turns a generated Post into a newsletter.
 *
 * Beehiiv is the delivery + monetization layer: each daily post is pushed as a
 * Beehiiv post (which is both the email send and the web archive entry). We
 * default to status "draft" so a human approves before it sends — the gate is
 * good but not infallible, and a daily send is irreversible.
 *
 * Create Post API: POST https://api.beehiiv.com/v2/publications/{id}/posts
 *   Auth: Bearer BEEHIIV_API_KEY · body_content = raw HTML (no <style>/<link>;
 *   inline styles only) · status draft|confirmed · scheduled_at ISO8601.
 *
 * Requires BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID. SITE_URL makes the source
 * screenshot resolve in the email (needs the site deployed).
 */

import type { Post } from "@/lib/types";

const API = "https://api.beehiiv.com/v2";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Convert the lesson markdown (#/##/###/####, lists, > quotes, **bold**) to HTML. */
export function lessonToHtml(md: string): string {
  // Same heading-normalization as the on-site renderer: make each heading its own block.
  const normalized = md.replace(/^[ \t]*(#{1,4}\s[^\n]*)$/gm, "\n$1\n");
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.startsWith("#### ")) out.push(`<h4>${inline(block.slice(5).trim())}</h4>`);
    else if (block.startsWith("### ")) out.push(`<h3>${inline(block.slice(4).trim())}</h3>`);
    else if (block.startsWith("## ")) out.push(`<h2>${inline(block.slice(3).trim())}</h2>`);
    else if (block.startsWith("# ")) out.push(`<h2>${inline(block.slice(2).trim())}</h2>`);
    else if (block.startsWith("> ")) {
      const text = block.split("\n").map((l) => l.replace(/^>\s?/, "")).join(" ");
      out.push(`<blockquote>${inline(text)}</blockquote>`);
    } else if (/^(\d+\.|[-*])\s/.test(block)) {
      const ordered = /^\d+\./.test(block);
      const items = block.split("\n").map((l) => `<li>${inline(l.replace(/^(\d+\.|[-*])\s+/, ""))}</li>`).join("");
      out.push(ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`);
    } else {
      out.push(`<p>${inline(block)}</p>`);
    }
  }
  return out.join("\n");
}

/** Assemble the full newsletter HTML body for a post. */
export function buildPostHtml(post: Post, siteUrl = ""): string {
  const shot = post.screenshots?.[0];
  const imgHtml =
    shot && !shot.url.includes("_pending") && siteUrl
      ? `<figure style="margin:24px 0"><img src="${siteUrl}${shot.url}" alt="${esc(shot.alt)}" style="width:100%;height:auto;border:1px solid #ddd"/><figcaption style="font-size:12px;color:#777;margin-top:6px">${esc(shot.caption)}</figcaption></figure>`
      : "";
  const excerptParas = post.excerptForBlog
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 10px"><em>${esc(p)}</em></p>`)
    .join("");
  const excerptHtml = `<blockquote style="border-left:3px solid #b5482f;padding:4px 0 4px 16px;color:#333;margin:24px 0">${excerptParas}</blockquote>`;
  const byline = `<p style="font-size:13px;color:#777">${esc(post.authorsName.join(" & "))} · ${esc(post.authorsCompany)}${post.recipientNames.length ? ` · to ${esc(post.recipientNames.join(", "))}` : ""} · ${esc(post.dateAuthored)}</p>`;
  const provenance = `<hr style="margin:28px 0;border:none;border-top:1px solid #ddd"/><p style="font-size:13px;color:#777"><strong>How this surfaced:</strong> ${esc(post.sourceCase)} · ${esc(post.sourceCitation)}${post.sourceUrl ? ` · <a href="${esc(post.sourceUrl)}">view original source</a>` : ""}</p>`;

  // Labeled section header for the email (mirrors the on-site analysis blocks).
  const label = (text: string) =>
    `<h3 style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;margin:28px 0 6px;">${text}</h3>`;

  // Three lean sections replace the old dense body. A Notable Artifact has no
  // lesson (no situation/insight/application) — render its factual "why this
  // matters" note instead so the email is never analysis-less. Otherwise fall back
  // to the legacy lessonBody for any post not yet migrated to the structured format.
  const analysis = post.situation && post.insight && post.application
    ? [
        label("The situation"), lessonToHtml(post.situation),
        label("The lesson"), lessonToHtml(post.insight),
        label("Put it to work"), lessonToHtml(post.application),
      ].join("\n")
    : post.postKind === "artifact" && post.artifactNote
      ? [label("Why this matters"), lessonToHtml(post.artifactNote)].join("\n")
      : lessonToHtml(post.lessonBody ?? "");

  return [byline, imgHtml, label("The document"), excerptHtml, analysis, provenance].join("\n");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export interface BeehiivResult {
  ok: boolean;
  dryRun?: boolean;
  id?: string;
  error?: string;
  payload?: Record<string, unknown>;
}

export interface PublishOptions {
  status?: "draft" | "confirmed";
  scheduledAt?: string; // ISO 8601
  dryRun?: boolean;
}

export function buildBeehiivPayload(post: Post, opts: PublishOptions = {}): Record<string, unknown> {
  const siteUrl = process.env.SITE_URL || "";
  const tags = Array.from(
    new Set([...post.topics, ...post.leaderSlugs, slugify(post.authorsCompany)].filter(Boolean)),
  );
  return {
    title: post.title,
    subtitle: post.pullQuote,
    body_content: buildPostHtml(post, siteUrl),
    status: opts.status ?? "draft",
    ...(opts.scheduledAt ? { scheduled_at: opts.scheduledAt } : {}),
    content_tags: tags,
    web_settings: { slug: post.slug },
    seo_settings: { meta_title: post.title, meta_description: post.pullQuote },
  };
}

/**
 * The set of already-published identities on Beehiiv ("slug:<slug>" and
 * "title:<lowercased title>"), used to dedup so the daily cron sends each post
 * once without needing our own database — Beehiiv is the source of truth.
 */
export async function listPublishedIdentities(): Promise<Set<string>> {
  const ids = new Set<string>();
  const key = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pubId) return ids;
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 25) {
    const res = await fetch(`${API}/publications/${pubId}/posts?limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) break;
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ slug?: string; title?: string }>;
      total_pages?: number;
    };
    for (const p of json.data ?? []) {
      if (p.slug) ids.add(`slug:${p.slug}`);
      if (p.title) ids.add(`title:${p.title.trim().toLowerCase()}`);
    }
    totalPages = json.total_pages ?? 1;
    page += 1;
  }
  return ids;
}

/** Has this post already been published to Beehiiv (by slug or title)? */
export function isPublished(post: Post, published: Set<string>): boolean {
  return published.has(`slug:${post.slug}`) || published.has(`title:${post.title.trim().toLowerCase()}`);
}

/** Publish a post to Beehiiv. Never throws — returns { ok, id|error }. */
export async function publishToBeehiiv(post: Post, opts: PublishOptions = {}): Promise<BeehiivResult> {
  const payload = buildBeehiivPayload(post, opts);
  if (opts.dryRun) return { ok: true, dryRun: true, payload };

  const key = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pubId) {
    return { ok: false, error: "Missing BEEHIIV_API_KEY / BEEHIIV_PUBLICATION_ID in env." };
  }
  try {
    const res = await fetch(`${API}/publications/${pubId}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
    if (!res.ok) {
      return { ok: false, error: `Beehiiv ${res.status}: ${JSON.stringify(json).slice(0, 300)}`, payload };
    }
    return { ok: true, id: json.data?.id, payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), payload };
  }
}
