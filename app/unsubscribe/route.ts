import { NextResponse } from "next/server";

// /unsubscribe?email=<addr>
//
// Two access patterns:
//
// 1. GET — user clicked the unsubscribe link in the email. We remove the
//    contact from the Resend audience, then redirect to /unsubscribed for a
//    human confirmation page.
//
// 2. POST — Apple Mail and Gmail (and other RFC 8058 compliant clients) fire
//    a one-click POST against the List-Unsubscribe header URL when the user
//    hits the "Unsubscribe" link in the mail-client chrome. Same removal,
//    just return 200 with no body — the client renders its own UI.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function unsubscribeContact(email: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audienceId) return { ok: false, error: "Newsletter not configured." };

  // Resend's contacts API supports email-keyed delete (no separate id lookup).
  const res = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${key}` } },
  );
  if (res.ok) return { ok: true };

  // 404 = already gone. Treat as success so re-clicking the link is idempotent.
  if (res.status === 404) return { ok: true };

  const text = await res.text().catch(() => "");
  return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.redirect(new URL("/unsubscribed?status=invalid", req.url), 303);
  }
  const result = await unsubscribeContact(email);
  const status = result.ok ? "ok" : "error";
  return NextResponse.redirect(new URL(`/unsubscribed?status=${status}`, req.url), 303);
}

// RFC 8058 one-click unsubscribe — mail clients send `application/x-www-form-urlencoded`
// with `List-Unsubscribe=One-Click`. We don't actually need to parse the body;
// the email already encodes the recipient in the URL query.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
  }
  const result = await unsubscribeContact(email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
