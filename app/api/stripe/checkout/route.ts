import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripe, priceIdForPlan } from "@/lib/stripe";

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for the signed-in user and 303-redirects
// them to Stripe Hosted Checkout. The membership-page <form> posts here with
// `plan=monthly|annual`. After payment, the webhook upserts the Subscription
// row; success/cancel here only handle UX.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/signin?callbackUrl=/membership", req.url), 303);
  }

  const form = await req.formData();
  const plan = String(form.get("plan") || "");
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json({ error: `Price not configured for ${plan}.` }, { status: 500 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Reuse the customer if we already have one — keeps cards on file, lets the
  // portal show prior invoices. If not, let Checkout create one (we'll capture
  // the id from the webhook).
  let customerId = user.subscription?.stripeCustomerId || undefined;
  if (!customerId) {
    const list = await stripe.customers.list({ email: user.email, limit: 1 });
    if (list.data[0]) customerId = list.data[0].id;
  }

  const origin = new URL(req.url).origin;
  const baseUrl = process.env.SITE_URL || origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: `${baseUrl}/account?checkout=success`,
    cancel_url: `${baseUrl}/membership?checkout=canceled`,
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  // Fire the funnel event server-side so ad-blockers can't suppress it. Captures
  // who made it from a page-view to a real Stripe Checkout Session creation.
  await track(
    "checkout_started",
    { plan, userId: user.id, reusedCustomer: Boolean(customerId) },
    { request: req },
  ).catch((err) => console.error("[analytics] checkout_started track failed", err));

  return NextResponse.redirect(checkout.url, 303);
}
