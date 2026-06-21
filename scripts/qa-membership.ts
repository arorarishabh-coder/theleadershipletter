/**
 * Membership QA — drives the LOCAL dev server with a real Auth.js session and
 * screenshots the surfaces the user reported bugs on:
 *   - header auth state (signed-out vs signed-in)
 *   - /account
 *   - /membership
 *   - an archive post: anonymous (paywall) vs admin simulate=subscribed (lesson)
 *
 * It also asserts header text so we catch the "still shows Sign in" bug
 * programmatically, not just visually.
 *
 *   npx tsx scripts/qa-membership.ts
 *
 * Creates a short-lived Session row for the admin user, screenshots to
 * .qa-screenshots/mem-*, then deletes the session. Exits 1 on any assertion fail.
 */

import "dotenv/config";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer-core";
import { getAllPosts } from "@/lib/queries";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";

const BASE = (process.env.QA_BASE || "http://localhost:3000").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ADMIN_EMAIL = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase() || "arorarishabh@gmail.com";
const SESSION_COOKIE = BASE.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
const COOKIE_DOMAIN = new URL(BASE).hostname;

const db = new PrismaClient();

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];
function assert(name: string, pass: boolean, detail = "") {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  mkdirSync(".qa-screenshots", { recursive: true });

  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found in DB.`);
  const token = crypto.randomBytes(48).toString("base64url");
  await db.session.create({
    data: { sessionToken: token, userId: admin.id, expires: new Date(Date.now() + 30 * 60 * 1000) },
  });

  const freeSlug = await getMostRecentBroadcastSlug();
  const posts = getAllPosts();
  const archive = posts.find((p) => p.slug !== freeSlug) ?? posts[0];
  if (!archive) throw new Error("No posts to test against.");

  console.log(`QA membership`);
  console.log(`  base        : ${BASE}`);
  console.log(`  admin       : ${admin.email}`);
  console.log(`  free slug   : ${freeSlug ?? "(none broadcast yet)"}`);
  console.log(`  archive post: ${archive.slug}`);
  console.log("");

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

  // Each grab runs in its OWN isolated incognito context so a session cookie set
  // for an authed grab can never leak into a later "anonymous" grab (puppeteer's
  // page.setCookie is browser-wide, not page-scoped).
  const newContext = (): Promise<any> =>
    (browser as any).createBrowserContext
      ? (browser as any).createBrowserContext()
      : (browser as any).createIncognitoBrowserContext();

  async function grab(path: string, file: string, opts: { authed: boolean }) {
    const ctx = await newContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    if (opts.authed) {
      const secure = BASE.startsWith("https://");
      await page.setCookie({
        name: SESSION_COOKIE,
        value: token,
        domain: COOKIE_DOMAIN,
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "Lax",
      });
    }
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 45000 });
    await page.evaluate(() => (document as any).fonts?.ready);
    await page.screenshot({ path: `.qa-screenshots/${file}`, fullPage: true });
    // Header utility-bar text (the top strip with Search / Sign in|Account / Subscribe)
    const headerText = await page.evaluate(() => document.querySelector("header")?.innerText || "");
    // Paywall headline, if present — lets us assert the right gate copy per state.
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    const status = res?.status() ?? 0;
    await page.close();
    await ctx.close();
    return { status, headerText, bodyText };
  }

  // 1. Homepage — anonymous: header should offer "Sign in", not "Account".
  const anon = await grab("/", "mem-home-anon.png", { authed: false });
  assert("home anon HTTP 200", anon.status === 200, `status ${anon.status}`);
  assert("home anon header shows 'Sign in'", /sign in/i.test(anon.headerText));
  assert("home anon header has NO 'Account'", !/\baccount\b/i.test(anon.headerText));

  // 2. Homepage — signed in: header should show "Account", NOT "Sign in". (the bug)
  const authed = await grab("/", "mem-home-authed.png", { authed: true });
  assert("home authed HTTP 200", authed.status === 200, `status ${authed.status}`);
  assert("home authed header shows 'Account'", /\baccount\b/i.test(authed.headerText));
  assert("home authed header does NOT show 'Sign in'  [THE BUG]", !/sign in/i.test(authed.headerText));

  // 3. /account signed in.
  const acct = await grab("/account", "mem-account.png", { authed: true });
  assert("/account HTTP 200", acct.status === 200, `status ${acct.status}`);

  // 4. /membership anonymous.
  const mem = await grab("/membership", "mem-membership.png", { authed: false });
  assert("/membership HTTP 200", mem.status === 200, `status ${mem.status}`);

  // 5. Archive post anonymous → anonymous paywall ("This edition is for members.").
  const postAnon = await grab(`/post/${archive.slug}`, "mem-post-anon.png", { authed: false });
  assert("archive post anon HTTP 200", postAnon.status === 200, `status ${postAnon.status}`);
  assert(
    "archive post anon shows anonymous paywall copy",
    postAnon.bodyText.includes("This edition is for members."),
    "expected 'This edition is for members.'",
  );
  assert(
    "archive post anon is gated (no lesson footer)",
    // innerText applies CSS text-transform: the footer renders uppercased.
    !postAnon.bodyText.toLowerCase().includes("traits in evidence"),
  );

  // 6. Archive post admin simulate=subscribed → full lesson (no paywall).
  const postSub = await grab(`/post/${archive.slug}?simulate=subscribed`, "mem-post-subscribed.png", { authed: true });
  assert("archive post simulate=subscribed HTTP 200", postSub.status === 200, `status ${postSub.status}`);
  assert(
    "archive post simulate=subscribed shows lesson body",
    postSub.bodyText.toLowerCase().includes("traits in evidence"),
  );

  await browser.close();
  await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
  await db.$disconnect().catch(() => {});

  const failed = checks.filter((c) => !c.pass);
  console.log("");
  console.log(failed.length === 0 ? `✓ ALL ${checks.length} CHECKS PASSED` : `✗ ${failed.length}/${checks.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("QA crashed:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
