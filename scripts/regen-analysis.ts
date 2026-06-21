/**
 * Regenerate the analysis for existing posts into the lean three-section format
 * (situation / insight / application), reusing each post's existing document
 * excerpt + metadata. Keeps slug, title, pullQuote, screenshots, and source
 * fields untouched — only the analysis body changes. Drops the legacy lessonBody.
 *
 *   npx tsx scripts/regen-analysis.ts --slug=a,b --dry   # preview, no write
 *   npx tsx scripts/regen-analysis.ts --slug=a,b         # write those posts
 *   npx tsx scripts/regen-analysis.ts --all [--limit=N]  # the whole archive
 *
 * Needs ANTHROPIC_API_KEY. ~$0.02–0.08 per post (Sonnet).
 */

import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Post } from "@/lib/types";
import { claude, MODELS } from "@/lib/anthropic";
import { EDITORIAL_SYSTEM_PROMPT } from "@/lib/prompts/system";
import { LESSON_PROMPT } from "@/lib/prompts/lesson";

const POSTS_DIR = join(process.cwd(), "content", "posts");

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}
const has = (n: string) => process.argv.includes(`--${n}`);

function safeJSON<T>(raw: string): T | null {
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

interface NewAnalysis { situation: string; insight: string; application: string }

async function regen(post: Post): Promise<NewAnalysis | null> {
  const prompt = LESSON_PROMPT(
    post.documentTitle,
    post.dateAuthored,
    post.authorsName.join(" & "),
    post.authorsCompany,
    post.excerptForBlog,
    `${post.sourceCase} · ${post.sourceCitation}`,
  );
  const res = await claude.messages.create({
    model: MODELS.lesson,
    max_tokens: 2000,
    system: EDITORIAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text : "";
  const parsed = safeJSON<NewAnalysis>(text);
  if (!parsed?.situation || !parsed?.insight || !parsed?.application) return null;
  return { situation: parsed.situation.trim(), insight: parsed.insight.trim(), application: parsed.application.trim() };
}

function targets(): string[] {
  const all = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json"));
  const slug = arg("slug");
  if (slug) {
    const want = new Set(slug.split(",").map((s) => s.trim()));
    return all.filter((f) => want.has(f.replace(/\.json$/, "")));
  }
  if (has("all")) {
    const lim = arg("limit");
    return lim ? all.slice(0, parseInt(lim, 10)) : all;
  }
  return [];
}

async function main() {
  const files = targets();
  if (files.length === 0) {
    console.log("Nothing to do. Pass --slug=a,b or --all [--limit=N].");
    process.exit(1);
  }
  const dry = has("dry");
  console.log(`Regenerating analysis for ${files.length} post(s)${dry ? " (DRY RUN)" : ""}\n`);

  let ok = 0, fail = 0;
  for (const file of files) {
    const path = join(POSTS_DIR, file);
    const post = JSON.parse(readFileSync(path, "utf8")) as Post & { lessonBody?: string };
    const slug = post.slug;
    try {
      const a = await regen(post);
      if (!a) { console.log(`✗ ${slug} — could not parse model output`); fail++; continue; }
      if (dry) {
        console.log(`── ${slug} — "${post.lessonTitle}"`);
        console.log(`  THE SITUATION : ${a.situation}`);
        console.log(`  THE LESSON    : ${a.insight.replace(/\n+/g, " ")}`);
        console.log(`  PUT IT TO WORK: ${a.application.replace(/\n+/g, " ")}\n`);
      } else {
        post.situation = a.situation;
        post.insight = a.insight;
        post.application = a.application;
        delete post.lessonBody;
        writeFileSync(path, JSON.stringify(post, null, 2) + "\n");
        console.log(`✓ ${slug}`);
      }
      ok++;
    } catch (e) {
      console.log(`✗ ${slug} — ${e instanceof Error ? e.message : String(e)}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
