// Buffer-low alert — the safety net so the daily newsletter can never silently
// run dry. The daily cron computes how many un-broadcast posts remain; when that
// drops below the threshold it emails the admin(s) to run/merge the content job.
// Called only from the once-a-day cron, so it's naturally rate-limited to one
// nag per day (no cross-invocation dedup needed).

export const BUFFER_ALERT_THRESHOLD = 10;

function adminRecipients(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Email the admin(s) that the send buffer is low. Never throws — buffer alerting
 * must not break the daily send. Returns true if an alert was dispatched.
 */
export async function sendBufferLowAlert(unsent: number): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = adminRecipients();
  if (!key || to.length === 0) return false;

  const from = process.env.RESEND_FROM || "The Leadership Letter <daily@theleadershipletter.com>";
  const days = unsent; // ~1 post sent/day, so remaining posts ≈ remaining days
  const subject = `Buffer low: ${unsent} post${unsent === 1 ? "" : "s"} left in The Leadership Letter queue`;
  const text = `The daily-send buffer is down to ${unsent} un-broadcast post${unsent === 1 ? "" : "s"} (~${days} day${days === 1 ? "" : "s"} of runway).

Replenish it: trigger the "Generate content" GitHub Action (or run \`npm run discover -- --from-edgar --marquee --ingest\` locally), then review + merge the PR. New posts deploy automatically on merge.

— The Leadership Letter ops`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1a17;line-height:1.6;max-width:560px;">
  <p><strong>Buffer low.</strong> The daily-send queue is down to <strong>${unsent}</strong> un-broadcast post${unsent === 1 ? "" : "s"} (~${days} day${days === 1 ? "" : "s"} of runway).</p>
  <p>Replenish it: trigger the <em>Generate content</em> GitHub Action (or run <code>npm run discover -- --from-edgar --marquee --ingest</code> locally), then review + merge the PR. New posts deploy automatically on merge.</p>
  <p style="color:#8a8378;">— The Leadership Letter ops</p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      console.error("[buffer-alert] send failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[buffer-alert] threw", e);
    return false;
  }
}
