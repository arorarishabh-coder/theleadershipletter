/**
 * Create the Stripe Product + recurring Prices for the membership paywall.
 *
 * Idempotent: re-running searches for an existing product by name and reuses it,
 * and only creates a Price if one with matching (amount, currency, interval) for
 * that product doesn't already exist. Safe to run multiple times.
 *
 * Amounts come from PRICING in lib/membership.ts — the single source of truth.
 *
 *   npm run stripe:products
 *
 * Output: the two `price_…` IDs to paste into STRIPE_PRICE_MONTHLY /
 * STRIPE_PRICE_ANNUAL in .env (and Vercel env for prod).
 */

import "dotenv/config";
import { PRICING } from "@/lib/membership";

const PRODUCT_NAME = "The Leadership Letter";
const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe<T = any>(path: string, init: { method?: string; body?: string } = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing from env");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2026-05-27.dahlia",
    },
    body: init.body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Stripe ${path} → ${res.status}: ${json?.error?.message || JSON.stringify(json)}`);
  }
  return json as T;
}

async function findOrCreateProduct(): Promise<string> {
  const list = await stripe<{ data: Array<{ id: string; name: string; active: boolean }> }>(
    "/products?active=true&limit=100",
  );
  const existing = list.data.find((p) => p.name === PRODUCT_NAME);
  if (existing) {
    console.log(`product reused: ${existing.id} (${existing.name})`);
    return existing.id;
  }
  const created = await stripe<{ id: string }>("/products", {
    method: "POST",
    body: form({
      name: PRODUCT_NAME,
      description: "Daily letter + full archive of primary-source corporate correspondence with leadership lessons.",
      "metadata[app]": "the-leadership-letter",
    }),
  });
  console.log(`product created: ${created.id}`);
  return created.id;
}

async function findOrCreatePrice(
  productId: string,
  label: string,
  amountCents: number,
  currency: string,
  interval: "month" | "year",
): Promise<string> {
  const list = await stripe<{
    data: Array<{
      id: string;
      active: boolean;
      unit_amount: number;
      currency: string;
      recurring: { interval: string } | null;
    }>;
  }>(`/prices?product=${productId}&active=true&limit=100`);
  const existing = list.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.currency === currency &&
      p.recurring?.interval === interval,
  );
  if (existing) {
    console.log(`price reused (${label}): ${existing.id}`);
    return existing.id;
  }
  const created = await stripe<{ id: string }>("/prices", {
    method: "POST",
    body: form({
      product: productId,
      unit_amount: amountCents,
      currency,
      "recurring[interval]": interval,
      "metadata[plan]": label,
    }),
  });
  console.log(`price created (${label}): ${created.id}`);
  return created.id;
}

async function main() {
  const productId = await findOrCreateProduct();

  const monthlyId = await findOrCreatePrice(
    productId,
    "monthly",
    PRICING.monthly.amountCents,
    PRICING.monthly.currency,
    PRICING.monthly.interval,
  );
  const annualId = await findOrCreatePrice(
    productId,
    "annual",
    PRICING.annual.amountCents,
    PRICING.annual.currency,
    PRICING.annual.interval,
  );

  console.log("\nPaste into .env (and Vercel env):");
  console.log(`STRIPE_PRICE_MONTHLY="${monthlyId}"`);
  console.log(`STRIPE_PRICE_ANNUAL="${annualId}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
