import Stripe from "stripe";

// Singleton Stripe client. apiVersion is pinned to match the version used by
// scripts/stripe-products.ts so types and webhook payloads stay consistent.
// The secret key is required at construction time — fail loudly if missing.

const key = process.env.STRIPE_SECRET_KEY;
if (!key && process.env.NODE_ENV !== "test") {
  // Don't throw at module-load in dev (so unrelated routes still serve), but
  // any code path that actually hits Stripe will surface a clear error.
  console.warn("[stripe] STRIPE_SECRET_KEY not set — Stripe routes will fail.");
}

export const stripe = new Stripe(key || "sk_test_missing", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || "";
export const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export function priceIdForPlan(plan: "monthly" | "annual"): string {
  return plan === "annual" ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;
}
