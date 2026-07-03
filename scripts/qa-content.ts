/**
 * Content-QA gate — the automated review the CHARTER (§ "QA agent pass") requires
 * before a generated post can go live. Run by the weekly generation workflow
 * after `discover --ingest`; a non-zero exit blocks the PR.
 *
 *   npm run qa:content                 # check posts changed vs origin/main
 *   npm run qa:content -- --all        # check every post in content/posts
 *   npm run qa:content -- --slug=a,b   # check specific slugs
 *   npm run qa:content -- --base=ref   # diff base for --changed (default origin/main)
 *   npm run qa:content -- --json       # emit a JSON summary line (for PR body)
 *
 * ERRORS block (missing required field, excerpt over the fair-use cap, missing or
 * placeholder screenshot file, unknown topic/sourceType). WARNINGS are reported
 * but don't fail (taxonomy orphans, OCR-transcribed text, excerpt near the cap) —
 * they tell the human reviewer what to look at in the PR.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Post } from "@/lib/types";
import { COMPANIES, companyMatches, getPersonBySlug } from "@/lib/taxonomy";

const POSTS_DIR = join(process.cwd(), "content", "posts");
const PUBLIC_DIR = join(process.cwd(), "public");

// Fair-use hard cap (the "lesser of 300 words OR 10% of source" upper bound).
const EXCERPT_WORD_CAP = 300;
const EXCERPT_WORD_WARN = 260;
const MIN_SCREENSHOT_BYTES = 3000;

const VALID_TOPICS = new Set([
  "competition", "product", "acquisitions", "app-stores", "ai", "strategy",
  "partnerships", "crisis-management", "fundraising", "comms", "technology",
  "board-governance", "leadership-transitions", "recruiting", "founding-moments",
  "finance", "policy",
]);
const VALID_SOURCE_TYPES = new Set([
  "sec_edgar", "court_exhibit", "congress", "foreign_gov", "self_published", "press_quoted",
]);

// Common to every post. The analysis fields differ by lane (see below).
const REQUIRED_STRINGS = [
  "slug", "title", "publishedAt", "dateAuthored", "excerptForBlog",
  "lessonTitle", "pullQuote", "sourceUrl", "sourceType", "authorsCompany",
] as const;
// Standard lesson posts require the three-part analysis; Notable Artifact posts
// require the "why this matters" note instead.
const LESSON_ANALYSIS_FIELDS = ["situation", "insight", "application"] as const;
const REQUIRED_ARRAYS = ["authorsName", "topics", "leadershipTraits", "screenshots"] as const;

interface PostReport {
  slug: string;
  file: string;
  errors: string[];
  warnings: string[];
}

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function wordCount(s: string): number {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}

/** Which post files to check. Default: changed vs origin/main; fallback: all. */
function targetFiles(): string[] {
  const all = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json"));
  if (hasFlag("all")) return all;

  const slugArg = arg("slug");
  if (slugArg) {
    const want = new Set(slugArg.split(",").map((s) => s.trim()));
    return all.filter((f) => want.has(f.replace(/\.json$/, "")));
  }

  const base = arg("base") || "origin/main";
  try {
    // Tracked changes (added/modified) vs base...
    const tracked = execSync(`git diff --name-only --diff-filter=AM ${base} -- content/posts`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    // ...plus brand-new UNTRACKED files (freshly generated posts aren't committed
    // yet, and `git diff` never lists untracked paths — this is the CI case).
    const untracked = execSync(`git ls-files --others --exclude-standard -- content/posts`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const changed = new Set(
      [...tracked.split("\n"), ...untracked.split("\n")]
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".json"))
        .map((p) => p.split("/").pop()!),
    );
    if (changed.size) return [...changed];
    console.log(`No content/posts changes vs ${base}.`);
    return [];
  } catch {
    console.log(`(could not diff vs ${base} — falling back to --all)`);
    return all;
  }
}

