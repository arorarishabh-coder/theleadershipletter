import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.argv[2] || "http://localhost:3000/membership";
const OUT = process.argv[3] || ".qa-screenshots/page";

mkdirSync(".qa-screenshots", { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function shoot(viewport, filename) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  // Force any web fonts to settle
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: filename, fullPage: true });
  await page.close();
  console.log("wrote", filename);
}

await shoot({ width: 1440, height: 900, deviceScaleFactor: 1 }, `${OUT}-desktop.png`);
await shoot({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, `${OUT}-mobile.png`);

await browser.close();
