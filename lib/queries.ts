import fs from "node:fs";
import path from "node:path";
import { posts as seedPosts, leaders, topics } from "./mock-data";
import { COMPANIES, PERSONS, companyMatches, getCompanyBySlug as taxoCompany, type Company, type Person } from "./taxonomy";
import type { Leader, Post, PostTopic, Topic } from "./types";

// Load generated posts from /content/posts/*.json and merge with seed posts.
// Memoized — the directory is read once per server process.
let cachedAllPosts: Post[] | null = null;

function loadGeneratedPosts(): Post[] {
  try {
    const dir = path.join(process.cwd(), "content", "posts");
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(dir, f), "utf8");
          return JSON.parse(raw) as Post;
        } catch {
          return null;
        }
      })
      .filter((p): p is Post => p !== null);
  } catch {
    return [];
  }
}

function getMergedPosts(): Post[] {
  if (cachedAllPosts === null) {
    const generated = loadGeneratedPosts();
    // Generated posts take precedence on slug collision (manual rerun overrides seed)
    const generatedSlugs = new Set(generated.map((p) => p.slug));
    const merged = [...generated, ...seedPosts.filter((p) => !generatedSlugs.has(p.slug))];
    cachedAllPosts = merged;
  }
  return cachedAllPosts;
}

export function getAllPosts(): Post[] {
  return [...getMergedPosts()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * The homepage hero. Rotates DAILY (deterministic by UTC day) through the real
 * sourced letters — not pinned to one post, and excluding the seed/demo posts so
 * the front page always leads with genuine court/EDGAR-sourced correspondence.
 * (The page uses ISR so this actually changes on the live site each day.)
 */
export function getFeaturedPost(): Post | undefined {
  const all = getAllPosts(); // newest first
  if (!all.length) return undefined;
  const seedSlugs = new Set(seedPosts.map((p) => p.slug));
  const pool = all.filter((p) => !seedSlugs.has(p.slug));
  const featPool = pool.length ? pool : all;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return featPool[dayIndex % featPool.length];
}

export function getRecentPosts(excludeSlugs: string[] = [], limit?: number): Post[] {
  const sorted = getAllPosts().filter((p) => !excludeSlugs.includes(p.slug));
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

// Seeded PRNG so a given day produces one stable ordering (shuffles daily, not per request).
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The homepage grid: ALL posts in a daily-deterministic shuffle. Stable within a
 * UTC day, reshuffled the next — so the whole front page feels fresh each day.
 * (Paired with ISR on the page so it actually updates on the live site.)
 */
export function getDailyFeed(excludeSlugs: string[] = []): Post[] {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const posts = getMergedPosts().filter((p) => !excludeSlugs.includes(p.slug));
  const rng = mulberry32(dayIndex + 1);
  const a = [...posts];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getPostBySlug(slug: string): Post | undefined {
  return getMergedPosts().find((p) => p.slug === slug);
}

export function getPostsByLeader(leaderSlug: string, excludeSlug?: string): Post[] {
  return getMergedPosts()
    .filter((p) => p.leaderSlugs.includes(leaderSlug) && p.slug !== excludeSlug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPostsByTopic(topic: PostTopic, excludeSlug?: string): Post[] {
  return getMergedPosts()
    .filter((p) => p.topics.includes(topic) && p.slug !== excludeSlug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getLeaderBySlug(slug: string): Leader | undefined {
  const full = leaders.find((l) => l.slug === slug);
  if (full) return full;
  // Fall back to the browse-taxonomy person (now carries a bio/companies/era).
  const person = PERSONS.find((p) => p.slug === slug);
  if (person) {
    return {
      slug: person.slug,
      name: person.name,
      companies: person.companies ?? [],
      era: person.era ?? "",
      bio: person.bio ?? "",
    };
  }
  return undefined;
}

// ---- Companies & persons (browse facets) ----
export function getAllCompanies(): Company[] {
  return COMPANIES;
}

export function getAllPersons(): Person[] {
  return PERSONS;
}

/**
 * Every person to surface in the Browse "Person" facet: the curated taxonomy
 * universe PLUS anyone who actually has published letters (bio'd leaders, or
 * persons the pipeline attributed posts to). Derived live so new authors from
 * each ingest run appear automatically — the browse facet never goes stale.
 * Sorted by last name.
 */
export function getBrowsePersons(): { slug: string; name: string }[] {
  const bySlug = new Map<string, string>();
  for (const p of PERSONS) bySlug.set(p.slug, p.name);
  for (const l of getAllLeaders()) if (!bySlug.has(l.slug)) bySlug.set(l.slug, l.name);
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.split(" ").pop()!.localeCompare(b.name.split(" ").pop()!));
}

/**
 * Companies for the Browse "Company" facet: the full taxonomy, with the ones
 * that have published letters listed first (and alphabetical within each group),
 * so the live archive surfaces ahead of not-yet-covered names.
 */
export function getBrowseCompanies(): Company[] {
  return [...COMPANIES].sort((a, b) => {
    const ap = getPostsByCompany(a.slug).length > 0 ? 0 : 1;
    const bp = getPostsByCompany(b.slug).length > 0 ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });
}

export function getCompanyBySlug(slug: string): Company | undefined {
  return taxoCompany(slug);
}

export function getPostsByCompany(slug: string): Post[] {
  const company = taxoCompany(slug);
  if (!company) return [];
  return getMergedPosts()
    .filter((p) => companyMatches(company, p.authorsCompany))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getTopicBySlug(slug: PostTopic | string): Topic | undefined {
  return topics.find((t) => t.slug === (slug as PostTopic));
}

export function getAllLeaders(): Leader[] {
  // Curated bio'd leaders, plus any browse-taxonomy person who actually has
  // published letters (so marquee authors like Buffett/Jassy/Hastings appear in
  // the index once their posts land). Mock-data bios take precedence on collision.
  const bySlug = new Map<string, Leader>();
  for (const l of leaders) bySlug.set(l.slug, l);
  const slugsWithPosts = new Set<string>();
  for (const p of getMergedPosts()) for (const s of p.leaderSlugs) slugsWithPosts.add(s);
  for (const person of PERSONS) {
    if (slugsWithPosts.has(person.slug) && !bySlug.has(person.slug)) {
      bySlug.set(person.slug, {
        slug: person.slug,
        name: person.name,
        companies: person.companies ?? [],
        era: person.era ?? "",
        bio: person.bio ?? "",
      });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.split(" ").pop()!.localeCompare(b.name.split(" ").pop()!));
}

export function getAllTopics(): Topic[] {
  return topics;
}

export function searchPosts(q: string): Post[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return getMergedPosts().filter((p) =>
    [
      p.title,
      p.lessonTitle,
      p.lessonBody,
      p.documentTitle,
      ...p.authorsName,
      p.authorsCompany,
      p.sourceCase,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

export function getGeneratedPostCount(): number {
  return loadGeneratedPosts().length;
}

export function formatIssueDate(date = new Date()): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${weekday} · ${day} ${month} ${year}`.toUpperCase();
}

export function formatDateline(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`.toUpperCase();
}

export function formatLongDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
