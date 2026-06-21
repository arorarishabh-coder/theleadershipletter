// Branded daily Chief-of-Staff digest email. Plain table-based HTML so it renders
// in every mail client. Mirrors the newsletter's visual language.

import type { DigestMetrics } from "@/lib/metrics/collect";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function delta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export const DIGEST_SUBJECT = (m: DigestMetrics, dateLabel: string) =>
  `Daily Brief · ${m.audience.total} subs · ${fmtUsd(m.revenue.mrrCents)} MRR · ${dateLabel}`;

export function buildDigestEmailHtml(m: DigestMetrics, dateLabel: string): string {
  const big = (label: string, value: string, sub: string) =>
    `<td style="width:33.33%;padding:14px 10px;text-align:center;border:1px solid #ddd6c8;">
      <div style="font-size:30px;font-weight:600;color:#1c1a17;letter-spacing:-0.01em;">${value}</div>
      <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;margin-top:4px;">${label}</div>
      <div style="font-size:12px;color:#5c574e;margin-top:2px;">${sub}</div>
    </td>`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8378;">${label}</td><td style="padding:7px 0;text-align:right;font-size:15px;color:#1c1a17;">${value}</td></tr>`;

  const sectionLabel = (t: string) =>
    `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;margin:26px 0 6px;border-top:1px solid #ddd6c8;padding-top:16px;">${t}</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Daily Brief</title></head>
<body style="margin:0;padding:0;background:#f4efe6;">
  <div style="max-width:600px;margin:0 auto;padding:36px 24px;background:#fbf8f1;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;line-height:1.6;">
    <div style="text-align:center;border-bottom:2px solid #1c1a17;padding-bottom:16px;margin-bottom:24px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;">Daily Brief &middot; ${dateLabel}</div>
      <div style="font-size:26px;font-weight:600;margin-top:6px;">The Leadership Letter</div>
    </div>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>
      ${big("Subscribers", String(m.audience.total), `${delta(m.audience.new24h)} today`)}
      ${big("Paid members", String(m.revenue.paidSubs), `${delta(m.revenue.newSubs24h)} today`)}
      ${big("MRR", fmtUsd(m.revenue.mrrCents), `${m.revenue.monthly}m · ${m.revenue.annual}a`)}
    </tr></table>

    ${sectionLabel("Audience (newsletter)")}
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${row("Total subscribers", String(m.audience.total))}
      ${row("New in last 24h", delta(m.audience.new24h))}
      ${row("Unsubscribed (all-time)", String(m.audience.unsubscribed))}
    </table>

    ${sectionLabel("Members (accounts)")}
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${row("Total accounts", String(m.members.totalUsers))}
      ${row("New accounts (24h)", delta(m.members.newUsers24h))}
      ${row("Free-week trials started (24h)", delta(m.members.trialsStarted24h))}
      ${row("Active trials", String(m.members.trialActive))}
      ${row("Trials expired (not converted)", String(m.members.trialExpired))}
      ${row("Registered, no trial yet", String(m.members.registered))}
    </table>

    ${sectionLabel("Revenue")}
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${row("MRR", fmtUsd(m.revenue.mrrCents))}
      ${row("Paid subscribers", `${m.revenue.paidSubs} (${m.revenue.monthly} monthly · ${m.revenue.annual} annual)`)}
      ${row("New paid (24h)", delta(m.revenue.newSubs24h))}
    </table>

    ${sectionLabel("Content")}
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${row("Today's edition", m.content.todayTitle ? m.content.todayTitle.slice(0, 60) : "—")}
      ${row("Buffer remaining", `${m.content.bufferRemaining} posts (~${m.content.bufferRemaining} days)`)}
    </table>

    <div style="margin-top:28px;border-top:1px solid #ddd6c8;padding-top:14px;font-size:11px;color:#8a8378;font-family:Arial,Helvetica,sans-serif;text-align:center;line-height:1.5;">
      <p style="margin:0 0 4px;">Open &amp; click rates and traffic/reach are coming next (Resend webhooks + event logging).</p>
      <p style="margin:0;">The Leadership Letter &middot; automated daily brief</p>
    </div>
  </div>
</body></html>`;
}

export function buildDigestEmailText(m: DigestMetrics, dateLabel: string): string {
  return `THE LEADERSHIP LETTER — Daily Brief — ${dateLabel}

Subscribers: ${m.audience.total} (${delta(m.audience.new24h)} today)
Paid members: ${m.revenue.paidSubs} (${delta(m.revenue.newSubs24h)} today)
MRR: ${fmtUsd(m.revenue.mrrCents)} (${m.revenue.monthly} monthly, ${m.revenue.annual} annual)

AUDIENCE
  Total subscribers: ${m.audience.total}
  New (24h): ${delta(m.audience.new24h)}
  Unsubscribed: ${m.audience.unsubscribed}

MEMBERS
  Total accounts: ${m.members.totalUsers}
  New accounts (24h): ${delta(m.members.newUsers24h)}
  Trials started (24h): ${delta(m.members.trialsStarted24h)}
  Active trials: ${m.members.trialActive}
  Trials expired: ${m.members.trialExpired}
  Registered, no trial: ${m.members.registered}

CONTENT
  Today's edition: ${m.content.todayTitle ?? "—"}
  Buffer remaining: ${m.content.bufferRemaining} posts

(Open/click rates + reach coming next.)`;
}
