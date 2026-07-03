/**
 * Headless-browser launcher that works both locally and on Vercel.
 *
 *  - Local/dev: use an installed Chrome/Edge (CHROME_PATH or a known location).
 *  - Serverless (Vercel/Lambda): use @sparticuz/chromium's bundled binary.
 *
 * Kept separate from lib/ingest/screenshot.ts (which is local/CI-only) because
 * the admin PDF download must run inside a Vercel function.
 */
import fs from "node:fs";

type Browser = import("puppeteer-core").Browser;

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

function findLocalChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p));
}

/** Launch a headless browser suitable for the current environment. */
export async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;

  if (!isServerless) {
    const exe = findLocalChrome();
    if (exe) {
      return puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
    }
    // fall through to bundled chromium if no local browser is present
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

/** Render an HTML string to a PDF at the given page size. Returns the raw bytes
 *  as a fresh ArrayBuffer-backed Uint8Array — usable directly by both
 *  fs.writeFile and a web Response/Blob. */
export async function renderHtmlToPdf(
  html: string,
  size: { width: string; height: string } = { width: "1080px", height: "1350px" },
): Promise<Uint8Array<ArrayBuffer>> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);
    const bytes = await page.pdf({ width: size.width, height: size.height, printBackground: true });
    return new Uint8Array(bytes); // copy into a plain ArrayBuffer for BodyInit/BlobPart
  } finally {
    await browser.close();
  }
}
