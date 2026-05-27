import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/queries";
import { isPublished, listPublishedIdentities, publishToResend } from "@/lib/publish/resend";

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
  const next = getAllPosts()
    .filter((p) => !isPublished(p, published))
    .sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""))[0];

  if (!next) {
    return NextResponse.json({ ok: true, message: "Buffer exhausted — nothing new to send. Add posts and redeploy." });
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
  });
}
