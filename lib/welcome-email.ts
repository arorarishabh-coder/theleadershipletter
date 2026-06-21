// Welcome email — sent to a new subscriber immediately after they're added to
// the Resend audience. Mirrors the newsletter's visual language (parchment
// background, ink masthead, serif body, brick accent) and uses Resend's
// {{{RESEND_UNSUBSCRIBE_URL}}} merge tag for the one-click unsubscribe link.

interface WelcomeEmail {
  to: string;
  siteUrl?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const WELCOME_SUBJECT = "Welcome to The Leadership Letter";

/** One-click unsubscribe URL — used both inline in the body and in the
 *  List-Unsubscribe header. Same token-less scheme: `?email=<addr>`. */
export function unsubscribeUrlFor(email: string, siteUrl = ""): string {
  const base = siteUrl || "https://theleadershipletter.com";
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildWelcomeEmailHtml({ to, siteUrl = "" }: WelcomeEmail): string {
  const homeUrl = siteUrl || "https://theleadershipletter.com";
  const unsubscribeUrl = unsubscribeUrlFor(to, siteUrl);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Welcome to The Leadership Letter</title>
</head>
<body style="margin:0;padding:0;background:#f4efe6;">
  <div style="max-width:620px;margin:0 auto;padding:40px 24px;background:#fbf8f1;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;line-height:1.6;">

    <div style="text-align:center;border-bottom:2px solid #1c1a17;padding-bottom:18px;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;">Welcome &middot; The daily edition</div>
      <div style="font-size:30px;font-weight:600;margin-top:8px;letter-spacing:-0.01em;">The Leadership Letter</div>
      <div style="font-size:12px;color:#8a8378;margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-style:italic;">One real corporate letter, and the lesson it teaches.</div>
    </div>

    <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px;font-weight:600;letter-spacing:-0.01em;">You're in.</h1>
    <p style="font-size:17px;margin:0 0 18px;color:#1c1a17;">Thanks for subscribing. The next edition lands in your inbox at <strong>7&nbsp;a.m. Central</strong>, the next weekday morning.</p>
    <p style="font-size:15px;color:#5c574e;margin:0 0 24px;font-style:italic;">Holidays off. No more, no less. The pace is deliberate &mdash; the goal is to think about one document well, not to read ten of them poorly.</p>

    <div style="margin:28px 0;border-top:1px solid #ddd6c8;border-bottom:1px solid #ddd6c8;padding:20px 0;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;margin-bottom:14px;">What each edition contains</div>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;width:90px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;">Source</td>
          <td style="padding:6px 0;font-size:15px;color:#1c1a17;">The original document, linked and screenshotted.</td>
        </tr>
        <tr>
          <td style="padding:6px 0;width:90px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;">Excerpt</td>
          <td style="padding:6px 0;font-size:15px;color:#1c1a17;">A short, careful read of the writing itself.</td>
        </tr>
        <tr>
          <td style="padding:6px 0;width:90px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;">Lesson</td>
          <td style="padding:6px 0;font-size:15px;color:#1c1a17;">One thing to notice &mdash; not a takeaway, a noticing.</td>
        </tr>
        <tr>
          <td style="padding:6px 0;width:90px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;">Context</td>
          <td style="padding:6px 0;font-size:15px;color:#1c1a17;">What was happening when the letter was written.</td>
        </tr>
      </table>
    </div>

    <p style="font-size:15px;color:#1c1a17;margin:24px 0 8px;">While you wait, read the most recent edition:</p>
    <div style="margin:16px 0 28px;">
      <a href="${esc(homeUrl)}" style="display:inline-block;background:#1c1a17;color:#fbf8f1;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:0.18em;text-decoration:none;border:1px solid #1c1a17;">
        Read the latest letter &rarr;
      </a>
    </div>

    <p style="font-size:14px;color:#5c574e;margin:28px 0 0;font-style:italic;border-top:1px solid #ddd6c8;padding-top:18px;">A note on the product: no ads, no follow-up promotions, no "Pro" upsell. If the daily letter is enough for you, it's enough for us.</p>

    <div style="margin-top:32px;border-top:1px solid #ddd6c8;padding-top:18px;font-size:12px;color:#8a8378;font-family:Arial,Helvetica,sans-serif;line-height:1.5;text-align:center;">
      <p style="margin:0 0 6px;">You're receiving this because you subscribed to The Leadership Letter daily edition.</p>
      <p style="margin:0;"><a href="${esc(unsubscribeUrl)}" style="color:#8a8378;">Unsubscribe</a> &middot; theleadershipletter.com</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWelcomeEmailText({ to, siteUrl = "" }: WelcomeEmail): string {
  const homeUrl = siteUrl || "https://theleadershipletter.com";
  const unsubscribeUrl = unsubscribeUrlFor(to, siteUrl);
  return `You're in.

Thanks for subscribing to The Leadership Letter. The next edition lands in your inbox at 7 a.m. Central, the next weekday morning.

Holidays off. The pace is deliberate — the goal is to think about one document well, not to read ten of them poorly.

What each edition contains:
  Source   — the original document, linked and screenshotted
  Excerpt  — a short, careful read of the writing itself
  Lesson   — one thing to notice, not a takeaway
  Context  — what was happening when the letter was written

Read the most recent edition: ${homeUrl}

No ads, no follow-up promotions, no "Pro" upsell.

— The Leadership Letter
Unsubscribe in one click: ${unsubscribeUrl}
`;
}
