/**
 * QA agent — drives the deployed site, asserts paywall vs lesson-body rendering
 * across membership states. Run before any test handoff so we never present
 * untested flows to the user.
 *
 *   npm run qa:paywall                                  # tests against SITE_URL (prod)
 *   npm run qa:paywall -- --base=https://preview-…       # against preview
 *   npm run qa:paywall -- --archive-sample=10            # how many archive posts to spot-check
 *
 * What it does:
 *   1. Picks the most-recently-broadcast post (the "free edition") and a
 *      representative sample of archive posts (publishedAt < today).
 *   2. Creates a short-lived Session row for the admin user in Postgres so
 *      authenticated requests carry a real Auth.js session cookie.
 *   3. Drives the matrix of (post-type × auth-state) and asserts each result
 *      against state-specific HTML markers.
 *   4. Cleans up the session row.
 *
 * Exits 0 if all assertions pass, 1 otherwise.
 */

import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getAllPosts } from "@/lib/queries";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";

const db = new PrismaClient();

const BASE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--base="));
  if (arg) return arg.split("=").slice(1).join("=").replace(/\/$/, "");
  return (process.env.SITE_URL || "https://theleadershipletter.com").replace(/\/$/, "");
})();

const ARCHIVE_SAMPLE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--archive-sample="));
  return arg ? parseInt(arg.split("=")[1] ?? "5", 10) : 5;
})();

const ADMIN_EMAIL = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || "arorarishabh@gmail.com";
const SESSION_COOKIE = BASE.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";

// Markers — each paywall state has a unique copy line; the lesson body has a
// trailing "Traits in evidence" footer that's absent when gated.
const LESSON_MARKER = "Traits in evidence";
const PAYWALL_HEADLINE: Record<string, string> = {
  anonymous: "This edition is for members.",
  registered: "Start your free week.",
  trial_expired: "Your free week has ended.",
};
const ADMIN_SIMULATE_BANNER = "Admin simulate";
const NEWSLETTER_CTA_MARKER = "Subscribe to the daily edition.";

interface Scenario {
  name: string;
  path: string;
  authed: boolean;
  expectContains: string[];
  expectNotContains?: string[];
}

interface Result {
  scenario: string;
  pass: boolean;
  failures: string[];
  status: number;
  bytes: number;
}

async function fetchHtml(path: string, cookie: string | null): Promise<{ status: number; html: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

async function runScenario(s: Scenario, token: string | null): Promise<Result> {
  const { status, html } = await fetchHtml(s.path, s.authed ? token : null);
  const failures: string[] = [];
  for (const needle of s.expectContains) if (!html.includes(needle)) failures.push(`missing "${needle}"`);
  for (const needle of s.expectNotContains ?? []) if (html.includes(needle)) failures.push(`should NOT contain "${needle}"`);
  return { scenario: s.name, pass: failures.length === 0, failures, status, bytes: html.length };
}

function pickSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    let idx = Math.floor((i * arr.length) / n);
    while (seen.has(idx)) idx = (idx + 1) % arr.length;
    seen.add(idx);
    out.push(arr[idx]!);
  }
  return out;
}

