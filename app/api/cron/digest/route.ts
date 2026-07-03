import { NextResponse } from "next/server";
import { collectMetrics } from "@/lib/metrics/collect";
import { buildDigestEmailHtml, buildDigestEmailText, DIGEST_SUBJECT } from "@/lib/metrics/digest-email";

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

  // NOTE: the reply digest is NOT refreshed here — X blocks the timeline endpoint
  // from datacenter IPs, so it's built by the local `npm run reply-digest` (see
  // scripts/reply-digest.ts) from a residential IP instead.

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "The Leadership Letter <daily@theleadershipletter.com>";
  const to = (process.env.ADMIN_EMAILS || "arorarishabh@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || to.length === 0) {
    return NextResponse.json({ ok: false, error: "Resend or ADMIN_EMAILS not configured" }, { status: 200 });
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
    return NextResponse.json({ ok: false, error: `Resend send ${res.status}: ${body.slice(0, 200)}`, metrics }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: to, metrics });
}
