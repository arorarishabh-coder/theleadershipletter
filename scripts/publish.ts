/**
 * Publish posts to the newsletter (Resend Broadcasts).
 *
 * Usage:
 *   npm run publish -- --slug=<slug>            # create a Resend draft (for review)
 *   npm run publish -- --slug=<slug> --dry-run  # print the payload, no API call
 *   npm run publish -- --next                   # next un-published post (oldest first)
 *   npm run publish -- --slug=<slug> --confirm  # create AND send immediately
 *   npm run publish -- --slug=<slug> --schedule=2026-06-01T12:00:00Z
 *   npm run publish -- --slug=<slug> --html     # write standalone email HTML to content/outbox
 *
 * Defaults to a DRAFT broadcast — a human sends it from the Resend dashboard.
 * Requires RESEND_API_KEY + RESEND_AUDIENCE_ID (unless --dry-run / --html).
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { publishToResend } from "@/lib/publish/resend";
import type { Post } from "@/lib/types";

const CONTENT = path.join(process.cwd(), "content", "posts");

async function loadPost(slug: string): Promise<{ post: Post; file: string } | null> {
  const file = path.join(CONTENT, `${slug}.json`);
  try {
    return { post: JSON.parse(await fs.readFile(file, "utf8")) as Post, file };
  } catch {
    return null;
  }
}

async function nextUnpublished(): Promise<string | null> {
  const files = (await fs.readdir(CONTENT)).filter((f) => f.endsWith(".json"));
  const posts: Post[] = [];
  for (const f of files) {
    try {
      posts.push(JSON.parse(await fs.readFile(path.join(CONTENT, f), "utf8")) as Post);
    } catch {
      /* skip */
    }
  }
  const unpublished = posts
    .filter((p) => !p.resendBroadcastId)
    .sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""));
  return unpublished[0]?.slug ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => {
    const m = args.find((a) => a.startsWith(`--${k}=`));
    return m ? m.split("=").slice(1).join("=") : undefined;
  };
  const dryRun = args.includes("--dry-run");
  const status: "draft" | "confirmed" = args.includes("--confirm") ? "confirmed" : "draft";
  const scheduledAt = val("schedule");

  let slug = val("slug");
  if (!slug && args.includes("--next")) {
    slug = (await nextUnpublished()) ?? undefined;
    if (!slug) {
      console.log("No un-published posts.");
      process.exit(0);
    }
    console.log(`Next un-published: ${slug}`);
  }
  if (!slug) {
    console.error("Provide --slug=<slug> or --next.");
    process.exit(1);
  }

  const loaded = await loadPost(slug);
  if (!loaded) {
    console.error(`Post not found: ${slug}`);
    process.exit(1);
  }
  const { post, file } = loaded;

  // --html: write a standalone email HTML document (useful for preview or manual use).
  if (args.includes("--html")) {
    const { buildEmailDocument } = await import("@/lib/publish/resend");
    const outDir = path.join(process.cwd(), "content", "outbox");
    await fs.mkdir(outDir, { recursive: true });
    const out = path.join(outDir, `${post.slug}.html`);
    // track:false — a preview on disk shouldn't carry a pixel or an unrendered merge tag.
    await fs.writeFile(out, buildEmailDocument(post, process.env.SITE_URL || "", { track: false }), "utf8");
    console.log(`\nTitle:    ${post.title}`);
    console.log(`Subtitle: ${post.pullQuote}`);
    console.log(`HTML →    ${out}`);
    process.exit(0);
  }

  if (post.resendBroadcastId && !args.includes("--force")) {
    console.error(`Already published (resendBroadcastId=${post.resendBroadcastId}). Use --force to re-send.`);
    process.exit(1);
  }

  console.log(`\nPublishing "${post.title}" → Resend (${dryRun ? "DRY RUN" : status}${scheduledAt ? `, scheduled ${scheduledAt}` : ""})`);
  const result = await publishToResend(post, { status, scheduledAt, dryRun });

  if (dryRun) {
    console.log("\n--- payload ---");
    const p = result.payload as Record<string, unknown>;
    console.log(JSON.stringify({ ...p, html: `${String(p.html).slice(0, 600)}… [${String(p.html).length} chars]` }, null, 2));
    process.exit(0);
  }

  if (!result.ok) {
    console.error(`\nFAILED: ${result.error}`);
    process.exit(1);
  }
  // Record the broadcast id so we don't double-send.
  post.resendBroadcastId = result.id;
  if (result.sent) post.newsletterSentAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(post, null, 2), "utf8");
  console.log(`\nOK — Resend broadcast id: ${result.id}${result.sent ? " (SENT)" : " (draft — send it from the Resend dashboard)"}`);
}

main().catch((e) => {
  console.error("Publish crashed:", e);
  process.exit(1);
});
