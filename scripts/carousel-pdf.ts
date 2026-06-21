/**
 * Build a LinkedIn-ready carousel PDF for a post — branded (The Leadership
 * Letter's parchment + serif look), 1080×1350 portrait, one slide per page.
 * Upload the PDF via LinkedIn "Start a post" → Add a document.
 *
 *   npx tsx scripts/carousel-pdf.ts                 # today's edition
 *   npx tsx scripts/carousel-pdf.ts --slug=<slug>   # a specific post
 *
 * Output: carousels/<slug>.pdf  (also prints the absolute path).
 * Needs ANTHROPIC_API_KEY + CHROME_PATH (auto-detected).
 */

import "dotenv/config";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { getPostBySlug, getAllPosts } from "@/lib/queries";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";
import { generateSocialDrafts } from "@/lib/social/draft";

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Split a model slide into a headline (first non-empty line) + body lines,
// dropping any trailing "— The Leadership Letter" the model may add.
function parseSlide(raw: string): { head: string; body: string[] } {
  const lines = raw.split("\n").map((l) => l.trim());
  const cleaned = lines.filter((l, i) => !(i === lines.length - 1 && /^[—-]\s*the leadership letter/i.test(l)));
  const firstIdx = cleaned.findIndex((l) => l.length > 0);
  const head = firstIdx >= 0 ? cleaned[firstIdx] : "";
  const body = cleaned.slice(firstIdx + 1);
  return { head, body };
}

function slideHtml(raw: string, i: number, total: number, isLast: boolean): string {
  const { head, body } = parseSlide(raw);
  const bodyHtml = body
    .map((l) => (l === "" ? '<div style="height:18px"></div>' : `<p class="body">${esc(l)}</p>`))
    .join("");
  return `<section class="slide${isLast ? " last" : ""}">
    <div class="top">
      <div class="kicker">The Leadership Letter</div>
      <div class="rule"></div>
    </div>
    <div class="content">
      <h1 class="head">${esc(head)}</h1>
      ${bodyHtml}
    </div>
    <div class="foot">
      <span>${isLast ? "theleadershipletter.com" : `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}</span>
      <span>${isLast ? "Subscribe free →" : "theleadershipletter.com"}</span>
    </div>
  </section>`;
}

function doc(slides: string[]): string {
  const total = slides.length;
  const body = slides.map((s, i) => slideHtml(s, i, total, i === total - 1)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:opsz@6..72&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { margin: 0; size: 1080px 1350px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f4efe6; }
  .slide {
    width: 1080px; height: 1350px; background: #f4efe6; color: #1c1a17;
    padding: 90px 96px; display: flex; flex-direction: column; justify-content: space-between;
    page-break-after: always; overflow: hidden; position: relative;
  }
  .slide.last { background: #1c1a17; color: #f4efe6; }
  .top { }
  .kicker { font-family: "JetBrains Mono", monospace; font-size: 22px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8378; }
  .slide.last .kicker { color: #b08a6a; }
  .rule { margin-top: 18px; height: 3px; width: 96px; background: #b5482f; }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
  .head { font-family: "Fraunces", Georgia, serif; font-weight: 500; font-size: 76px; line-height: 1.04; letter-spacing: -0.02em; }
  .slide.last .head { font-size: 64px; }
  .body { font-family: "Newsreader", Georgia, serif; font-size: 38px; line-height: 1.42; margin-top: 22px; color: #3a352e; }
  .slide.last .body { color: #d9d2c4; }
  .cta { font-family: "Newsreader", Georgia, serif; font-style: italic; font-size: 36px; line-height: 1.4; margin-top: 44px; color: #f4efe6; border-top: 2px solid #b5482f; padding-top: 28px; }
  .foot { display: flex; justify-content: space-between; font-family: "JetBrains Mono", monospace; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8378; }
  .slide.last .foot { color: #b08a6a; }
</style></head><body>${body}</body></html>`;
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
  console.log(`  ${slides.length} slides`);

  mkdirSync(join(process.cwd(), "carousels"), { recursive: true });
  const out = join(process.cwd(), "carousels", `${slug}.pdf`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(doc(slides), { waitUntil: "networkidle0" });
    await page.evaluate(() => (document as any).fonts?.ready);
    await page.pdf({ path: out, width: "1080px", height: "1350px", printBackground: true });
  } finally {
    await browser.close();
  }
  console.log(`\n✓ PDF ready: ${out}`);
}

main().catch((e) => { console.error("ERR:", e?.message || e); process.exit(1); });
