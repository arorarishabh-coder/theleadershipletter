import path from "node:path";
import type { FetchResult } from "./types";

// Browser-like UA: some public archives (e.g. justice.gov) return 403 to obvious
// bots. We identify ourselves via the From header for politeness instead.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FROM_CONTACT = "research@corporateletters.example.com";

export interface FetchOptions {
  pdfPageRange?: [number, number];
}

export async function fetchDocument(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        From: FROM_CONTACT,
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!r.ok) {
      return { url, status: "fail", httpCode: r.status, error: `HTTP ${r.status}` };
    }
    const ct = r.headers.get("content-type") ?? "";
    const buf = await r.arrayBuffer();
    const bytes = buf.byteLength;
    const view = new Uint8Array(buf, 0, Math.min(4, bytes));
    const isPdf = ct.includes("pdf") || (view.length >= 4 && view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46);
    if (isPdf) {
      try {
        const text = await extractPdfText(buf, opts.pdfPageRange);
        return { url, status: "ok", httpCode: r.status, bytes, text, rawHtml: "" };
      } catch (e) {
        return { url, status: "fail", httpCode: r.status, error: `PDF parse failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    const html = new TextDecoder().decode(buf);
    const text = stripHtml(html);
    return { url, status: "ok", httpCode: r.status, bytes, text, rawHtml: html };
  } catch (e) {
    return { url, status: "fail", error: e instanceof Error ? e.message : String(e) };
  }
}

// Loading pdfjs is fiddly across runtimes. Under `tsx` (esbuild) the module is
// rewritten to a `data:` URL base, so a bare dynamic-import specifier fails to
// resolve. We try the bare specifier first (works under Next.js bundling), then
// fall back to resolving the package on disk and importing it via a file:// URL
// (works under tsx / plain Node).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfjs(): Promise<any> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  try {
    return await import(specifier);
  } catch {
    const { createRequire } = await import("node:module");
    const { pathToFileURL } = await import("node:url");
    const req = createRequire(path.join(process.cwd(), "package.json"));
    const resolved = req.resolve(specifier);
    return await import(pathToFileURL(resolved).href);
  }
}

async function extractPdfText(buf: ArrayBuffer, pageRange?: [number, number]): Promise<string> {
  // Use pdfjs-dist legacy build (works in Node without canvas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await loadPdfjs();
  const data = new Uint8Array(buf);
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true,
    standardFontDataUrl: undefined,
  }).promise;
  const totalPages: number = doc.numPages;
  const startPage = pageRange ? Math.max(1, pageRange[0]) : 1;
  const endPage = pageRange ? Math.min(totalPages, pageRange[1]) : Math.min(totalPages, 6);
  let text = "";
  for (let i = startPage; i <= endPage; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((it: any) => (typeof it.str === "string" ? it.str : "")).join(" ");
    text += `\n\n--- Page ${i} ---\n\n` + pageText;
  }
  return text.replace(/[ \t]+/g, " ").trim();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Court-exhibit PDFs are frequently scanned images, not born-digital text. For
// those, pdfjs returns only the stamped boilerplate (exhibit label, case caption,
// "Filed .../Page X of N") with no email body. Publishing off that text would
// mean fabricating a lesson from nothing, so the pipeline must detect it and skip
// (those docs need an OCR pass). This returns the length of *meaningful* body text
// after removing the predictable court/exhibit boilerplate.
export function meaningfulTextLength(text: string): number {
  if (!text) return 0;
  const stripped = text
    .replace(/---\s*Page\s+\d+\s*---/gi, " ")
    .replace(
      /Case\s+\d+:\d+-[a-z]{2,3}-\d+[-\w]*\s+Document\s+[\d.\-]+\s+Filed\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+Page\s+\d+\s+of\s+\d+/gi,
      " ",
    )
    .replace(/\bEXHIBIT\s+[A-Z0-9]+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length;
}

export function extractRelevantExcerpt(fullText: string, marker?: string, maxChars = 4000): string {
  if (!fullText) return "";
  if (marker) {
    const idx = fullText.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 200);
      const end = Math.min(fullText.length, idx + maxChars);
      return fullText.slice(start, end);
    }
  }
  // Default: skip likely-navigation prefix, take a substantial chunk
  return fullText.slice(0, maxChars);
}

// Letter salutations — the start of the actual letter body, past cover pages,
// tables of contents, and financial-highlights front-matter.
const SALUTATION =
  /\b(dear (fellow )?(share|stock)holders|to (our|my) (fellow )?(share|stock)holders|to the (share|stock)holders of|dear (colleagues|team|partners|fellow)|dear (mr|ms|mrs)\b)/i;

/**
 * A representative window for the gate / enrich stages. Long filings (Buffett,
 * Dimon letters) open with TOC + financial highlights + safe-harbor boilerplate;
 * the substance is pages in. If we can find the salutation, start the window there
 * so the model judges the actual letter, not its front-matter. Uses a larger
 * window than the fair-use excerpt because the lesson often builds over pages.
 */
export function representativeExcerpt(fullText: string, marker?: string, maxChars = 9000): string {
  if (!fullText) return "";
  if (marker) return extractRelevantExcerpt(fullText, marker, maxChars);
  const m = fullText.match(SALUTATION);
  // Only jump if the salutation is in the front portion (a real letter opening),
  // not a quoted letter buried near the end.
  const start = m && m.index !== undefined && m.index < fullText.length * 0.6 ? Math.max(0, m.index - 60) : 0;
  return fullText.slice(start, start + maxChars);
}
