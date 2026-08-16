import "dotenv/config";
import { db } from "@/lib/db";
import { getAllPosts } from "@/lib/queries";
import { buildEmailDocument } from "@/lib/publish/resend";
import {
  EMAIL_MERGE_TAG,
  b64urlDecode,
  b64urlEncode,
  instrumentEmailHtml,
  openPixelTag,
  signTarget,
  trackedClickUrl,
  trackingSecret,
  verifyTarget,
} from "@/lib/publish/track";
import { normaliseRecipient } from "@/lib/metrics/record-tracking";

/**
 * QA harness for first-party newsletter tracking (lib/publish/track.ts +
 * app/api/track/*). Exercises the HTML instrumentation, the URL signing, and both
 * live route handlers against the real database.
 *
 *   npm run qa:tracking
 *
 * Test rows are written under a namespaced slug and deleted at the end.
 */

const TEST_SLUG = "qa-tracking-selftest";
const SITE = "https://theleadershipletter.com";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const secret = trackingSecret();
  console.log(`signing secret: ${secret ? "present" : "MISSING"}`);
  if (!secret) {
    console.log("\nNo TRACK_SECRET/AUTH_SECRET — links would be left unwrapped. Aborting.");
    process.exit(1);
  }

  // ---------------------------------------------------------------- signing
  console.log("\n[1] URL signing");
  const target = "https://www.courtlistener.com/docket/123/4/5/waymo-llc-v-uber?a=1&b=2";
  const sig = signTarget(target, secret);
  check("valid signature verifies", verifyTarget(target, sig, secret));
  check("tampered target rejected", !verifyTarget(target + "&evil=1", sig, secret));
  check("tampered signature rejected", !verifyTarget(target, sig.slice(0, -1) + "0", secret));
  check("wrong secret rejected", !verifyTarget(target, sig, "some-other-secret"));
  check("b64url round-trips ampersands", b64urlDecode(b64urlEncode(target)) === target);
  const unicode = "https://example.com/?q=" + encodeURIComponent("Amodei “Re: Redline”");
  check("b64url round-trips unicode", b64urlDecode(b64urlEncode(unicode)) === unicode);

  // -------------------------------------------------------- instrumentation
  console.log("\n[2] HTML instrumentation");
  const sample = `<!doctype html><html><body>
    <a href="https://www.courtlistener.com/docket/1?a=1&amp;b=2">source</a>
    <a href="https://theleadershipletter.com/membership?utm_source=newsletter&amp;utm_medium=email">trial</a>
    <a href="mailto:?subject=hi&amp;body=there">forward</a>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">unsubscribe</a>
    <img src="https://theleadershipletter.com/cards/abc.png"/>
  </body></html>`;
  const inst = instrumentEmailHtml(sample, { slug: TEST_SLUG, siteUrl: SITE });

  check("mailto link untouched", inst.includes('href="mailto:?subject=hi&amp;body=there"'));
  check("unsubscribe merge tag untouched", inst.includes('href="{{{RESEND_UNSUBSCRIBE_URL}}}"'));
  check("card image src untouched", inst.includes('src="https://theleadershipletter.com/cards/abc.png"'));
  check("http links rewritten", (inst.match(/\/api\/track\/click/g) ?? []).length === 2);
  check("exactly one open pixel", (inst.match(/\/api\/track\/open/g) ?? []).length === 1);
  check("pixel sits before </body>", /\/api\/track\/open[^>]*\/>\s*<\/body>/.test(inst));
  check("merge tag present in pixel", inst.includes(`e=${EMAIL_MERGE_TAG}`));

  // The rewritten source link must decode back to the ORIGINAL url (entities resolved).
  const first = inst.match(/\/api\/track\/click\?p=[^"&]+&amp;u=([^"&]+)&amp;s=([^"&]+)/);
  check("tracked url is decodable", !!first);
  if (first) {
    const decoded = b64urlDecode(first[1]);
    check(
      "entities decoded before signing",
      decoded === "https://www.courtlistener.com/docket/1?a=1&b=2",
      decoded,
    );
    check("emitted signature is valid", verifyTarget(decoded, first[2], secret));
  }

  // Idempotence: instrumenting twice must not double-wrap or double-pixel.
  const twice = instrumentEmailHtml(inst, { slug: TEST_SLUG, siteUrl: SITE });
  check("re-instrumenting doesn't double-wrap", (twice.match(/\/api\/track\/click/g) ?? []).length === 2);

  check("no siteUrl -> no pixel", openPixelTag({ slug: TEST_SLUG, siteUrl: "" }) === "");
  check("mailto not trackable", trackedClickUrl("mailto:a@b.c", { slug: TEST_SLUG, siteUrl: SITE }) === null);
  check(
    "resend unsubscribe not trackable",
    trackedClickUrl("https://unsubscribe.resend.com/?token=x", { slug: TEST_SLUG, siteUrl: SITE }) === null,
  );

  // ------------------------------------------------------ real email document
  console.log("\n[3] Real email document");
  const post = getAllPosts().find((p) => p.postKind !== "artifact")!;
  const doc = buildEmailDocument(post, SITE);
  check("real email has pixel", doc.includes("/api/track/open"));
  check("real email wraps links", doc.includes("/api/track/click"));
  check("real email keeps unsubscribe tag", doc.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"));
  check("real email keeps card image", /src="https:\/\/theleadershipletter\.com\/cards\//.test(doc));
  check("no unrendered EMAIL tag outside a url param", !/>\s*\{\{\{EMAIL\}\}\}/.test(doc));

  const preview = buildEmailDocument(post, SITE, { track: false });
  check("track:false -> no pixel", !preview.includes("/api/track/open"));
  check("track:false -> no wrapped links", !preview.includes("/api/track/click"));

  const bound = buildEmailDocument(post, SITE, { recipient: "reader@example.com" });
  check("explicit recipient is bound", bound.includes("e=reader%40example.com"));
  check("explicit recipient drops merge tag", !bound.includes(`e=${EMAIL_MERGE_TAG}`));

  // ------------------------------------------------------------- recipients
  console.log("\n[4] Recipient normalisation");
  check("real address kept", normaliseRecipient("Reader@Example.com ") === "reader@example.com");
  check("unrendered merge tag -> unknown", normaliseRecipient("{{{EMAIL}}}") === "unknown");
  check("empty -> unknown", normaliseRecipient("") === "unknown");
  check("null -> unknown", normaliseRecipient(null) === "unknown");
  check("non-address -> unknown", normaliseRecipient("nonsense") === "unknown");

  // ---------------------------------------------------------- live handlers
  console.log("\n[5] Live route handlers (against the real DB)");
  await db.emailEvent.deleteMany({ where: { slug: TEST_SLUG } });

  const { GET: openGet } = await import("@/app/api/track/open/route");
  const { GET: clickGet } = await import("@/app/api/track/click/route");

  const openUrl = `${SITE}/api/track/open?p=${TEST_SLUG}&e=${encodeURIComponent("qa@example.com")}`;
  const r1 = await openGet(new Request(openUrl, { headers: { "user-agent": "qa-harness" } }));
  check("open returns 200", r1.status === 200, String(r1.status));
  check("open returns a gif", r1.headers.get("content-type") === "image/gif");
  check("open is uncacheable", (r1.headers.get("cache-control") ?? "").includes("no-store"));
  check("open body is a real pixel", (await r1.arrayBuffer()).byteLength > 20);

  let rows = await db.emailEvent.count({ where: { slug: TEST_SLUG, type: "opened" } });
  check("open recorded exactly one row", rows === 1, `rows=${rows}`);

  await openGet(new Request(openUrl, { headers: { "user-agent": "qa-harness" } }));
  rows = await db.emailEvent.count({ where: { slug: TEST_SLUG, type: "opened" } });
  check("repeat open deduped inside window", rows === 1, `rows=${rows}`);

  const stored = await db.emailEvent.findFirst({ where: { slug: TEST_SLUG, type: "opened" } });
  check("row tagged first-party", stored?.source === "first-party", String(stored?.source));
  check("row carries recipient", stored?.email === "qa@example.com", String(stored?.email));

  // Valid click.
  const clickTarget = "https://www.courtlistener.com/docket/1?a=1&b=2";
  const good = `${SITE}/api/track/click?p=${TEST_SLUG}&u=${b64urlEncode(clickTarget)}&s=${signTarget(
    clickTarget,
    secret,
  )}&e=${encodeURIComponent("qa@example.com")}`;
  const r2 = await clickGet(new Request(good));
  check("valid click redirects 302", r2.status === 302, String(r2.status));
  check("redirects to the real target", r2.headers.get("location") === clickTarget, String(r2.headers.get("location")));
  const clicks = await db.emailEvent.count({ where: { slug: TEST_SLUG, type: "clicked" } });
  check("click recorded", clicks === 1, `rows=${clicks}`);

  // Forged click — the open-redirect guard.
  const evil = "https://evil.example.com/phish";
  const forged = `${SITE}/api/track/click?p=${TEST_SLUG}&u=${b64urlEncode(evil)}&s=${signTarget(
    clickTarget,
    secret,
  )}`;
  const r3 = await clickGet(new Request(forged));
  check("forged target does NOT redirect to it", r3.headers.get("location") !== evil);
  check("forged target falls back home", (r3.headers.get("location") ?? "").includes("theleadershipletter.com"));
  const afterForge = await db.emailEvent.count({ where: { slug: TEST_SLUG, type: "clicked" } });
  check("forged click not recorded", afterForge === 1, `rows=${afterForge}`);

  // Unsigned click.
  const r4 = await clickGet(new Request(`${SITE}/api/track/click?p=${TEST_SLUG}&u=${b64urlEncode(evil)}`));
  check("unsigned click falls back home", (r4.headers.get("location") ?? "").includes("theleadershipletter.com"));

  // ------------------------------------------------------------- aggregation
  console.log("\n[6] Aggregation reads first-party events");
  const { getEmailEngagement } = await import("@/lib/metrics/email-events");
  const summary = await getEmailEngagement();
  check("engagement reports configured", summary.configured);
  const testEdition = summary.broadcasts.find((b) => b.slug === TEST_SLUG || b.broadcastId === TEST_SLUG);
  check("test edition surfaced with 1 open", testEdition?.opens === 1, JSON.stringify(testEdition));
  check("test edition surfaced with 1 click", testEdition?.clicks === 1);

  // ----------------------------------------------------------------- cleanup
  const deleted = await db.emailEvent.deleteMany({ where: { slug: TEST_SLUG } });
  console.log(`\ncleanup: removed ${deleted.count} test rows`);
  const left = await db.emailEvent.count({ where: { slug: TEST_SLUG } });
  check("no test rows left behind", left === 0, `left=${left}`);

  console.log(`\n${pass}/${pass + fail} checks passed`);
  if (fail) {
    console.log("\nFAILURES:");
    for (const f of failures) console.log("  - " + f);
  }
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.emailEvent.deleteMany({ where: { slug: TEST_SLUG } }).catch(() => {});
  process.exit(1);
});
