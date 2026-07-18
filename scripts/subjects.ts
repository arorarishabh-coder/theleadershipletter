/**
 * Backfill the real email Subject: line onto existing posts, then regenerate their
 * cards. New posts get emailSubject during enrichment (pipeline.ts); this fixes the
 * posts generated before that — WITHOUT re-fetching sources: it reads the Subject
 * straight off the source screenshot we already have on disk (a cheap Haiku vision
 * call). Only touches email-style posts; threads/letters/no-subject are left as-is
 * (the card falls back to documentTitle for those).
 *
 *   npm run subjects                 # posts missing emailSubject that have a screenshot
 *   npm run subjects -- --force      # re-read even posts that already have one
 *   npm run subjects -- --only=slug  # a single post (repeatable)
 */
import "dotenv/config";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import type { Post } from "@/lib/types";
import { claude, MODELS } from "@/lib/anthropic";
import { renderCardPng } from "@/lib/social/card-image";
import { saveCardImage } from "@/lib/ingest/save";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

const PROMPT =
  "This image is one page of a document filed as a court or SEC exhibit. " +
  "If it is an EMAIL that has a 'Subject:' line, reply with ONLY that subject text, verbatim " +
  "(if the email quotes a thread with several subjects, use the innermost/most specific one). " +
  "If it is NOT an email, or has no visible Subject line (a letter, a chat/message log, a memo, " +
  "a form, a cover page), reply with exactly: NONE";

async function readSubjectFromShot(shotPath: string): Promise<string | null> {
  const data = (await fs.readFile(shotPath)).toString("base64");
  const res = await claude.messages.create({
    model: MODELS.triage,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text.trim() : "";
  if (!text || /^none$/i.test(text) || text.length > 200) return null;
  return text.replace(/^subject:\s*/i, "").trim();
}

function parseArgs(argv: string[]) {
  return {
    force: argv.includes("--force"),
    only: argv.filter((a) => a.startsWith("--only=")).map((a) => a.slice(7)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith(".json"));

  let patched = 0, none = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const jsonPath = path.join(POSTS_DIR, file);
    let post: Post;
    try {
      post = JSON.parse(await fs.readFile(jsonPath, "utf8")) as Post;
    } catch {
      continue;
    }

    if (args.only.length && !args.only.includes(post.slug)) continue;
    if (post.messageThread?.length) { skipped++; continue; }         // chat thread — no subject
    if (post.emailSubject && !args.force) { skipped++; continue; }   // already have it
    const shot = post.screenshots?.[0];
    if (!shot || shot.url.includes("_pending")) { skipped++; continue; }
    const shotPath = path.join(PUBLIC_DIR, shot.url.replace(/^\//, ""));
    if (!existsSync(shotPath)) { skipped++; continue; }

    try {
      const subject = await readSubjectFromShot(shotPath);
      if (!subject) { none++; console.log(`  – ${post.slug}: no email subject (kept documentTitle)`); continue; }
      post.emailSubject = subject;
      // regenerate the card so its Subject: line updates
      const png = await renderCardPng(post);
      post.cardImage = await saveCardImage(post.slug, png);
      await fs.writeFile(jsonPath, JSON.stringify(post, null, 2) + "\n", "utf8");
      console.log(`  ✓ ${post.slug}: "${subject}"`);
      patched++;
    } catch (e) {
      failed++;
      console.log(`  ✗ ${post.slug} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n=== Subjects ===\nPatched:  ${patched} (subject read + card regenerated)\nNo subject: ${none} (kept documentTitle)\nSkipped:  ${skipped} (thread / already set / no screenshot)\nFailed:   ${failed}`);
  process.exit(failed > 0 && patched === 0 ? 1 : 0);
}

main();
