// Daily reply digest: once a day (from the cron) we read the Tier-1 targets'
// recent tweets and pre-draft replies, then store the snapshot. The admin page
// reads the stored snapshot so replies are ready instantly — no live, rate-
// limited X fetch on page load. See lib/social/timeline-fetch.ts for the fetch
// caveats and app/api/cron/daily for the schedule.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { REPLY_TARGETS } from "@/lib/social/reply-targets";
import { fetchRecentTweets, type FeedError } from "@/lib/social/timeline-fetch";
import { suggestReplies, type ReplyOption } from "@/lib/social/reply";

const PER_HANDLE = 2; // keep the daily Claude spend + rate-limit exposure small
const KEEP = 5; // retained snapshots per tier

export interface DigestTweet {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  favs: number;
  replies: ReplyOption[];
}
export interface DigestFeed {
  handle: string;
  name: string;
  fit: string;
  error?: FeedError;
  tweets: DigestTweet[];
}
export interface ReplyDigestData {
  feeds: DigestFeed[];
}

/** Read the tier's targets and draft replies for each recent tweet. */
export async function buildTierDigest(tier = 1): Promise<ReplyDigestData> {
  const group = REPLY_TARGETS[tier - 1] ?? REPLY_TARGETS[0];

  // Phase 1: fetch each handle's tweets SEQUENTIALLY (X rate-limits per IP).
  const fetched: Array<{ name: string; fit: string; handle: string; error?: FeedError; tweets: DigestTweet[] }> = [];
  for (const t of group.targets) {
    const feed = await fetchRecentTweets(t.handle, PER_HANDLE);
    fetched.push({
      name: t.name,
      fit: t.fit,
      handle: feed.handle,
      error: feed.error,
      tweets: feed.tweets.map((tw) => ({ ...tw, replies: [] as ReplyOption[] })),
    });
    await new Promise((r) => setTimeout(r, 300)); // polite gap between handles
  }

  // Phase 2: draft replies for ALL tweets in parallel (Claude, no rate-limit
  // coupling) so total time is one round-trip, not one per tweet.
  const jobs: Array<Promise<void>> = [];
  for (const f of fetched) {
    for (const tw of f.tweets) {
      jobs.push(
        suggestReplies(tw.text, `@${f.handle}`)
          .then((r) => { tw.replies = r; })
          .catch(() => { tw.replies = []; }),
      );
    }
  }
  await Promise.all(jobs);

  return { feeds: fetched.map(({ handle, name, fit, error, tweets }) => ({ handle, name, fit, error, tweets })) };
}

/** Persist a snapshot and prune old ones. */
export async function saveTierDigest(tier: number, data: ReplyDigestData): Promise<void> {
  await db.replyDigest.create({
    data: { tier, data: data as unknown as Prisma.InputJsonValue },
  });
  const stale = await db.replyDigest.findMany({
    where: { tier },
    orderBy: { generatedAt: "desc" },
    skip: KEEP,
    select: { id: true },
  });
  if (stale.length) {
    await db.replyDigest.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}

/** Build + store in one call (used by the local CLI and the manual refresh).
 *  Skips saving an EMPTY snapshot (all handles rate-limited / no tweets) so a
 *  blocked run — e.g. from a datacenter IP — can never clobber a good digest. */
export async function refreshTierDigest(tier = 1): Promise<{ generatedAt: string; data: ReplyDigestData; saved: boolean; tweets: number }> {
  const data = await buildTierDigest(tier);
  const tweets = data.feeds.reduce((n, f) => n + f.tweets.length, 0);
  if (tweets > 0) await saveTierDigest(tier, data);
  return { generatedAt: new Date().toISOString(), data, saved: tweets > 0, tweets };
}

/** Load the latest stored snapshot for a tier, or null if none yet. */
export async function loadLatestDigest(tier = 1): Promise<{ generatedAt: string; data: ReplyDigestData } | null> {
  const row = await db.replyDigest.findFirst({ where: { tier }, orderBy: { generatedAt: "desc" } });
  if (!row) return null;
  return { generatedAt: row.generatedAt.toISOString(), data: row.data as unknown as ReplyDigestData };
}
