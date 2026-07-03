/**
 * Source-document screenshot pipeline.
 *
 * Every published post should show the actual source document — visual proof of
 * provenance and the most shareable element of the page. For PDFs (court exhibits,
 * SEC filings) we rasterize the page(s) with MuPDF (WASM — no native build, and it
 * handles scanned/image PDFs that canvas-based renderers choke on) and optimize
 * with sharp. For web sources (self-published letters, press articles) we
 * screenshot the page with a headless browser. Capture is an ENHANCEMENT, not a
 * blocker: if it fails, the post still publishes with the "view original" link.
 *
 * Output: public/screenshots/{id}-p{n}.png, served at /screenshots/{id}-p{n}.png.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { PostScreenshot } from "@/lib/types";
import { claude, MODELS } from "@/lib/anthropic";

// Dynamic import that survives tsx/esbuild: when this module is loaded through the
// graph it can become a `data:` URL, and a bare-specifier dynamic import then
// fails to resolve. Fall back to resolving the package on disk + importing the
// file URL. (Same fix as lib/ingest/fetch.ts for pdfjs.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynImport(specifier: string): Promise<any> {
  try {
    return await import(specifier);
  } catch {
    const { createRequire } = await import("node:module");
    const { pathToFileURL } = await import("node:url");
    const req = createRequire(path.join(process.cwd(), "package.json"));
    return await import(pathToFileURL(req.resolve(specifier)).href);
  }
}

// MuPDF (WASM) ships with top-level await; load dynamically (memoized).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mupdfPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMupdf(): Promise<any> {
  if (!mupdfPromise) mupdfPromise = dynImport("mupdf");
  return mupdfPromise;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "public", "screenshots");
const MAX_PAGES = 2; // max CONTENT pages to keep
const SCAN_PAGES = 6; // scan up to this many leading pages looking for content
const RENDER_SCALE = 2.0; // 2x for crisp text
const TARGET_WIDTH = 1100;

const PAGE_CLASSIFY_PROMPT = `You are screening ONE page from a court/legal or business source document. The newsletter reproduces real corporate correspondence, so be INCLUSIVE — keep anything a reader might want.

Answer "CONTENT" if the page contains ANY readable document substance: an email (even just From/To/Subject headers, even if the body is redacted, abridged, or short), a letter, a memo, a message/chat thread, body text, a report or filing section, a table or financial figures, slides, or handwritten notes.

Answer "SKIP" ONLY when the page is essentially nothing but a divider: it contains ONLY an exhibit/cover label such as "EXHIBIT G" or "PLAINTIFF'S EXHIBIT PX-1234" (and nothing else), OR it is entirely blank, OR it is purely a certificate of service.

When in doubt, answer CONTENT. Reply with only the word CONTENT or SKIP.`;

/**
 * Is this rendered page real correspondence/content (true) or a cover sheet,
 * exhibit divider, or blank page (false)? Uses a cheap Haiku vision call. Soft
 * guard: if classification is unavailable or errors, returns true so we never
 * silently drop genuine content.
 */
