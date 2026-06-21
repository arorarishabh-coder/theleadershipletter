import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:3000/membership";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
await page.evaluate(() => document.fonts.ready);

const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const viewport = 844;
let i = 0;
for (let y = 0; y < totalHeight; y += viewport - 80) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `.qa-screenshots/m-slice-${String(i).padStart(2, "0")}.png`, fullPage: false });
  console.log("slice", i, "at y=", y);
  i++;
}

await browser.close();
