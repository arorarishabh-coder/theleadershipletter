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

const USER_AGENT =
  "CorporateLettersResearchBot/0.1 (+research@corporateletters.example.com) editorial-ocr";

// Anthropic accepts PDFs up to ~32MB / 100 pages per request. Stay comfortably under.
const MAX_PDF_BYTES = 28 * 1024 * 1024;

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

/**
 * Transcribe a (likely scanned) PDF to verbatim plain text via a Claude vision model.
 * Returns the transcription text plus token usage. Does not throw — failures come
 * back as { ok: false, error }.
 */
export async function transcribePdf(
  url: string,
  opts: { model?: string } = {},
): Promise<OcrResult> {
  const fetched = await fetchPdfBase64(url);
  if ("error" in fetched) return { ok: false, error: fetched.error };

  const model = opts.model ?? MODELS.enrich; // Sonnet: strong vision, reasonable cost

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: fetched.base64 },
    },
    { type: "text", text: TRANSCRIPTION_INSTRUCTION },
  ];

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
      bytes: fetched.bytes,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export { fetchPdfBase64 };
