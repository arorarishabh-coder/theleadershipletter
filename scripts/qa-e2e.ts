/**
 * End-to-end membership QA — drives every membership state through every gated
 * surface and asserts the right thing renders, with screenshots for visual review.
 *
 *   npx tsx scripts/qa-e2e.ts                 # against local dev (http://localhost:3000)
 *   QA_BASE=https://theleadershipletter.com npx tsx scripts/qa-e2e.ts   # against prod
 *
 * States (the full subscriber + non-subscriber matrix):
 *   anonymous      — not signed in
 *   registered     — signed in, no trial started
 *   trial          — free week active
 *   trial_expired  — free week ended, not subscribed
 *   subscribed     — paying (active Subscription)
 *
 * For each non-anonymous state it creates a throwaway User (+ Subscription /
 * trial timestamp) and a real Auth.js Session, drives the surfaces, then deletes
 * everything it created. Screenshots land in .qa-screenshots/e2e-*. Exits 1 on
 * any failed assertion.
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
const SECURE = BASE.startsWith("https://");
const COOKIE = SECURE ? "__Secure-authjs.session-token" : "authjs.session-token";
const DOMAIN = new URL(BASE).hostname;
const DAY = 24 * 60 * 60 * 1000;

const db = new PrismaClient();

type State = "anonymous" | "registered" | "trial" | "trial_expired" | "subscribed";

interface Check {
  state: State;
  surface: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];
const lc = (s: string) => s.toLowerCase();
function assert(state: State, surface: string, pass: boolean, detail = "") {
  checks.push({ state, surface, pass, detail });
  if (!pass) console.log(`  ✗ [${state}] ${surface} — ${detail}`);
}

/** Create the DB rows for a state; returns a session token (null for anonymous). */
async function setupState(state: State): Promise<{ token: string | null; userId: string | null }> {
  if (state === "anonymous") return { token: null, userId: null };

  const email = `qa-e2e+${state}-${crypto.randomBytes(4).toString("hex")}@qa.invalid`;
  const trialStartedAt =
    state === "trial" ? new Date()
    : state === "trial_expired" ? new Date(Date.now() - 8 * DAY)
    : null;

  const user = await db.user.create({ data: { email, trialStartedAt } });
  if (state === "subscribed") {
    await db.subscription.create({
      data: { userId: user.id, status: "active", plan: "monthly", currentPeriodEnd: new Date(Date.now() + 30 * DAY) },
    });
  }
  const token = crypto.randomBytes(48).toString("base64url");
  await db.session.create({ data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 30 * 60 * 1000) } });
  return { token, userId: user.id };
}

