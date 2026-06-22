/**
 * Build a LinkedIn-ready carousel PDF for a post — branded (The Leadership
 * Letter's parchment + serif look), 1080×1350 portrait, one slide per page.
 * Slide 2 embeds the REAL source-document screenshot ("The document") so the
 * carousel carries the visual proof, not just text. Upload via LinkedIn
 * "Start a post" → Add a document.
 *
 *   npx tsx scripts/carousel-pdf.ts                 # today's edition
 *   npx tsx scripts/carousel-pdf.ts --slug=<slug>   # a specific post
 *
 * Output: carousels/<slug>.pdf  (also prints the absolute path + doc title).
 * Needs ANTHROPIC_API_KEY + CHROME_PATH (auto-detected).
 */

import "dotenv/config";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import type { Post } from "@/lib/types";
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

type Item = { kind: "text"; raw: string } | { kind: "image"; src: string; caption: string };

// Split a model slide into a headline (first non-empty line) + body lines.
function parseSlide(raw: string): { head: string; body: string[] } {
  const lines = raw.split("\n").map((l) => l.trim());
  const cleaned = lines.filter((l, i) => !(i === lines.length - 1 && /^[—-]\s*the leadership letter/i.test(l)));
  const firstIdx = cleaned.findIndex((l) => l.length > 0);
  const head = firstIdx >= 0 ? cleaned[firstIdx] : "";
  const body = cleaned.slice(firstIdx + 1);
  return { head, body };
}

function footHtml(i: number, total: number, isLast: boolean): string {
  return `<div class="foot">
    <span>${isLast ? "theleadershipletter.com" : `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}</span>
    <span>${isLast ? "Subscribe free →" : "theleadershipletter.com"}</span>
  </div>`;
}

function textSlideHtml(raw: string, i: number, total: number, isLast: boolean): string {
  const { head, body } = parseSlide(raw);
  const bodyHtml = body
    .map((l) => (l === "" ? '<div style="height:18px"></div>' : `<p class="body">${esc(l)}</p>`))
    .join("");
  return `<section class="slide${isLast ? " last" : ""}">
    <div class="top"><div class="kicker">The Leadership Letter</div><div class="rule"></div></div>
    <div class="content"><h1 class="head">${esc(head)}</h1>${bodyHtml}</div>
    ${footHtml(i, total, isLast)}
  </section>`;
}

function imageSlideHtml(src: string, caption: string, i: number, total: number): string {
  return `<section class="slide">
    <div class="top"><div class="kicker">The document</div><div class="rule"></div></div>
    <div class="docwrap"><img class="docimg" src="${src}" alt="source document"/></div>
    <div class="doccap">${esc(caption)}</div>
    ${footHtml(i, total, false)}
  </section>`;
}

function doc(items: Item[]): string {
  const total = items.length;
  const body = items
    .map((it, i) =>
      it.kind === "text" ? textSlideHtml(it.raw, i, total, i === total - 1) : imageSlideHtml(it.src, it.caption, i, total),
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:opsz@6..72&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { margin: 0; size: 1080px 1350px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f4efe6; }
  .slide { width:1080px; height:1350px; background:#f4efe6; color:#1c1a17; padding:90px 96px; display:flex; flex-direction:column; justify-content:space-between; page-break-after:always; overflow:hidden; }
  .slide.last { background:#1c1a17; color:#f4efe6; }
  .kicker { font-family:"JetBrains Mono",monospace; font-size:22px; letter-spacing:0.22em; text-transform:uppercase; color:#8a8378; }
  .slide.last .kicker { color:#b08a6a; }
  .rule { margin-top:18px; height:3px; width:96px; background:#b5482f; }
  .content { flex:1; display:flex; flex-direction:column; justify-content:center; padding:40px 0; }
  .head { font-family:"Fraunces",Georgia,serif; font-weight:500; font-size:76px; line-height:1.04; letter-spacing:-0.02em; }
  .slide.last .head { font-size:64px; }
  .body { font-family:"Newsreader",Georgia,serif; font-size:38px; line-height:1.42; margin-top:22px; color:#3a352e; }
  .slide.last .body { color:#d9d2c4; }
  .docwrap { flex:1; display:flex; align-items:center; justify-content:center; padding:34px 0 18px; }
  .docimg { max-width:100%; max-height:850px; border:1px solid #d6cdbb; background:#fff; box-shadow:0 6px 30px rgba(28,26,23,0.10); }
  .doccap { font-family:"JetBrains Mono",monospace; font-size:18px; letter-spacing:0.06em; text-transform:uppercase; color:#8a8378; text-align:center; line-height:1.5; }
  .foot { display:flex; justify-content:space-between; font-family:"JetBrains Mono",monospace; font-size:20px; letter-spacing:0.12em; text-transform:uppercase; color:#8a8378; }
  .slide.last .foot { color:#b08a6a; }
</style></head><body>${body}</body></html>`;
}

/** Read the source-document screenshot as a base64 data URI, if it exists locally. */
function docImageItem(post: Post): Item | null {
  const shot = post.screenshots?.[0];
  if (!shot || shot.url.includes("_pending")) return null;
  const localPath = join(process.cwd(), "public", shot.url.replace(/^\//, ""));
  if (!existsSync(localPath)) return null;
  const b64 = readFileSync(localPath).toString("base64");
  const caption = [post.authorsName.join(" & "), post.authorsCompany, post.sourceCase].filter(Boolean).join(" · ");
  return { kind: "image", src: `data:image/png;base64,${b64}`, caption };
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

  // Slide order: hook → [real document screenshot] → remaining text slides.
  const img = docImageItem(post);
  const items: Item[] = [{ kind: "text", raw: slides[0] }];
  if (img) items.push(img);
  for (const s of slides.slice(1)) items.push({ kind: "text", raw: s });
  console.log(`  ${items.length} slides${img ? " (incl. embedded document image)" : " (no local image found)"}`);
  console.log(`  LinkedIn doc title (${drafts.carouselTitle.length}/58): "${drafts.carouselTitle}"`);

  mkdirSync(join(process.cwd(), "carousels"), { recursive: true });
  const out = join(process.cwd(), "carousels", `${slug}.pdf`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(doc(items), { waitUntil: "networkidle0" });
    await page.evaluate(() => (document as any).fonts?.ready);
    await page.pdf({ path: out, width: "1080px", height: "1350px", printBackground: true });
  } finally {
    await browser.close();
  }
  console.log(`\n✓ PDF ready: ${out}`);
}

main().catch((e) => { console.error("ERR:", e?.message || e); process.exit(1); });
