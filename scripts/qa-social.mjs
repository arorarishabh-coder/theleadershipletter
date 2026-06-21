import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";

const jobs = [
  { url: "/social/avatar-a.html", w: 400, h: 400, out: ".qa-screenshots/social/twitter-avatar-a.png" },
  { url: "/social/avatar-b.html", w: 400, h: 400, out: ".qa-screenshots/social/twitter-avatar-b.png" },
  { url: "/social/avatar-c.html", w: 400, h: 400, out: ".qa-screenshots/social/twitter-avatar-c.png" },
  { url: "/social/banner.html", w: 1500, h: 500, out: ".qa-screenshots/social/twitter-banner.png" },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

for (const j of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 2 });
  await page.goto(`${BASE}${j.url}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: j.out, fullPage: false, clip: { x: 0, y: 0, width: j.w, height: j.h } });
  console.log("wrote", j.out, `(${j.w}x${j.h} @ 2x)`);
  await page.close();
}

await browser.close();
