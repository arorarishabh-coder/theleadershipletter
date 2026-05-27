import { NextResponse } from "next/server";
import { addContact } from "@/lib/publish/resend";

// Newsletter signup — adds the email to the Resend audience the daily broadcast
// sends to. Called by the NewsletterCTA form.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return NextResponse.json({ ok: true, already: result.already ?? false });
}
