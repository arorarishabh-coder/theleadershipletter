import { getAllPosts } from "@/lib/queries";
import { listBroadcastsByName } from "@/lib/publish/resend";
import type { SourceType } from "@prisma/client";
import type { Post } from "@/lib/types";

// Admin dashboard queries. The editorial corpus lives in content/posts/*.json
// (one file per published article = one full pipeline cycle). The Prisma
// Document/Analysis/Publication tables are reserved for a future DB-backed
// pipeline but aren't populated today, so we read directly from the JSON store
// to keep the dashboard honest about reality.

export interface DailyBucket {
  /** ISO date (YYYY-MM-DD) in UTC. */
  day: string;
  published: number;
  newsletters: number;
}

export interface SourceBucket {
  source: SourceType;
  published: number;
}

export interface RecentPost {
  slug: string;
  title: string;
  source: SourceType;
  authorsCompany: string | null;
  publishedAt: string; // YYYY-MM-DD
  newsletterSentAt: string | null;
}

export interface AdminStats {
  range: { days: number; from: string; to: string };
  totals: {
    published: number;
    newsletters: number;
    archive: number; // total posts ever
    avgPerDay: number;
  };
  perDay: DailyBucket[];
  bySource: SourceBucket[];
  recent: RecentPost[];
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayString(s: string): string {
  // Posts store publishedAt as "YYYY-MM-DD"; safe to slice. Tolerate full ISO.
  return s.slice(0, 10);
}

export async function getAdminStats(days: number): Promise<AdminStats> {
  const all: Post[] = getAllPosts(); // already memoized in lib/queries

  // Pull broadcast send state from Resend (the actual source of truth — Vercel
  // is read-only at runtime so we can't stamp the JSON files). Each broadcast
  // is keyed by post slug. We treat any broadcast with a non-null sent_at as
  // a real "newsletter sent" event for that slug.
  const broadcasts = await listBroadcastsByName();

  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const fromDate = new Date(today);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1)); // inclusive of today
  const fromIso = isoDay(fromDate);
  const toIso = isoDay(today);

  // Resolve the effective sent-date for a post: prefer Resend's sent_at over
  // the stale JSON field (the JSON field exists on the type but isn't written).
  const sentDayFor = (p: Post): string | null => {
    const bc = broadcasts.get(p.slug.trim().toLowerCase());
    if (bc?.sentAt) return dayString(bc.sentAt);
    if (p.newsletterSentAt) return dayString(p.newsletterSentAt);
    return null;
  };

  const inWindow = all.filter((p) => {
    const d = dayString(p.publishedAt);
    return d >= fromIso && d <= toIso;
  });

  // Pre-seed every day in range so the chart shows zeros where there was no activity.
  const perDay: Map<string, DailyBucket> = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate);
    d.setUTCDate(d.getUTCDate() + i);
    const k = isoDay(d);
    perDay.set(k, { day: k, published: 0, newsletters: 0 });
  }
  for (const p of inWindow) {
    const day = dayString(p.publishedAt);
    const bucket = perDay.get(day);
    if (bucket) bucket.published++;
  }
  // Bucket newsletter sends by the *actual send day* (which may be outside the
  // post's publish day) so the chart shows real activity.
  for (const p of all) {
    const sentDay = sentDayFor(p);
    if (!sentDay) continue;
    const sentBucket = perDay.get(sentDay);
    if (sentBucket) sentBucket.newsletters++;
  }

  // Source breakdown — sorted by volume descending.
  const sourceMap: Map<SourceType, SourceBucket> = new Map();
  for (const p of inWindow) {
    const s = p.sourceType as SourceType;
    const v = sourceMap.get(s);
    if (v) v.published++;
    else sourceMap.set(s, { source: s, published: 1 });
  }
  const bySource = Array.from(sourceMap.values()).sort((a, b) => b.published - a.published);

  const recent: RecentPost[] = inWindow
    .slice()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 10)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      source: p.sourceType as SourceType,
      authorsCompany: p.authorsCompany || null,
      publishedAt: dayString(p.publishedAt),
      newsletterSentAt: sentDayFor(p),
    }));

  const publishedCount = inWindow.length;
  // Count newsletter sends whose actual delivery day falls inside the window.
  const newslettersCount = all.filter((p) => {
    const d = sentDayFor(p);
    return d !== null && d >= fromIso && d <= toIso;
  }).length;

  return {
    range: { days, from: fromIso, to: toIso },
    totals: {
      published: publishedCount,
      newsletters: newslettersCount,
      archive: all.length,
      avgPerDay: days > 0 ? Math.round((publishedCount / days) * 10) / 10 : 0,
    },
    perDay: Array.from(perDay.values()),
    bySource,
    recent,
  };
}

export function formatSource(s: SourceType | string): string {
  const map: Record<string, string> = {
    sec_edgar: "SEC EDGAR",
    court_exhibit: "Court exhibit",
    congress: "Congress",
    foreign_gov: "Foreign gov",
    self_published: "Self-published",
    press_quoted: "Press-quoted",
  };
  return map[s] ?? s;
}

export function formatThousands(n: number): string {
  return n.toLocaleString("en-US");
}
