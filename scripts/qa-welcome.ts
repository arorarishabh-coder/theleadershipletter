import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { buildWelcomeEmailHtml } from "@/lib/welcome-email";
async function main() {
  const html = buildWelcomeEmailHtml({ to: "arorarishabh@gmail.com", siteUrl: "https://theleadershipletter.com" });
  mkdirSync(".qa-screenshots", { recursive: true });
  const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.screenshot({ path: ".qa-screenshots/mem-welcome-email.png", fullPage: true });
  await browser.close();
  console.log("wrote .qa-screenshots/mem-welcome-email.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
