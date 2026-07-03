/**
 * Build a LinkedIn-ready carousel PDF for a post — branded (The Leadership
 * Letter's parchment + serif look), 1080×1350 portrait, one slide per page.
 * Slide 2 embeds the REAL source-document screenshot ("The document"). Upload
 * via LinkedIn "Start a post" → Add a document.
 *
 * This is the CLI twin of the /admin/social "Download LinkedIn PDF" button;
 * both share lib/social/carousel-pdf.ts (HTML) + lib/pdf/launch.ts (render).
 *
 *   npx tsx scripts/carousel-pdf.ts                 # today's edition
 *   npx tsx scripts/carousel-pdf.ts --slug=<slug>   # a specific post
 *
 * Output: carousels/<slug>.pdf  (also prints the absolute path + doc title).
 */

import "dotenv/config";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Post } from "@/lib/types";
import { getPostBySlug, getAllPosts } from "@/lib/queries";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";
import { generateSocialDrafts } from "@/lib/social/draft";
import { buildCarouselHtml } from "@/lib/social/carousel-pdf";
import { renderHtmlToPdf } from "@/lib/pdf/launch";

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}

/** Read the source-document screenshot from disk as a base64 data URI, if present. */
function localDocImage(post: Post): string | null {
  const shot = post.screenshots?.[0];
  if (!shot || shot.url.includes("_pending")) return null;
  const localPath = join(process.cwd(), "public", shot.url.replace(/^\//, ""));
  if (!existsSync(localPath)) return null;
  return `data:image/png;base64,${readFileSync(localPath).toString("base64")}`;
}

async function main() {
  const slug = arg("slug") || (await getMostRecentBroadcastSlug()) || getAllPosts()[0]?.slug;
  if (!slug) throw new Error("no slug");
  const post = getPostBySlug(slug);
  if (!post) throw new Error(`post not found: ${slug}`);

  console.log(`Generating carousel for: ${slug} — "${post.title}"`);
  const drafts = await generateSocialDrafts(post);
  const slides = drafts.linkedinCarousel.slides;
  if (!slides.length) throw new Error("no carousel slides generated");

  const img = localDocImage(post);
  console.log(`  ${slides.length + (img ? 1 : 0)} slides${img ? " (incl. embedded document image)" : " (no local image found)"}`);
  console.log(`  LinkedIn doc title (${drafts.carouselTitle.length}/58): "${drafts.carouselTitle}"`);

  const html = buildCarouselHtml(post, slides, img);
  const pdf = await renderHtmlToPdf(html);

  mkdirSync(join(process.cwd(), "carousels"), { recursive: true });
  const out = join(process.cwd(), "carousels", `${slug}.pdf`);
  writeFileSync(out, pdf);
  console.log(`\n✓ PDF ready: ${out}`);
}

main().catch((e) => { console.error("ERR:", e?.message || e); process.exit(1); });
