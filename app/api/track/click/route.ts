import { NextResponse } from "next/server";
import { recordTrackingHit, normaliseRecipient } from "@/lib/metrics/record-tracking";
import { b64urlDecode, trackingSecret, verifyTarget } from "@/lib/publish/track";

// GET /api/track/click?p=<slug>&u=<b64url target>&s=<sig>&e=<recipient>
//
// Records a newsletter click, then redirects to the target.
//
// OPEN-REDIRECT SAFETY: `u` is only honoured when `s` is a valid HMAC of it,
// signed at HTML-build time with the same secret. So this endpoint can only ever
// send a visitor to a URL we ourselves put in an email — it cannot be used to
// launder an arbitrary destination through our domain. Anything that fails
// verification falls back to the site homepage rather than erroring at a reader.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function homeUrl(): string {
  return process.env.SITE_URL || "https://theleadershipletter.com";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("p") ?? "").trim();
  const encoded = url.searchParams.get("u") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  const secret = trackingSecret();

  let target: string | null = null;
  if (encoded && sig && secret) {
    try {
      const decoded = b64urlDecode(encoded);
      if (/^https?:\/\//i.test(decoded) && verifyTarget(decoded, sig, secret)) {
        target = decoded;
      }
    } catch {
      target = null;
    }
  }

  if (!target) {
    // Tampered, truncated by a mail client, or the secret rotated after send.
    // Don't show the reader an error — send them somewhere useful.
    return NextResponse.redirect(homeUrl(), 302);
  }

  if (slug) {
    await recordTrackingHit({
      type: "clicked",
      slug,
      email: normaliseRecipient(url.searchParams.get("e")),
      link: target,
      userAgent: req.headers.get("user-agent"),
    });
  }

  return NextResponse.redirect(target, 302);
}
