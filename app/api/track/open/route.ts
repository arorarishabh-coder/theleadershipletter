import { NextResponse } from "next/server";
import { recordTrackingHit, normaliseRecipient } from "@/lib/metrics/record-tracking";

// GET /api/track/open?p=<slug>&e=<recipient>
//
// The newsletter open pixel. Always returns a 1x1 transparent GIF, even on a
// bad request or a DB failure — a broken image in the email would be visible to
// the reader, and tracking is never worth that.
//
// See lib/publish/track.ts for why we host this ourselves instead of using
// Resend's open tracking.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function pixelResponse() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Must not be cached, or the second open never reaches us.
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("p") ?? "").trim();

  if (slug) {
    await recordTrackingHit({
      type: "opened",
      slug,
      email: normaliseRecipient(url.searchParams.get("e")),
      userAgent: req.headers.get("user-agent"),
    });
  }

  return pixelResponse();
}
