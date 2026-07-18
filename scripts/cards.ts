/**
 * Backfill / regenerate the recreated ITE-style card image for posts.
 *
 * Renders buildMessageCardHtml(post) to public/cards/{slug}.png (via a headless
 * browser — run LOCALLY where Chrome is reliable). The newsletter uses this hosted
 * card in place of the raw source screenshot (email clients strip data: URIs, so
 * the card must be a hosted file).
 *
 * Posts come from getAllPosts() = generated posts (content/posts/*.json) PLUS the
 * hand-written seed posts (lib/mock-data.ts). For a file-backed post we also write
 * post.cardImage into its JSON. Seed posts have no file, so the script reports them
 * at the end — add `cardImage: "/cards/{slug}.png"` to those mock-data entries by hand.
 *
 *   npm run cards                 # every post missing a card image
 *   npm run cards -- --force      # regenerate every card
 *   npm run cards -- --only=slug  # a single post (repeatable)
 *   npm run cards -- --sent-buffer# only send-eligible (newsletter-bound) posts
 */
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { getAllPosts } from "@/lib/queries";
import { renderCardPng } from "@/lib/social/card-image";
import { saveCardImage } from "@/lib/ingest/save";
import { isSendEligible } from "@/lib/publish/schedule";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const CARDS_DIR = path.join(process.cwd(), "public", "cards");

function parseArgs(argv: string[]) {
  return {
    force: argv.includes("--force"),
    sentBuffer: argv.includes("--sent-buffer"),
    only: argv.filter((a) => a.startsWith("--only=")).map((a) => a.slice(7)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const posts = getAllPosts();

  let existingCards = new Set<string>();
  try {
    existingCards = new Set((await fs.readdir(CARDS_DIR)).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)));
  } catch {
    /* no cards dir yet */
  }

  let done = 0, skipped = 0, failed = 0;
  const mockToPatch: string[] = [];
  const failures: string[] = [];

  for (const post of posts) {
    if (args.only.length && !args.only.includes(post.slug)) continue;
    if (args.sentBuffer && !isSendEligible(post)) continue;
    if (!args.force && existingCards.has(post.slug) && post.cardImage) {
      skipped++;
      continue;
    }

    try {
      const png = await renderCardPng(post);
      const cardPath = await saveCardImage(post.slug, png);
      const jsonPath = path.join(POSTS_DIR, `${post.slug}.json`);
      if (existsSync(jsonPath)) {
        const raw = JSON.parse(await fs.readFile(jsonPath, "utf8"));
        if (raw.cardImage !== cardPath) {
          raw.cardImage = cardPath;
          await fs.writeFile(jsonPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
        }
      } else if (post.cardImage !== cardPath) {
        mockToPatch.push(post.slug); // seed post (mock-data.ts) — patch by hand
      }
      console.log(`  ✓ ${post.slug} → ${cardPath} (${png.length} bytes)`);
      done++;
    } catch (e) {
      failed++;
      failures.push(`${post.slug}: ${e instanceof Error ? e.message : String(e)}`);
      console.log(`  ✗ ${post.slug} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n=== Cards ===\nGenerated: ${done}\nSkipped:   ${skipped} (already have a card — use --force)\nFailed:    ${failed}`);
  if (failures.length) failures.forEach((f) => console.log(`  ${f}`));
  if (mockToPatch.length) {
    console.log(`\nSeed posts (lib/mock-data.ts) — add cardImage: "/cards/{slug}.png" to each:`);
    mockToPatch.forEach((s) => console.log(`  ${s}`));
  }
  process.exit(failed > 0 && done === 0 ? 1 : 0);
}

main();
