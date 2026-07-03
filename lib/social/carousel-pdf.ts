/**
 * Shared renderer for the LinkedIn "document" (carousel) PDF — branded to The
 * Leadership Letter, 1080×1350 portrait, one slide per page. Pure string
 * building only (no puppeteer, no fs): callers supply the slide text, the
 * document-image data URI, and drive an actual browser to print the HTML.
 *
 * Used by both scripts/carousel-pdf.ts (CLI, local Chrome) and
 * app/api/admin/social-pdf (admin download, serverless Chromium).
 */
import type { Post } from "@/lib/types";

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

/** Caption for the embedded document slide: "Author · Company · Case". */
export function documentCaption(post: Post): string {
  return [post.authorsName.join(" & "), post.authorsCompany, post.sourceCase].filter(Boolean).join(" · ");
}

/**
 * Build the full carousel HTML. Slide order: hook (slides[0]) → [real document
 * screenshot, if imageDataUri given] → remaining text slides.
 *
 * @param post          source post (for the document-slide caption)
 * @param slides        the model-generated carousel slide texts
 * @param imageDataUri  base64 data: URI of the source-document screenshot, or null to omit
 */
export function buildCarouselHtml(post: Post, slides: string[], imageDataUri: string | null): string {
  if (!slides.length) throw new Error("no carousel slides");
  const items: Item[] = [{ kind: "text", raw: slides[0] }];
  if (imageDataUri) items.push({ kind: "image", src: imageDataUri, caption: documentCaption(post) });
  for (const s of slides.slice(1)) items.push({ kind: "text", raw: s });
  return doc(items);
}
