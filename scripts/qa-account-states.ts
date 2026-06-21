import "dotenv/config";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer-core";

// Verify the /account page renders the right controls per membership state by
// creating throwaway users (registered = no trial, trial = active). Cleans up.
const db = new PrismaClient();
const BASE = (process.env.QA_BASE || "http://localhost:3000").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const COOKIE = "authjs.session-token";
const DOMAIN = new URL(BASE).hostname;

const fails: string[] = [];
function assert(name: string, pass: boolean) {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) fails.push(name);
}

async function main() {
  mkdirSync(".qa-screenshots", { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

  const states: Array<{ key: string; trialStartedAt: Date | null; mustHave: string[] }> = [
    { key: "registered", trialStartedAt: null, mustHave: ["Start free week", "Start your free week"] },
    { key: "trial", trialStartedAt: new Date(), mustHave: ["Free week", "Subscribe"] },
  ];

  for (const s of states) {
    const email = `qa+${s.key}-${crypto.randomBytes(4).toString("hex")}@qa.invalid`;
    const user = await db.user.create({ data: { email, trialStartedAt: s.trialStartedAt } });
    const token = crypto.randomBytes(48).toString("base64url");
    await db.session.create({ data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 30 * 60 * 1000) } });
    try {
      const ctx = await (browser as any).createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 2 });
      await page.setCookie({ name: COOKIE, value: token, domain: DOMAIN, path: "/", httpOnly: true });
      const res = await page.goto(`${BASE}/account`, { waitUntil: "networkidle0", timeout: 45000 });
      await page.evaluate(() => (document as any).fonts?.ready);
      await page.screenshot({ path: `.qa-screenshots/mem-account-${s.key}.png`, fullPage: true });
      const body = await page.evaluate(() => document.body.innerText || "");
      assert(`/account ${s.key} HTTP 200`, res?.status() === 200);
      for (const needle of s.mustHave) {
        assert(`/account ${s.key} shows "${needle}"`, body.toLowerCase().includes(needle.toLowerCase()));
      }
      await page.close();
      await ctx.close();
    } finally {
      await db.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  }

  await browser.close();
  await db.$disconnect().catch(() => {});
  console.log("");
  console.log(fails.length === 0 ? "✓ ALL ACCOUNT-STATE CHECKS PASSED" : `✗ ${fails.length} FAILED`);
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error("crashed:", e); await db.$disconnect().catch(() => {}); process.exit(1); });
