import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// POST /api/stripe/portal
// Opens the Stripe Customer Portal for the signed-in user. The Manage billing
// button on /account posts here; we look up their Stripe customer id (from the
// Subscription row written by the webhook) and 303-redirect to the portal.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/signin?callbackUrl=/account", req.url), 303);
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });

  let customerId = user?.subscription?.stripeCustomerId || undefined;
  if (!customerId && user?.email) {
    const list = await stripe.customers.list({ email: user.email, limit: 1 });
    customerId = list.data[0]?.id;
  }
  if (!customerId) {
    return NextResponse.redirect(new URL("/membership", req.url), 303);
  }

  const origin = new URL(req.url).origin;
  const baseUrl = process.env.SITE_URL || origin;

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/account`,
  });

  return NextResponse.redirect(portal.url, 303);
}
