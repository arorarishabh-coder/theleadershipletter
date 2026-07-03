import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { buildSignInEmailHtml } from "@/lib/auth-email";
// Render the branded magic-link email HTML to a screenshot (no send).
async function main() {
  const html = buildSignInEmailHtml({
    to: "arorarishabh@gmail.com",
    url: "https://theleadershipletter.com/api/auth/callback/resend?token=demo123&email=arorarishabh%40gmail.com",
    host: "theleadershipletter.com",
  });
  mkdirSync(".qa-screenshots", { recursive: true });
  const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 760, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: ".qa-screenshots/mem-signin-email.png", fullPage: true });
  await browser.close();
  console.log("wrote .qa-screenshots/mem-signin-email.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
