/**
 * OCR / transcription for scanned-image court exhibits.
 *
 * Many court exhibits are scanned images, so pdfjs text extraction returns only
 * the page-stamp boilerplate (see lib/ingest/fetch.ts). For those, we send the
 * PDF to a Claude vision model and have it transcribe the correspondence
 * verbatim. The transcription is our OWN work product derived from the
 * public-record PDF — not CourtListener's CC BY-ND extracted text — so it is
 * free to republish.
 *
 * Requires ANTHROPIC_API_KEY. Not run in --dry-run.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { claude, MODELS } from "@/lib/anthropic";
import { TRANSCRIPTION_INSTRUCTION, TRANSCRIPTION_SYSTEM } from "@/lib/prompts/transcribe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynImport: (m: string) => Promise<any> = (m) => import(/* webpackIgnore: true */ m);

const USER_AGENT =
  "CorporateLettersResearchBot/0.1 (+research@corporateletters.example.com) editorial-ocr";

// Anthropic accepts PDFs up to ~32MB / 100 pages per request. Stay comfortably under.
const MAX_PDF_BYTES = 28 * 1024 * 1024;
// When a pageRange is given we rasterize just those pages and send them as
// images (bypasses the whole-PDF size/page caps). Cap the image count for cost.
const MAX_RANGE_PAGES = 12;
const RANGE_RENDER_SCALE = 2.0;

export interface OcrResult {
  ok: boolean;
  text?: string;
  model?: string;
  bytes?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

/** Fetch a PDF and base64-encode it; validates it is actually a PDF and under the size cap. */
async function fetchPdfBase64(
  url: string,
): Promise<{ base64: string; bytes: number } | { error: string }> {
  let r: Response;
  try {
    r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/pdf,*/*" },
      redirect: "follow",
    });
  } catch (e) {
    return { error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!r.ok) return { error: `HTTP ${r.status}` };

  const buf = await r.arrayBuffer();
  const bytes = buf.byteLength;
  if (bytes > MAX_PDF_BYTES) {
    return { error: `PDF too large for single-request OCR (${bytes} bytes > ${MAX_PDF_BYTES})` };
  }
  const head = new Uint8Array(buf, 0, Math.min(5, bytes));
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  if (!isPdf) return { error: "Resource is not a PDF; cannot OCR" };

  return { base64: Buffer.from(buf).toString("base64"), bytes };
}

/** Fetch a PDF's raw bytes with no size cap (used for local page-range rasterization). */
async function fetchPdfBytes(url: string): Promise<Uint8Array | { error: string }> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/pdf,*/*" },
      redirect: "follow",
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    return { error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Rasterize a 1-indexed inclusive page range to base64 PNGs via MuPDF. Lets us
 * OCR one email inside a huge multi-exhibit compilation without shipping (or
 * hitting the size cap on) the whole PDF.
 */
async function renderRangeToPngs(
  bytes: Uint8Array,
  pageRange: [number, number],
): Promise<{ pngs: string[]; totalPages: number }> {
  const mupdf = await dynImport("mupdf");
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  const totalPages: number = doc.countPages();
  const start = Math.max(1, pageRange[0]);
  const end = Math.min(totalPages, pageRange[1]);
  const pngs: string[] = [];
  for (let i = start; i <= end && pngs.length < MAX_RANGE_PAGES; i++) {
    const page = doc.loadPage(i - 1);
    const pix = page.toPixmap(mupdf.Matrix.scale(RANGE_RENDER_SCALE, RANGE_RENDER_SCALE), mupdf.ColorSpace.DeviceRGB, false);
    pngs.push(Buffer.from(pix.asPNG()).toString("base64"));
    pix.destroy?.();
    page.destroy?.();
  }
  return { pngs, totalPages };
}

/**
 * Transcribe a (likely scanned) PDF to verbatim plain text via a Claude vision model.
 * Returns the transcription text plus token usage. Does not throw — failures come
 * back as { ok: false, error }.
 *
 * With `pageRange` (1-indexed, inclusive) it rasterizes only those pages and sends
 * them as images — the way to transcribe a single email inside a 300+ page exhibit
 * compilation without tripping the whole-PDF size/page caps.
 */
export async function transcribePdf(
  url: string,
  opts: { model?: string; pageRange?: [number, number] } = {},
): Promise<OcrResult> {
  const model = opts.model ?? MODELS.enrich; // Sonnet: strong vision, reasonable cost

  let content: Anthropic.ContentBlockParam[];
  let bytesForResult: number | undefined;

  if (opts.pageRange) {
    const raw = await fetchPdfBytes(url);
    if ("error" in raw) return { ok: false, error: raw.error };
    bytesForResult = raw.byteLength;
    const { pngs } = await renderRangeToPngs(raw, opts.pageRange);
    if (pngs.length === 0) return { ok: false, error: "no pages rendered for range" };
    content = [
      ...pngs.map(
        (b64): Anthropic.ContentBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: b64 },
        }),
      ),
      { type: "text", text: TRANSCRIPTION_INSTRUCTION },
    ];
  } else {
    const fetched = await fetchPdfBase64(url);
    if ("error" in fetched) return { ok: false, error: fetched.error };
    bytesForResult = fetched.bytes;
    content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fetched.base64 },
      },
      { type: "text", text: TRANSCRIPTION_INSTRUCTION },
    ];
  }

  try {
    const res = await claude.messages.create({
      model,
      max_tokens: 8192,
      system: TRANSCRIPTION_SYSTEM,
      messages: [{ role: "user", content }],
    });
    const block = res.content[0];
    const text = block?.type === "text" ? block.text.trim() : "";
    return {
      ok: text.length > 0,
      text,
      model,
      bytes: bytesForResult,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export { fetchPdfBase64 };
