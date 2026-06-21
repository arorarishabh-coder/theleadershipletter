// Branded magic-link email — matches the newsletter's visual language
// (parchment background, ink ink, brick accents, serif body, JetBrains-style
// mono in the dateline). Built to render correctly in Gmail, Outlook, and
// mobile clients (table-free, no external CSS, inline styles only).

interface MagicLinkEmail {
  to: string;
  url: string;
  host: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSignInEmailHtml({ url, host }: MagicLinkEmail): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Sign in to The Leadership Letter</title>
</head>
<body style="margin:0;padding:0;background:#f4efe6;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;background:#fbf8f1;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;line-height:1.6;">

    <div style="text-align:center;border-bottom:2px solid #1c1a17;padding-bottom:18px;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8378;font-family:Arial,Helvetica,sans-serif;">Members · Sign in</div>
      <div style="font-size:30px;font-weight:600;margin-top:8px;letter-spacing:-0.01em;">The Leadership Letter</div>
    </div>

    <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;font-weight:600;">Your sign-in link</h1>

    <p style="font-size:16px;margin:0 0 8px;color:#1c1a17;">Click the button below to finish signing in to <strong>${esc(host)}</strong>.</p>
    <p style="font-size:14px;margin:0 0 28px;color:#5c574e;font-style:italic;">The link will sign you in once and then expire — for your security.</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#fbf8f1;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:0.18em;text-decoration:none;border:1px solid #1c1a17;">
        Sign in &rarr;
      </a>
    </div>

    <p style="font-size:13px;color:#5c574e;margin:32px 0 0;">If the button doesn't work, paste this link into your browser:</p>
    <p style="font-size:12px;color:#8a8378;word-break:break-all;margin:6px 0 0;font-family:Consolas,'Courier New',monospace;">${esc(url)}</p>

    <div style="margin-top:40px;border-top:1px solid #ddd6c8;padding-top:18px;font-size:12px;color:#8a8378;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
      <p style="margin:0 0 6px;">Didn't request this? You can safely ignore it — the link won't sign anyone in unless someone clicks it.</p>
      <p style="margin:0;">The Leadership Letter &middot; theleadershipletter.com</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildSignInEmailText({ url, host }: MagicLinkEmail): string {
  return `Sign in to ${host}

Use this link to sign in:
${url}

The link will sign you in once and then expire.

If you didn't request this, you can safely ignore it.

— The Leadership Letter
`;
}
