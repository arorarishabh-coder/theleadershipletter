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

// ── ITE-style transcribed card ───────────────────────────────────────────────
// A clean, brand-styled reproduction of the correspondence — sender-labeled
// message bubbles for chat threads, or a From/To/Subject header + body for an
// email. Reads far better on LinkedIn/Twitter than a raw document screenshot,
// and it's our own transcription (within the fair-use cap), not the source image.

// Deterministic accent per distinct sender (ITE alternates two colors).
const SENDER_COLORS = ["#2f5db5", "#b5482f", "#1c7a52", "#7a4fb5"]; // blue, brick, green, violet

function senderColorMap(senders: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const s of senders) {
    const key = s.trim().toLowerCase();
    if (!map.has(key)) map.set(key, SENDER_COLORS[i++ % SENDER_COLORS.length]);
  }
  return map;
}

/**
 * Build a standalone ITE-style card (width 1080, natural height — render with a
 * full-page screenshot). Uses the post's messageThread when present (chat), else
 * falls back to an email header + excerpt body.
 */
export function buildMessageCardHtml(post: Post): string {
  const isThread = !!post.messageThread?.length;
  const turns = isThread
    ? post.messageThread!.map((t) => ({ sender: t.sender, text: t.text }))
    : [{ sender: post.authorsName.join(" & ") || post.authorsCompany || "—", text: post.excerptForBlog }];
  const colors = senderColorMap(turns.map((t) => t.sender));

  const turnsHtml = turns
    .map((t) => {
      const color = colors.get(t.sender.trim().toLowerCase()) || "#1c1a17";
      const body = esc(t.text).replace(/\n+/g, "<br/>");
      // Chat threads get a colored sender label per turn (the ITE look). A single
      // email needs no label — the From/To/Subject header already names the sender.
      const label = isThread ? `<div class="sender" style="color:${color}">${esc(t.sender)}</div>` : "";
      return `<div class="turn">${label}<div class="text">${body}</div></div>`;
    })
    .join("");

  // Email header block (skipped for chat threads).
  const emailHead = isThread
    ? `<div class="meta">${esc([post.authorsCompany, post.dateAuthored].filter(Boolean).join(" · "))}</div>`
    : `<div class="emailhead">
        <div><span class="hk">From:</span> ${esc(post.authorsName.join(", ") || post.authorsCompany)}</div>
        ${post.recipientNames?.length ? `<div><span class="hk">To:</span> ${esc(post.recipientNames.join(", "))}</div>` : ""}
        ${post.dateAuthored ? `<div><span class="hk">Sent:</span> ${esc(post.dateAuthored)}</div>` : ""}
        <div><span class="hk">Subject:</span> ${esc(post.documentTitle)}</div>
      </div>`;

  const citation = esc([post.sourceCase, post.sourceCitation].filter(Boolean).join(" · "));

  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:opsz@6..72&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e7e0d2; }
  .card { width:1080px; background:#f4efe6; color:#1c1a17; padding:70px 76px; }
  .masthead { display:flex; align-items:center; gap:18px; }
  .kicker { font-family:"JetBrains Mono",monospace; font-size:20px; letter-spacing:0.22em; text-transform:uppercase; color:#8a8378; }
  .rule { flex:1; height:2px; background:#b5482f; opacity:0.5; }
  .emailhead { margin-top:30px; font-family:"JetBrains Mono",monospace; font-size:24px; line-height:1.7; color:#3a352e; border-left:4px solid #b5482f; padding-left:22px; }
  .emailhead .hk { color:#8a8378; }
  .meta { margin-top:26px; font-family:"JetBrains Mono",monospace; font-size:20px; letter-spacing:0.06em; text-transform:uppercase; color:#8a8378; }
  .turns { margin-top:34px; }
  .turn { margin-bottom:30px; }
  .sender { font-family:"JetBrains Mono",monospace; font-weight:600; font-size:23px; letter-spacing:0.02em; margin-bottom:8px; }
  .text { font-family:"Newsreader",Georgia,serif; font-size:34px; line-height:1.42; color:#22201c; }
  .foot { margin-top:44px; padding-top:22px; border-top:1px solid #d6cdbb; display:flex; justify-content:space-between; gap:24px; font-family:"JetBrains Mono",monospace; font-size:17px; letter-spacing:0.06em; text-transform:uppercase; color:#8a8378; }
  .foot span:last-child { color:#b5482f; white-space:nowrap; }
</style></head>
<body><div class="card">
  <div class="masthead"><span class="kicker">The Leadership Letter</span><span class="rule"></span></div>
  ${emailHead}
  <div class="turns">${turnsHtml}</div>
  <div class="foot"><span>${citation}</span><span>theleadershipletter.com</span></div>
</div></body></html>`;
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
