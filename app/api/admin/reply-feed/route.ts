import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { REPLY_TARGETS } from "@/lib/social/reply-targets";
import { fetchRecentTweets, type HandleFeed } from "@/lib/social/timeline-fetch";

// GET /api/admin/reply-feed?tier=1
// Admin-only. Reads recent original tweets from the Tier-1 reply targets via the
// public syndication endpoint so the reply assistant can surface "today's tweets
// to reply to" without opening each profile. Rate-limit-friendly: cached per
// handle (600s in the fetcher), sequential, and each handle degrades to an error
// flag rather than failing the batch.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  const tierIdx = Math.max(0, (Number(new URL(req.url).searchParams.get("tier")) || 1) - 1);
  const group = REPLY_TARGETS[tierIdx] ?? REPLY_TARGETS[0];

  // Sequential with a small gap (in the fetcher) to stay under the rate limit.
  const feeds: Array<HandleFeed & { name: string; fit: string }> = [];
  for (const t of group.targets) {
    const feed = await fetchRecentTweets(t.handle, 3);
    feeds.push({ ...feed, name: t.name, fit: t.fit });
  }

  return NextResponse.json({ ok: true, group: group.title, feeds });
}