async function main() {
  const freeSlug = await getMostRecentBroadcastSlug();
  if (!freeSlug) {
    console.log("⚠ No broadcast has been sent yet. Skipping free-edition test.");
  }

  const all = getAllPosts();
  const archive = all.filter((p) => p.slug !== freeSlug);
  if (archive.length === 0) throw new Error("Need at least one non-free archive post.");
  const archiveSample = pickSample(archive, ARCHIVE_SAMPLE);
  const freePost = freeSlug ? all.find((p) => p.slug === freeSlug) : null;

  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase() } });
  if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found in DB.`);
  const token = crypto.randomBytes(48).toString("base64url");
  await db.session.create({
    data: { sessionToken: token, userId: admin.id, expires: new Date(Date.now() + 30 * 60 * 1000) },
  });

  console.log(`QA paywall agent`);
  console.log(`  base       : ${BASE}`);
  console.log(`  admin      : ${admin.email} (id=${admin.id})`);
  console.log(`  cookie     : ${SESSION_COOKIE}`);
  console.log(`  free slug  : ${freeSlug ?? "(none — no broadcast sent yet)"}`);
  console.log(`  archive    : ${archive.length} posts total, spot-checking ${archiveSample.length}`);
  console.log();

  const scenarios: Scenario[] = [];

  // 1. Free edition (the broadcast slug) — every state should see lesson body.
  if (freePost) {
    scenarios.push({
      name: `anonymous on free edition (${freePost.slug}) → lesson body`,
      path: `/post/${freePost.slug}`,
      authed: false,
      expectContains: [LESSON_MARKER],
      expectNotContains: [PAYWALL_HEADLINE.anonymous],
    });
  }

  // 2. Archive (sampled) — anonymous should see anonymous paywall + NewsletterCTA.
  for (const p of archiveSample) {
    scenarios.push({
      name: `anonymous on archive (${p.slug}) → paywall + newsletter CTA`,
      path: `/post/${p.slug}`,
      authed: false,
      expectContains: [PAYWALL_HEADLINE.anonymous, "Sign in to continue", NEWSLETTER_CTA_MARKER],
      expectNotContains: [LESSON_MARKER],
    });
  }

  // 3. Pick one archive post for the full state-machine check via simulate.
  const archiveOne = archiveSample[0]!;
  scenarios.push({
    name: `admin simulate=anonymous → anonymous paywall + banner`,
    path: `/post/${archiveOne.slug}?simulate=anonymous`,
    authed: true,
    expectContains: [PAYWALL_HEADLINE.anonymous, ADMIN_SIMULATE_BANNER],
    expectNotContains: [LESSON_MARKER],
  });
  scenarios.push({
    name: `admin simulate=registered → 'Start your free week' paywall + banner`,
    path: `/post/${archiveOne.slug}?simulate=registered`,
    authed: true,
    expectContains: [PAYWALL_HEADLINE.registered, ADMIN_SIMULATE_BANNER],
    expectNotContains: [LESSON_MARKER],
  });
  scenarios.push({
    name: `admin simulate=trial → lesson body (no paywall)`,
    path: `/post/${archiveOne.slug}?simulate=trial`,
    authed: true,
    expectContains: [LESSON_MARKER],
    expectNotContains: [PAYWALL_HEADLINE.anonymous, PAYWALL_HEADLINE.trial_expired],
  });
  scenarios.push({
    name: `admin simulate=trial_expired → 'Your free week has ended' + Subscribe $3/mo + banner`,
    path: `/post/${archiveOne.slug}?simulate=trial_expired`,
    authed: true,
    expectContains: [PAYWALL_HEADLINE.trial_expired, "Subscribe — $3/mo", ADMIN_SIMULATE_BANNER],
    expectNotContains: [LESSON_MARKER],
  });
  scenarios.push({
    name: `admin simulate=subscribed → lesson body`,
    path: `/post/${archiveOne.slug}?simulate=subscribed`,
    authed: true,
    expectContains: [LESSON_MARKER],
    expectNotContains: [PAYWALL_HEADLINE.anonymous],
  });

  // 4. Newsletter CTA suppression — signed-in user on free edition should NOT
  // see the bottom-of-article newsletter signup (already in the audience).
  if (freePost) {
    scenarios.push({
      name: `signed-in admin on free edition → no Newsletter CTA box`,
      path: `/post/${freePost.slug}`,
      authed: true,
      expectContains: [LESSON_MARKER],
      expectNotContains: [NEWSLETTER_CTA_MARKER],
    });
  }

  // 5. /account loads.
  scenarios.push({
    name: `/account loads (200) for authed admin`,
    path: `/account`,
    authed: true,
    expectContains: ["Your account", "arorarishabh@gmail.com"],
  });

  // 6. /membership loads anonymously.
  scenarios.push({
    name: `/membership loads (200) anonymously`,
    path: `/membership`,
    authed: false,
    expectContains: ["Choose a plan"],
  });

  const results: Result[] = [];
  for (const s of scenarios) {
    const r = await runScenario(s, token);
    results.push(r);
    console.log(`${r.pass ? "✓" : "✗"} ${r.scenario}  [HTTP ${r.status}, ${r.bytes}b]`);
    for (const f of r.failures) console.log(`    · ${f}`);
  }

  await db.session.delete({ where: { sessionToken: token } }).catch(() => {});

  const failed = results.filter((r) => !r.pass);
  console.log("");
  console.log(failed.length === 0 ? `✓ ALL ${results.length} CHECKS PASSED` : `✗ ${failed.length} of ${results.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("QA crashed:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