async function isContentPage(png: Buffer, id: string, sourcePage: number): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return true;
  try {
    const small = await sharp(png).resize({ width: 768, withoutEnlargement: true }).png().toBuffer();
    const res = await claude.messages.create({
      model: MODELS.triage,
      max_tokens: 8,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: small.toString("base64") } },
            { type: "text", text: PAGE_CLASSIFY_PROMPT },
          ],
        },
      ],
    });
    const block = res.content[0];
    const verdict = block?.type === "text" ? block.text.trim().toUpperCase() : "";
    const keep = !verdict.startsWith("SKIP");
    if (process.env.SHOT_DEBUG) console.error(`[classify ${id} src-p${sourcePage}] ${verdict || "(empty)"} -> ${keep ? "keep" : "skip"}`);
    return keep;
  } catch (e) {
    if (process.env.SHOT_DEBUG) console.error(`[classify ${id} src-p${sourcePage}]`, e instanceof Error ? e.message : e);
    return true; // on error, keep — don't drop possibly-real content
  }
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  // SEC and some gov sites require a contact (From) header for fair-access.
  const r = await fetch(url, {
    headers: { "User-Agent": UA, From: "research@corporateletters.example.com" },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function isPdf(data: Uint8Array): boolean {
  return data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46; // %PDF
}

async function ensureDir() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
}

/**
 * Rasterize a PDF to optimized PNGs on disk via MuPDF — but only the pages that
 * actually contain correspondence/content. Scans up to SCAN_PAGES leading pages,
 * skips cover/divider/blank pages (e.g. an "Exhibit G" sheet), and writes the
 * kept content pages re-indexed sequentially as {id}-p1.png, {id}-p2.png …
 * Returns the displayed page numbers (empty if nothing readable was found).
 */
async function renderPdf(
  data: Uint8Array,
  id: string,
  maxPages = MAX_PAGES,
  pageRange?: [number, number],
): Promise<number[]> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(data, "application/pdf");
  await ensureDir();
  const total = doc.countPages();
  // Default: scan the first SCAN_PAGES leading pages (cover/divider pruning).
  // With an explicit pageRange (1-indexed, inclusive) — e.g. one email inside a
  // 346-page exhibit compilation — scan only that window instead of pages 0–5.
  const startIdx = pageRange ? Math.max(0, pageRange[0] - 1) : 0;
  const endExclusive = pageRange ? Math.min(total, pageRange[1]) : Math.min(total, SCAN_PAGES);
  const kept: Buffer[] = [];
  let skipped = 0;
  for (let i = startIdx; i < endExclusive && kept.length < maxPages; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE),
      mupdf.ColorSpace.DeviceRGB,
      false, // no alpha — white background
    );
    const png = pixmap.asPNG();
    pixmap.destroy?.();
    page.destroy?.();
    const optimized = await sharp(Buffer.from(png))
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();
    if (await isContentPage(optimized, id, i + 1)) kept.push(optimized);
    else skipped += 1;
  }
  const pages: number[] = [];
  for (let k = 0; k < kept.length; k++) {
    await fs.promises.writeFile(path.join(OUT_DIR, `${id}-p${k + 1}.png`), kept[k]);
    pages.push(k + 1);
  }
  if (process.env.SHOT_DEBUG) console.error(`[renderPdf ${id}] scanned=${startIdx + 1}..${endExclusive} kept=${pages.length} skipped=${skipped}`);
  return pages;
}

function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p));
}

/** Screenshot a web page with a headless browser. Returns true on success. */
async function renderWebPage(url: string, id: string): Promise<boolean> {
  const exe = findChrome();
  if (!exe) return false;
  const puppeteer = (await dynImport("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    // A real UA (not "HeadlessChrome") + domcontentloaded — networkidle never
    // settles on some gov sites (SEC), and the default UA can be blocked.
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1200, height: 1500, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500)); // brief settle for layout
    const buf = await page.screenshot({ type: "png" });
    await ensureDir();
    const optimized = await sharp(buf as Buffer)
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();
    await fs.promises.writeFile(path.join(OUT_DIR, `${id}-web.png`), optimized);
    return true;
  } finally {
    await browser.close();
  }
}

export interface CaptureMeta {
  documentTitle: string;
  sourceCitation: string;
}

/**
 * Capture screenshot(s) of a source document. Detects PDF vs web, renders, and
 * returns PostScreenshot[] ready to attach to the post. Never throws — returns []
 * on failure so the pipeline can fall back to a placeholder.
 */
export async function captureSourceScreenshots(
  url: string,
  id: string,
  meta: CaptureMeta,
  pageRange?: [number, number],
): Promise<PostScreenshot[]> {
  try {
    const data = await fetchBytes(url);
    if (isPdf(data)) {
      const pages = await renderPdf(data, id, MAX_PAGES, pageRange);
      if (pages.length === 0) return [];
      return pages.map((p) => ({
        url: `/screenshots/${id}-p${p}.png`,
        caption:
          pages.length > 1
            ? `Source document — ${meta.documentTitle} · ${meta.sourceCitation} (page ${p})`
            : `Source document — ${meta.documentTitle} · ${meta.sourceCitation}`,
        alt: `${meta.documentTitle} — page ${p}`,
      }));
    }
    // Not a PDF — screenshot the web page.
    const ok = await renderWebPage(url, id);
    if (!ok) return [];
    return [
      {
        url: `/screenshots/${id}-web.png`,
        caption: `Source document — ${meta.documentTitle} · ${meta.sourceCitation}`,
        alt: `${meta.documentTitle} (source page)`,
      },
    ];
  } catch (e) {
    if (process.env.SHOT_DEBUG) console.error(`[screenshot ${id}]`, e instanceof Error ? e.message : e);
    return [];
  }
}
