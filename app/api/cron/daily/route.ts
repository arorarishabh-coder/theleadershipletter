import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/queries";
import { isPublished, listPublishedIdentities, publishToResend } from "@/lib/publish/resend";
import { BUFFER_ALERT_THRESHOLD, sendBufferLowAlert } from "@/lib/publish/buffer-alert";

// Daily newsletter cron. Vercel hits this once a day (see vercel.json). It finds
// the oldest buffered post not yet sent and creates a Resend broadcast for it.
// State lives in Resend (no DB): we list existing broadcasts and skip those.
//
// Safety: defaults to a Resend DRAFT for human review (a daily email is
// irreversible). Set CRON_AUTO_CONFIRM=true to send automatically.
// Protect the endpoint with CRON_SECRET — Vercel signs cron requests with it.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel adds `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_AUDIENCE_ID) {
    return NextResponse.json({ ok: true, skipped: "Resend not configured (set RESEND_API_KEY + RESEND_AUDIENCE_ID)" });
  }

  const published = await listPublishedIdentities();
  const unsent = getAllPosts()
    .filter((p) => !isPublished(p, published))
    .sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""));
  const next = unsent[0];

  // Safety net: warn the admin before the buffer empties. The cron runs once a
  // day, so this nags at most once per day until the queue is replenished.
  // `unsent` still includes today's `next`, so the count reflects remaining runway.
  let bufferAlertSent = false;
  if (unsent.length < BUFFER_ALERT_THRESHOLD) {
    bufferAlertSent = await sendBufferLowAlert(unsent.length).catch((err) => {
      console.error("[cron] buffer alert failed", err);
      return false;
    });
  }

  if (!next) {
    return NextResponse.json({
      ok: true,
      message: "Buffer exhausted — nothing new to send. Run the content job and merge the PR.",
      bufferRemaining: 0,
      bufferAlertSent,
    });
  }

  const status = process.env.CRON_AUTO_CONFIRM === "true" ? "confirmed" : "draft";
  const result = await publishToResend(next, { status });

  return NextResponse.json({
    ok: result.ok,
    slug: next.slug,
    title: next.title,
    status,
    sent: result.sent ?? false,
    broadcastId: result.id,
    error: result.error,
    bufferRemaining: unsent.length,
    bufferAlertSent,
  });
}
