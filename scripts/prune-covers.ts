/**
 * Prune cover/divider/blank pages from already-captured source screenshots.
 *
 * Court exhibits often lead with a cover sheet ("Exhibit G") that's useless to a
 * reader — and in the email only the first image shows. This classifies each
 * already-rendered page image on disk (cheap Haiku vision) and rewrites each
 * post's screenshots[] to keep only real correspondence/content pages, in order.
 * If a post has no readable content page, screenshots[] becomes [] (the post
 * falls back to its "view original" link).
 *
 *   npm run prune-covers -- --dry-run        # show decisions, write nothing
 *   npm run prune-covers                      # apply
 *   npm run prune-covers -- --only=slug,slug  # limit to specific posts
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { claude, MODELS } from "@/lib/anthropic";
import type { Post, PostScreenshot } from "@/lib/types";

const CONTENT = path.join(process.cwd(), "content", "posts");
const SHOTS = path.join(process.cwd(), "public", "screenshots");

const PROMPT = `You are screening ONE page from a court/legal or business source document. The newsletter reproduces real corporate correspondence, so be INCLUSIVE — keep anything a reader might want.

Answer "CONTENT" if the page contains ANY readable document substance: an email (even just From/To/Subject headers, even if the body is redacted, abridged, or short), a letter, a memo, a message/chat thread, body text, a report or filing section, a table or financial figures, slides, or handwritten notes.

Answer "SKIP" ONLY when the page is essentially nothing but a divider: it contains ONLY an exhibit/cover label such as "EXHIBIT G" or "PLAINTIFF'S EXHIBIT PX-1234" (and nothing else), OR it is entirely blank, OR it is purely a certificate of service.

When in doubt, answer CONTENT. Reply with only the word CONTENT or SKIP.`;

async function isContent(file: string): Promise<boolean> {
  try {
    const small = await sharp(file).resize({ width: 768, withoutEnlargement: true }).png().toBuffer();
    const res = await claude.messages.create({
      model: MODELS.triage,
      max_tokens: 8,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: small.toString("base64") } },
        { type: "text", text: PROMPT },
      ] }],
    });
    const b = res.content[0];
    const v = b?.type === "text" ? b.text.trim().toUpperCase() : "";
    return !v.startsWith("SKIP");
  } catch {
    return true; // keep on error — never silently drop content
  }
}

/**
 * Multi-page PDF exhibit page files for a post (p1..p6), in reading order. Only
 * these are pruned — the cover/divider problem is specific to multi-page court/
 * SEC PDFs. Single web-page captures (-web.png) are a whole document shot, never
 * a separate cover sheet, so they're left untouched.
 */
function candidateFiles(slug: string): string[] {
  const pages: string[] = [];
  for (let n = 1; n <= 6; n++) {
    const f = path.join(SHOTS, `${slug}-p${n}.png`);
    if (fs.existsSync(f)) pages.push(f);
  }
  return pages;
}

function caption(post: Post, idx: number, total: number): string {
  const base = `Source document — ${post.documentTitle} · ${post.sourceCase} · ${post.sourceCitation}`;
  return total > 1 ? `${base} (page ${idx + 1})` : base;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1].split(",").map((s) => s.trim()) : null;

  const files = (await fs.promises.readdir(CONTENT)).filter((f) => f.endsWith(".json"));
  let changed = 0;
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    if (only && !only.includes(slug)) continue;
    const post = JSON.parse(await fs.promises.readFile(path.join(CONTENT, f), "utf8")) as Post;
    const cands = candidateFiles(slug);
    if (!cands.length) continue;

    const verdicts: { file: string; keep: boolean }[] = [];
    for (const c of cands) verdicts.push({ file: path.basename(c), keep: await isContent(c) });
    const kept = verdicts.filter((v) => v.keep);

    const before = (post.screenshots ?? []).map((s) => s.url.split("/").pop()).join(",");
    const after = kept.map((v) => v.file).join(",");
    const note = verdicts.map((v) => `${v.file.replace(`${slug}-`, "")}=${v.keep ? "keep" : "DROP"}`).join(" ");
    const flag = before === after ? "" : "  <-- CHANGED";
    console.log(`${slug}\n  ${note}${flag}\n  before:[${before}] after:[${after || "(none → source link)"}]`);

    if (!dry && before !== after) {
      post.screenshots = kept.map((v, i) => {
        const file = v.file;
        return {
          url: `/screenshots/${file}`,
          caption: caption(post, i, kept.length),
          alt: `${post.documentTitle}${kept.length > 1 ? ` — page ${i + 1}` : ""}`,
        } as PostScreenshot;
      });
      await fs.promises.writeFile(path.join(CONTENT, f), JSON.stringify(post, null, 2), "utf8");
      changed += 1;
    }
  }
  console.log(`\n${dry ? "[dry-run] would change" : "changed"} ${changed} post(s).`);
}

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
