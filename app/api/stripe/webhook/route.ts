import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { track } from "@vercel/analytics/server";
import { stripe, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { db } from "@/lib/db";
import type { SubStatus } from "@prisma/client";

// POST /api/stripe/webhook
// Stripe → us. Signed with STRIPE_WEBHOOK_SECRET. We handle subscription
// lifecycle events and keep the `Subscription` row in sync. Entitlement is
// derived from this row by membershipStatus() in lib/membership.ts.
//
// Events we care about:
//   checkout.session.completed     — paid; link Stripe customer to user
//   customer.subscription.created  — initial subscription state
//   customer.subscription.updated  — plan change, cancel-at-period-end, status
//   customer.subscription.deleted  — fully canceled (period ended)
//   invoice.payment_failed         — moves to past_due / dunning

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, SubStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "past_due",
};

function planFromSub(sub: Stripe.Subscription): "monthly" | "annual" | null {
  const fromMetadata = sub.metadata?.plan;
  if (fromMetadata === "monthly" || fromMetadata === "annual") return fromMetadata;
  const priceId = sub.items.data[0]?.price?.id;
  if (priceId && priceId === STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId && priceId === STRIPE_PRICE_MONTHLY) return "monthly";
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items.data[0];
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

async function findUserIdForCustomer(customerId: string, fallbackEmail?: string | null): Promise<string | null> {
  const existing = await db.subscription.findUnique({ where: { stripeCustomerId: customerId } });
  if (existing) return existing.userId;
  if (fallbackEmail) {
    const user = await db.user.findUnique({ where: { email: fallbackEmail } });
    if (user) return user.id;
  }
  // Last-ditch: ask Stripe for the customer's email and look that up.
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted && customer.email) {
      const user = await db.user.findUnique({ where: { email: customer.email } });
      if (user) return user.id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function upsertSubscription(userId: string, sub: Stripe.Subscription): Promise<void> {
  const status = STATUS_MAP[sub.status] ?? "incomplete";
  const plan = planFromSub(sub);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Read prior state BEFORE the upsert so we can detect a transition into
  // `active` and fire the funnel event exactly once per activation.
  const prior = await db.subscription.findUnique({ where: { userId } });

  await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      status,
      plan,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      status,
      plan,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
  });

  // Transition detection. "Activated" covers: first-time signup (no prior row),
  // trial → paid conversion, and past_due/canceled → active recovery.
  if (status === "active" && prior?.status !== "active") {
    await track("subscription_active", {
      plan: plan ?? "unknown",
      userId,
      prior_status: prior?.status ?? "new",
    }).catch((err) => console.error("[analytics] subscription_active track failed", err));
  }
}

export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.mode !== "subscription") break;
        const customerId = typeof cs.customer === "string" ? cs.customer : cs.customer?.id;
        const subscriptionId = typeof cs.subscription === "string" ? cs.subscription : cs.subscription?.id;
        if (!customerId || !subscriptionId) break;
        const userId =
          cs.client_reference_id ||
          (await findUserIdForCustomer(customerId, cs.customer_details?.email ?? cs.customer_email));
        if (!userId) {
          console.error("[stripe/webhook] checkout.session.completed: no user", { customerId });
          break;
        }
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(userId, sub);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId = await findUserIdForCustomer(customerId, null);
        if (!userId) {
          console.error("[stripe/webhook] subscription event: no user", { event: event.type, customerId });
          break;
        }
        await upsertSubscription(userId, sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const userId = await findUserIdForCustomer(customerId, invoice.customer_email);
        if (!userId) break;
        await db.subscription.updateMany({
          where: { userId },
          data: { status: "past_due" },
        });
        break;
      }
      default:
        // No-op: Stripe sends many event types we don't care about.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries — but log the underlying issue.
    console.error("[stripe/webhook] handler failed", event.type, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
