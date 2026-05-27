/**
 * Backfill source-document screenshots for already-generated posts.
 *
 * Renders the real source PDF/page for any post still showing a "_pending"
 * placeholder and rewrites its screenshots[]. Mock/seed posts that already carry
 * typeset images are skipped (unless --force).
 *
 * Usage:
 *   npm run screenshots                 # all posts with pending placeholders
 *   npm run screenshots -- --only=slug  # one (or comma-separated) posts
 *   npm run screenshots -- --force      # recapture even posts that have images
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { captureSourceScreenshots } from "@/lib/ingest/screenshot";
import type { Post } from "@/lib/types";

// Posts whose stored sourceUrl is a docket landing page (HTML), not the exhibit
// PDF — map them to the fetchable PDF so we capture the document, not the page.
const PDF_OVERRIDES: Record<string, string> = {
  "cl-dcd-1-20-cv-03590-379-7":
    "https://storage.courtlistener.com/recap/gov.uscourts.dcd.224921/gov.uscourts.dcd.224921.379.7.pdf",
};

const CONTENT = path.join(process.cwd(), "content", "posts");

function isPending(p: Post): boolean {
  return !p.screenshots?.length || p.screenshots.some((s) => s.url.includes("/_pending/"));
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1].split(",").map((s) => s.trim()) : null;
  const force = args.includes("--force");

  const files = (await fs.readdir(CONTENT)).filter((f) => f.endsWith(".json"));
  let captured = 0;
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    if (only && !only.includes(slug)) continue;
    const p = JSON.parse(await fs.readFile(path.join(CONTENT, f), "utf8")) as Post;

    if (!isPending(p) && !force) {
      console.log(`· ${slug} — already has images, skipping`);
      continue;
    }
    const captureUrl = PDF_OVERRIDES[slug] ?? p.sourceUrl;
    if (!captureUrl) {
      console.log(`· ${slug} — no source URL, skipping`);
      continue;
    }
    process.stdout.write(`→ ${slug} — capturing… `);
    const shots = await captureSourceScreenshots(captureUrl, slug, {
      documentTitle: p.documentTitle,
      sourceCitation: `${p.sourceCase} · ${p.sourceCitation}`,
    });
    if (shots.length) {
      p.screenshots = shots;
      await fs.writeFile(path.join(CONTENT, f), JSON.stringify(p, null, 2), "utf8");
      console.log(`OK — ${shots.length} page(s)`);
      captured += 1;
    } else {
      console.log("FAILED (left as-is)");
    }
  }
  console.log(`\nDone. Captured screenshots for ${captured} post(s).`);
}

main().catch((e) => {
  console.error("Screenshot backfill crashed:", e);
  process.exit(1);
});