async function teardown(userId: string | null) {
  if (!userId) return;
  await db.subscription.deleteMany({ where: { userId } }).catch(() => {});
  await db.session.deleteMany({ where: { userId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
}

async function main() {
  mkdirSync(".qa-screenshots", { recursive: true });

  const freeSlug = await getMostRecentBroadcastSlug();
  const posts = getAllPosts();
  const gated = posts.find((p) => p.slug !== freeSlug);
  const freePost = freeSlug ? posts.find((p) => p.slug === freeSlug) : null;
  if (!gated) throw new Error("No gated archive post available.");

  console.log(`E2E membership QA`);
  console.log(`  base        : ${BASE}`);
  console.log(`  free edition: ${freeSlug ?? "(none broadcast yet)"}`);
  console.log(`  gated post  : ${gated.slug}`);
  console.log("");

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

  // Each grab gets an isolated context so a session cookie can't leak into a
  // later anonymous grab (page.setCookie is browser-wide).
  async function grab(path: string, file: string, token: string | null) {
    const ctx = await (browser as any).createBrowserContext();
    try {
      const page = await ctx.newPage();
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
      if (token) {
        await page.setCookie({ name: COOKIE, value: token, domain: DOMAIN, path: "/", httpOnly: true, secure: SECURE, sameSite: "Lax" });
      }
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 45000 });
      await page.evaluate(() => (document as any).fonts?.ready);
      await page.screenshot({ path: `.qa-screenshots/${file}`, fullPage: true });
      const headerText = await page.evaluate(() => document.querySelector("header")?.innerText || "");
      const bodyText = await page.evaluate(() => document.body.innerText || "");
      const finalUrl = page.url();
      return { status: res?.status() ?? 0, headerText, bodyText, finalUrl };
    } finally {
      await ctx.close();
    }
  }

  const STATES: State[] = ["anonymous", "registered", "trial", "trial_expired", "subscribed"];

  for (const state of STATES) {
    console.log(`— ${state} —`);
    const { token, userId } = await setupState(state);
    try {
      const signedIn = state !== "anonymous";
      const hasAccess = state === "trial" || state === "subscribed";

      // 1. Header auth state (home)
      const home = await grab("/", `e2e-${state}-home.png`, token);
      assert(state, "home 200", home.status === 200, `status ${home.status}`);
      if (signedIn) {
        assert(state, "header shows Account", /\baccount\b/i.test(home.headerText));
        assert(state, "header hides Sign in", !/sign in/i.test(home.headerText));
      } else {
        assert(state, "header shows Sign in", /sign in/i.test(home.headerText));
        assert(state, "header hides Account", !/\baccount\b/i.test(home.headerText));
      }

      // 2. /account controls (anonymous redirects to /signin)
      const acct = await grab("/account", `e2e-${state}-account.png`, token);
      if (!signedIn) {
        assert(state, "/account redirects anon to /signin", /\/signin/.test(acct.finalUrl), `url ${acct.finalUrl}`);
      } else {
        const b = lc(acct.bodyText);
        assert(state, "/account 200", acct.status === 200, `status ${acct.status}`);
        if (state === "registered") assert(state, "account: Start free week", b.includes("start free week"));
        if (state === "trial") assert(state, "account: Free week + days left", b.includes("free week") && /day/.test(b));
        if (state === "trial_expired") assert(state, "account: free week has ended", b.includes("free week has ended"));
        if (state === "subscribed") assert(state, "account: Subscriber + Manage billing", b.includes("subscriber") && b.includes("manage billing"));
      }

      // 3. Gated archive post — paywall vs lesson
      const post = await grab(`/post/${gated.slug}`, `e2e-${state}-gated-post.png`, token);
      const pb = lc(post.bodyText);
      assert(state, "gated post 200", post.status === 200, `status ${post.status}`);
      if (hasAccess) {
        assert(state, "gated: full lesson", pb.includes("traits in evidence"));
        assert(state, "gated: no paywall", !pb.includes("this edition is for members") && !pb.includes("your free week has ended"));
      } else {
        assert(state, "gated: no lesson", !pb.includes("traits in evidence"));
        if (state === "anonymous") assert(state, "gated: anon paywall", pb.includes("this edition is for members"));
        if (state === "registered") assert(state, "gated: registered paywall", pb.includes("start your free week"));
        if (state === "trial_expired") assert(state, "gated: expired paywall", pb.includes("your free week has ended"));
        // Newsletter CTA only for anonymous; suppressed when signed in
        if (state === "anonymous") assert(state, "gated: newsletter CTA shown", pb.includes("subscribe to the daily edition"));
        else assert(state, "gated: newsletter CTA suppressed", !pb.includes("subscribe to the daily edition"));
      }

      // 4. Free edition — lesson for everyone (incl. anonymous)
      if (freePost) {
        const free = await grab(`/post/${freePost.slug}`, `e2e-${state}-free-edition.png`, token);
        const fb = lc(free.bodyText);
        assert(state, "free edition 200", free.status === 200, `status ${free.status}`);
        assert(state, "free edition: full lesson for all", fb.includes("traits in evidence"));
        assert(state, "free edition: no paywall", !fb.includes("this edition is for members"));
      }

      // 5. /membership pricing page loads for all
      const mem = await grab("/membership", `e2e-${state}-membership.png`, token);
      assert(state, "/membership 200", mem.status === 200, `status ${mem.status}`);
    } finally {
      await teardown(userId);
    }
  }

  await browser.close();
  await db.$disconnect().catch(() => {});

  // Report
  const failed = checks.filter((c) => !c.pass);
  console.log("\n=== Matrix ===");
  const byState = new Map<State, Check[]>();
  for (const c of checks) {
    const arr = byState.get(c.state) ?? [];
    if (!byState.has(c.state)) byState.set(c.state, arr);
    arr.push(c);
  }
  for (const [state, cs] of byState) {
    const f = cs.filter((c) => !c.pass).length;
    console.log(`  ${f === 0 ? "✓" : "✗"} ${state.padEnd(14)} ${cs.length - f}/${cs.length} passed`);
  }
  console.log("");
  console.log(failed.length === 0 ? `✓ ALL ${checks.length} CHECKS PASSED` : `✗ ${failed.length}/${checks.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("E2E crashed:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