function checkPost(file: string): PostReport {
  const r: PostReport = { slug: file.replace(/\.json$/, ""), file, errors: [], warnings: [] };
  let post: Post;
  try {
    post = JSON.parse(readFileSync(join(POSTS_DIR, file), "utf8")) as Post;
  } catch (e) {
    r.errors.push(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return r;
  }

  // Required fields
  const rec = post as unknown as Record<string, unknown>;
  for (const k of REQUIRED_STRINGS) {
    const v = rec[k];
    if (typeof v !== "string" || v.trim() === "") r.errors.push(`missing/empty field: ${k}`);
  }
  for (const k of REQUIRED_ARRAYS) {
    const v = rec[k];
    if (!Array.isArray(v) || v.length === 0) r.errors.push(`missing/empty array: ${k}`);
  }

  // Lane-specific analysis: artifact posts need artifactNote; lesson posts need
  // the three-part situation/insight/application.
  if (post.postKind === "artifact") {
    if (typeof post.artifactNote !== "string" || post.artifactNote.trim() === "")
      r.errors.push(`artifact post missing/empty field: artifactNote`);
  } else {
    for (const k of LESSON_ANALYSIS_FIELDS) {
      const v = rec[k];
      if (typeof v !== "string" || v.trim() === "") r.errors.push(`missing/empty field: ${k}`);
    }
  }

  if (post.slug && post.slug !== r.slug) r.errors.push(`slug "${post.slug}" != filename "${r.slug}"`);

  // Fair-use excerpt cap
  const words = wordCount(post.excerptForBlog);
  if (words > EXCERPT_WORD_CAP) r.errors.push(`excerptForBlog ${words} words > ${EXCERPT_WORD_CAP} fair-use cap`);
  else if (words > EXCERPT_WORD_WARN) r.warnings.push(`excerptForBlog ${words} words (near ${EXCERPT_WORD_CAP} cap)`);

  // Enum validity
  for (const t of post.topics ?? []) if (!VALID_TOPICS.has(t)) r.errors.push(`unknown topic: ${t}`);
  if (post.sourceType && !VALID_SOURCE_TYPES.has(post.sourceType)) r.errors.push(`unknown sourceType: ${post.sourceType}`);

  // Screenshots must exist on disk, not be placeholders, and be non-trivial
  for (const [i, shot] of (post.screenshots ?? []).entries()) {
    if (!shot?.url) { r.errors.push(`screenshots[${i}] has no url`); continue; }
    if (shot.url.includes("_pending")) { r.errors.push(`screenshots[${i}] is a _pending placeholder`); continue; }
    const onDisk = join(PUBLIC_DIR, shot.url.replace(/^\//, ""));
    if (!existsSync(onDisk)) r.errors.push(`screenshots[${i}] file missing: ${shot.url}`);
    else if (statSync(onDisk).size < MIN_SCREENSHOT_BYTES) r.errors.push(`screenshots[${i}] too small (<${MIN_SCREENSHOT_BYTES}B): ${shot.url}`);
    if (!shot.alt || !shot.alt.trim()) r.warnings.push(`screenshots[${i}] missing alt text`);
  }

  // Taxonomy attribution (warn — orphans drop out of /leaders and /company browse)
  if (!post.leaderSlugs || post.leaderSlugs.length === 0) {
    r.warnings.push("leaderSlugs empty — post won't appear under any leader; add author(s) to lib/taxonomy PERSONS");
  } else {
    for (const s of post.leaderSlugs) {
      if (!getPersonBySlug(s)) r.warnings.push(`leaderSlug "${s}" not in PERSONS — add to lib/taxonomy.ts`);
    }
  }
  if (post.authorsCompany && !COMPANIES.some((c) => companyMatches(c, post.authorsCompany))) {
    r.warnings.push(`authorsCompany "${post.authorsCompany}" matches no COMPANIES facet — add an alias to lib/taxonomy.ts`);
  }

  // Provenance: OCR text deserves a closer human read
  if (post.textSource === "ocr_transcribed") {
    r.warnings.push("textSource=ocr_transcribed — verify the transcription against the source PDF");
  }

  return r;
}

function main() {
  const files = targetFiles();
  const reports = files.map(checkPost);
  const failed = reports.filter((r) => r.errors.length > 0);
  const warned = reports.filter((r) => r.warnings.length > 0);

  for (const r of reports) {
    const mark = r.errors.length ? "✗" : r.warnings.length ? "!" : "✓";
    console.log(`${mark} ${r.slug}`);
    for (const e of r.errors) console.log(`    ERROR  ${e}`);
    for (const w of r.warnings) console.log(`    warn   ${w}`);
  }

  console.log("");
  console.log(`Checked ${reports.length} post(s): ${reports.length - failed.length} ok, ${failed.length} failed, ${warned.length} with warnings.`);

  if (hasFlag("json")) {
    const summary = {
      checked: reports.length,
      passed: reports.length - failed.length,
      failed: failed.map((r) => ({ slug: r.slug, errors: r.errors })),
      warnings: warned.map((r) => ({ slug: r.slug, warnings: r.warnings })),
    };
    console.log("QA_CONTENT_JSON " + JSON.stringify(summary));
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main();
