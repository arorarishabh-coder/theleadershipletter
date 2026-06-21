// Metrics collection for the daily Chief-of-Staff digest. Pulls from the sources
// we can query directly today: Resend (audience), our Postgres (members,
// trials, subscriptions), and the post buffer. Open/click rates and page-view
// reach are a deliberate fast-follow (Resend webhooks + a DB event log).

import { db } from "@/lib/db";
import { membershipStatus, PRICING } from "@/lib/membership";
import { getAllPosts, getPostBySlug } from "@/lib/queries";
import { getMostRecentBroadcastSlug, isPublished, listPublishedIdentities } from "@/lib/publish/resend";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DigestMetrics {
  generatedAt: string;
  audience: { total: number; new24h: number; unsubscribed: number };
  members: {
    totalUsers: number;
    newUsers24h: number;
    registered: number;
    trialActive: number;
    trialExpired: number;
    trialsStarted24h: number;
  };
  revenue: { paidSubs: number; monthly: number; annual: number; mrrCents: number; newSubs24h: number };
  content: { todaySlug: string | null; todayTitle: string | null; bufferRemaining: number };
}

/** Resend audience size, new contacts in the last 24h, and unsubscribes. */
async function audienceStats(cutoff: number): Promise<DigestMetrics["audience"]> {
  const key = process.env.RESEND_API_KEY;
  const aud = process.env.RESEND_AUDIENCE_ID;
  if (!key || !aud) return { total: 0, new24h: 0, unsubscribed: 0 };
  const res = await fetch(`https://api.resend.com/audiences/${aud}/contacts`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { total: 0, new24h: 0, unsubscribed: 0 };
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{ created_at?: string; unsubscribed?: boolean }>;
  };
  const contacts = json.data ?? [];
  const active = contacts.filter((c) => !c.unsubscribed);
  return {
    total: active.length,
    new24h: active.filter((c) => c.created_at && new Date(c.created_at).getTime() >= cutoff).length,
    unsubscribed: contacts.filter((c) => c.unsubscribed).length,
  };
}

export async function collectMetrics(): Promise<DigestMetrics> {
  const now = Date.now();
  const cutoff = now - DAY_MS;

  const [audience, users, published, todaySlug] = await Promise.all([
    audienceStats(cutoff),
    db.user.findMany({ include: { subscription: true } }),
    listPublishedIdentities(),
    getMostRecentBroadcastSlug(),
  ]);

  // Member breakdown via the shared entitlement logic.
  const members = { totalUsers: users.length, newUsers24h: 0, registered: 0, trialActive: 0, trialExpired: 0, trialsStarted24h: 0 };
  let monthly = 0;
  let annual = 0;
  let newSubs24h = 0;
  for (const u of users) {
    if (u.createdAt.getTime() >= cutoff) members.newUsers24h++;
    if (u.trialStartedAt && u.trialStartedAt.getTime() >= cutoff) members.trialsStarted24h++;
    const m = membershipStatus(u);
    if (m.state === "registered") members.registered++;
    else if (m.state === "trial") members.trialActive++;
    else if (m.state === "trial_expired") members.trialExpired++;
    else if (m.state === "subscribed") {
      if (u.subscription?.plan === "annual") annual++;
      else monthly++;
      if (u.subscription && u.subscription.createdAt.getTime() >= cutoff) newSubs24h++;
    }
  }

  const mrrCents = monthly * PRICING.monthly.amountCents + annual * Math.round(PRICING.annual.amountCents / 12);

  const bufferRemaining = getAllPosts().filter((p) => !isPublished(p, published)).length;
  const todayTitle = todaySlug ? getPostBySlug(todaySlug)?.title ?? null : null;

  return {
    generatedAt: new Date(now).toISOString(),
    audience,
    members,
    revenue: { paidSubs: monthly + annual, monthly, annual, mrrCents, newSubs24h },
    content: { todaySlug, todayTitle, bufferRemaining },
  };
}
