import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { suggestReplies } from "@/lib/social/reply";

// POST /api/admin/reply-suggest  { tweet, author?, angle? }
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
  const tweet = (body.tweet || "").trim();
  if (tweet.length < 5) return NextResponse.json({ error: "paste the tweet text" }, { status: 400 });

  try {
    const replies = await suggestReplies(tweet, body.author || "", body.angle || "");
    return NextResponse.json({ ok: true, replies });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
