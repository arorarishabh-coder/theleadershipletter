import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST /api/membership/start-trial
// Sets User.trialStartedAt to now() the first time it's called. Re-posts are
// no-ops (so the button can't be used to extend a trial). Membership entitlement
// is derived from this timestamp by membershipStatus() in lib/membership.ts.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/signin?callbackUrl=/membership", req.url), 303);
  }

  await db.user.updateMany({
    where: { email: session.user.email, trialStartedAt: null },
    data: { trialStartedAt: new Date() },
  });

  return NextResponse.redirect(new URL("/membership", req.url), 303);
}
