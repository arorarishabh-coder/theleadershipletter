import { NextResponse } from "next/server";
import { collectMetrics } from "@/lib/metrics/collect";
import { buildDigestEmailHtml, buildDigestEmailText, DIGEST_SUBJECT } from "@/lib/metrics/digest-email";
import { refreshTierDigest } from "@/lib/social/reply-digest";

// Daily Chief-of-Staff digest. Vercel hits this once a day (see vercel.json,
// 7:30am Central). Collects the metrics we can query today and emails a branded
// brief to ADMIN_EMAILS. Protected by CRON_SECRET like the newsletter cron.
// Add ?test=1 (with the secret) to preview without it being the scheduled run.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Best-effort: refresh the daily reply digest (Tier-1 tweets + drafted replies)
  // so /admin/reply shows ready-to-post replies each morning. Runs independently
  // of the metrics email below and never breaks the cron.
  let replyDigest: { generatedAt: string; tweets: number } | null = null;
  try {
    const { generatedAt, data } = await refreshTierDigest(1);
    replyDigest = { generatedAt, tweets: data.feeds.reduce((n, f) => n + f.tweets.length, 0) };
  } catch (err) {
    console.error("[cron] reply digest refresh failed", err);
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "The Leadership Letter <daily@theleadershipletter.com>";
  const to = (process.env.ADMIN_EMAILS || "arorarishabh@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || to.length === 0) {
    return NextResponse.json({ ok: false, error: "Resend or ADMIN_EMAILS not configured", replyDigest }, { status: 200 });
  }

  const metrics = await collectMetrics();
  const dateLabel = new Date(metrics.generatedAt).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago",
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: DIGEST_SUBJECT(metrics, dateLabel),
      html: buildDigestEmailHtml(metrics, dateLabel),
      text: buildDigestEmailText(metrics, dateLabel),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `Resend send ${res.status}: ${body.slice(0, 200)}`, metrics, replyDigest }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: to, metrics, replyDigest });
}
