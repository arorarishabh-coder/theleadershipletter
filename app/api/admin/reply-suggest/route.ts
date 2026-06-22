import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { suggestReplies } from "@/lib/social/reply";
import { looksLikeTweetUrl, resolveTweet } from "@/lib/social/tweet-fetch";

// POST /api/admin/reply-suggest  { tweet, author?, angle? }
// `tweet` may be either the pasted tweet text OR an X/Twitter status URL — a URL
// is resolved server-side to its text (and author) before generating replies.
// Admin-only. Suggests value-add reply options for the daily reply game,
// matched to a relevant archive exhibit where one fits.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  let body: { tweet?: string; author?: string; angle?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const input = (body.tweet || "").trim();
  if (input.length < 5) return NextResponse.json({ error: "paste the tweet text or link" }, { status: 400 });

  // If they pasted a link, resolve it to text + author first.
  let tweet = input;
  let author = (body.author || "").trim();
  let resolved: { text: string; author: string; handle: string; url: string } | null = null;
  if (looksLikeTweetUrl(input)) {
    try {
      const t = await resolveTweet(input);
      tweet = t.text;
      if (!author) author = t.handle || t.author;
      resolved = { text: t.text, author: t.author, handle: t.handle, url: t.url };
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 422 });
    }
  }

  try {
    const replies = await suggestReplies(tweet, author, body.angle || "");
    return NextResponse.json({ ok: true, replies, resolved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
