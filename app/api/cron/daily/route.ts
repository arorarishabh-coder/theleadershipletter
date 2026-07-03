import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/queries";
import { isPublished, listBroadcastsByName, listPublishedIdentities, publishToResend } from "@/lib/publish/resend";
import { BUFFER_ALERT_THRESHOLD, sendBufferLowAlert } from "@/lib/publish/buffer-alert";
import { selectNextForVariety, sourceGroupKey } from "@/lib/publish/schedule";

// Daily newsletter cron. Vercel hits this once a day (see vercel.json). It picks
// the next buffered post not yet sent and creates a Resend broadcast for it.
// To keep editions varied (not e.g. weeks of the same company's exhibits in a
// row), it sends the oldest post from the publisher emailed *least recently*,
// rather than strictly oldest-overall. State lives in Resend (no DB): we list
// existing broadcasts and skip those.
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
  const allPosts = getAllPosts();
  const unsent = allPosts.filter((p) => !isPublished(p, published));

  // Most-recent emailed date per publisher group, joined from Resend's actual
  // sent_at back onto our corpus — drives the round-robin so we don't send the
  // same publisher two days running while other publishers wait.
  const broadcasts = await listBroadcastsByName();
  const bySlug = new Map(allPosts.map((p) => [p.slug.toLowerCase(), p]));
  const lastSentByGroup = new Map<string, string>();
  for (const [slug, info] of broadcasts) {
    if (!info.sentAt) continue;
    const post = bySlug.get(slug);
    if (!post) continue;
    const g = sourceGroupKey(post);
    if (info.sentAt > (lastSentByGroup.get(g) ?? "")) lastSentByGroup.set(g, info.sentAt);
  }
  const next = selectNextForVariety(unsent, lastSentByGroup);

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
