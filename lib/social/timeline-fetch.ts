// Read a target account's RECENT tweets with no auth, via Twitter's public
// syndication timeline endpoint (the same CDN that powers embedded timelines).
// Used to pull the day's Tier-1 tweets into the reply assistant so you don't have
// to open each profile by hand.
//
// CAVEAT: this endpoint rate-limits aggressively per IP (429 after a handful of
// hits) and is unofficial — treat every failure as "skip this handle", cache
// hard, and only fetch on an explicit click. Returns [] (never throws) on any
// failure so one throttled handle can't break the batch.

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// X's syndication endpoint fingerprints the HTTP client: Node's built-in fetch
// (undici) is flagged as a bot and gets a blanket 429, while a real browser and
// plain `curl` are served normally. So off-Vercel we shell out to curl (ships
// with Windows 10+ and every mac/linux) to look like a browser. On Vercel — a
// datacenter IP that's blocked anyway, and where curl may be absent — we fall
// back to fetch; that run is expected to fail and is skipped without clobbering
// the stored digest (see refreshTierDigest). A sentinel appended via curl's -w
// lets us read the HTTP status without a temp file.
const STATUS_MARKER = "\n__HTTP_STATUS__:";

async function browserGet(url: string): Promise<{ status: number; body: string }> {
  if (!process.env.VERCEL) {
    try {
      const { stdout } = await execFileP(
        "curl",
        ["-s", "-A", USER_AGENT, "--max-time", "25", "-w", `${STATUS_MARKER}%{http_code}`, url],
        { maxBuffer: 24 * 1024 * 1024 },
      );
      const i = stdout.lastIndexOf(STATUS_MARKER);
      if (i === -1) return { status: 0, body: stdout };
      return { status: Number(stdout.slice(i + STATUS_MARKER.length)) || 0, body: stdout.slice(0, i) };
    } catch {
      return { status: 0, body: "" }; // curl missing / timed out → treat as unavailable
    }
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  return { status: res.status, body: res.ok ? await res.text() : "" };
}

// On-disk cache so repeated LOCAL runs don't re-hit X's aggressive rate limit —
// each handle is fetched at most once per ~20h; extra runs reuse the cache. Only
// active off-Vercel (the CLI); the serverless runtime has no writable cwd and
// doesn't fetch anyway.
const CACHE_DIR = join(process.cwd(), ".cache", "timeline");
const CACHE_TTL_MS = 20 * 60 * 60 * 1000;
const useDiskCache = !process.env.VERCEL;

function cachePath(handle: string): string {
  return join(CACHE_DIR, `${handle.toLowerCase()}.json`);
}
function readCache(handle: string): HandleFeed | null {
  if (!useDiskCache) return null;
  try {
    const p = cachePath(handle);
    if (!existsSync(p)) return null;
    if (Date.now() - statSync(p).mtimeMs > CACHE_TTL_MS) return null;
    const j = JSON.parse(readFileSync(p, "utf8")) as HandleFeed;
    return j && Array.isArray(j.tweets) && j.tweets.length ? j : null;
  } catch {
    return null;
  }
}
function writeCache(feed: HandleFeed): void {
  if (!useDiskCache || !feed.tweets.length) return; // only cache successful reads
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath(feed.handle), JSON.stringify(feed));
  } catch {
    /* cache is best-effort */
  }
}

export interface TimelineTweet {
  id: string;
  text: string;
  url: string;
  createdAt: string; // ISO-ish string from Twitter, or ""
  favs: number;
}

export type FeedError = "rate_limited" | "unavailable" | "empty";

export interface HandleFeed {
  handle: string;
  tweets: TimelineTweet[];
  error?: FeedError;
}

interface RawTweet {
  id_str?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  favorite_count?: number;
  retweeted_status?: unknown;
  in_reply_to_status_id_str?: string | null;
}

// Deep-scan any parsed JSON for tweet-shaped objects. Resilient to the exact
// __NEXT_DATA__ shape changing (the endpoint is unofficial), and dedups by id.
function collectTweets(node: unknown, out: Map<string, RawTweet>, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 12) return;
  const o = node as Record<string, unknown>;
  if (typeof o.id_str === "string" && (typeof o.full_text === "string" || typeof o.text === "string")) {
    if (!out.has(o.id_str)) out.set(o.id_str, o as RawTweet);
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") collectTweets(v, out, depth + 1);
  }
}

/** Fetch a handle's recent ORIGINAL tweets (no retweets/replies), newest first. */
export async function fetchRecentTweets(handle: string, limit = 3): Promise<HandleFeed> {
  const clean = handle.replace(/^@/, "").trim();
  const cached = readCache(clean);
  if (cached) return { ...cached, tweets: cached.tweets.slice(0, limit) };
  try {
    const { status, body: html } = await browserGet(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(clean)}`,
    );
    if (status === 429) return { handle: clean, tweets: [], error: "rate_limited" };
    if (status < 200 || status >= 300 || !html) return { handle: clean, tweets: [], error: "unavailable" };
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return { handle: clean, tweets: [], error: "unavailable" };

    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      return { handle: clean, tweets: [], error: "unavailable" };
    }

    const raw = new Map<string, RawTweet>();
    collectTweets(data, raw);

    const tweets: TimelineTweet[] = [...raw.values()]
      .filter((t) => !t.retweeted_status && !t.in_reply_to_status_id_str) // original posts only
      .map((t) => ({
        id: t.id_str!,
        text: (t.full_text || t.text || "").trim(),
        url: `https://x.com/${clean}/status/${t.id_str}`,
        createdAt: t.created_at || "",
        favs: t.favorite_count ?? 0,
      }))
      .filter((t) => t.text.length > 0)
      .sort((a, b) => (b.createdAt && a.createdAt ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : b.id.localeCompare(a.id)))
      .slice(0, limit);

    if (!tweets.length) return { handle: clean, tweets: [], error: "empty" };
    const feed: HandleFeed = { handle: clean, tweets };
    writeCache(feed);
    return feed;
  } catch {
    return { handle: clean, tweets: [], error: "unavailable" };
  }
}

/** Fetch several handles sequentially (small gap to be polite to the rate limit). */
export async function fetchFeeds(handles: string[], perHandle = 3): Promise<HandleFeed[]> {
  const out: HandleFeed[] = [];
  for (const h of handles) {
    out.push(await fetchRecentTweets(h, perHandle));
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}
