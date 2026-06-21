import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { addContact } from "@/lib/publish/resend";
import { buildWelcomeEmailHtml, buildWelcomeEmailText, WELCOME_SUBJECT, unsubscribeUrlFor } from "@/lib/welcome-email";

// Newsletter signup — adds the email to the Resend audience the daily broadcast
// sends to. Called by the NewsletterCTA form. After a successful first-time
// signup, fires a one-shot welcome email so the new subscriber gets immediate
// confirmation (the daily broadcast won't reach them until the next morning, by 8 a.m. Central).

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendWelcomeEmail(to: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.RESEND_FROM || "The Leadership Letter <daily@theleadershipletter.com>";
  const siteUrl = process.env.SITE_URL || "";
  const unsubscribeUrl = unsubscribeUrlFor(to, siteUrl);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: WELCOME_SUBJECT,
        html: buildWelcomeEmailHtml({ to, siteUrl }),
        text: buildWelcomeEmailText({ to, siteUrl }),
        // RFC 8058 one-click unsubscribe — Apple Mail and Gmail score senders
        // heavily on whether these are present and the URL actually accepts a
        // POST. Without them, marketing-adjacent transactional mail to
        // @icloud.com lands as bounce and Gmail Workspace inboxes route to junk.
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[subscribe] welcome email send failed", res.status, body);
    }
  } catch (err) {
    // Don't fail the subscription if the welcome can't go out — the contact is
    // already on the audience and will receive the next daily broadcast.
    console.error("[subscribe] welcome email threw", err);
  }
}

export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email || "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  const result = await addContact(email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || "Could not subscribe." }, { status: 502 });
  }

  // Only send the welcome on a fresh signup — resubscribers shouldn't get it again.
  if (!result.already) {
    await sendWelcomeEmail(email);
    // Fire the funnel event server-side. Only on real new signups, not
    // resubscribes, so the metric reflects audience growth.
    await track(
      "newsletter_signup",
      { source: req.headers.get("referer") || "unknown" },
      { request: req },
    ).catch((err) => console.error("[analytics] newsletter_signup track failed", err));
  }

  return NextResponse.json({ ok: true, already: result.already ?? false });
}
