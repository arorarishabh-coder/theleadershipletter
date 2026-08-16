/**
 * Aggregate the raw EmailEvent log into open/click rates per daily edition.
 *
 * Resend exposes no aggregate broadcast-stats API, so we log every per-recipient
 * event and roll them up here. Rates are UNIQUE-recipient based (a recipient
 * opening twice counts once), with delivered as the denominator — the honest
 * denominator for "who could have opened."
 *
 * TWO SOURCES feed the EmailEvent table and they key differently:
 *   - Resend webhook (app/api/webhooks/resend) — sent/delivered/bounced, keyed by
 *     `broadcastId`. This is where the delivery denominator comes from.
 *   - Our own pixel + click redirect (app/api/track/*) — opened/clicked, keyed by
 *     `slug`, because the broadcast id doesn't exist yet when the HTML is built.
 *     We host these ourselves because Resend reports open/click tracking as enabled
 *     but does not apply it to sends; see lib/publish/track.ts for the evidence.
 * Both are resolved to an edition (slug) below so they aggregate into one row.
 *
 * Volume is tiny (a small audience × dozens of editions), so we fetch the events
 * and aggregate in memory rather than fighting Prisma groupBy-distinct.
 */

import { db } from "@/lib/db";
import { getAllPosts } from "@/lib/queries";
import { listBroadcastsByName } from "@/lib/publish/resend";

export interface BroadcastEngagement {
  broadcastId: string;
  slug: string | null;
  title: string | null;
  sentAt: string | null;
  delivered: number;
  opens: number;
  clicks: number;
  openRate: number | null; // opens / delivered
  clickRate: number | null; // clicks / delivered
  ctor: number | null; // clicks / opens (click-to-open)
}

export interface EmailEngagementSummary {
  configured: boolean; // have we captured any events yet?
  eventCount: number;
  lastEventAt: string | null;
  totals: {
    delivered: number;
    opens: number;
    clicks: number;
    openRate: number | null;
    clickRate: number | null;
  };
  broadcasts: BroadcastEngagement[]; // most-recently-sent first
}

const EMPTY: EmailEngagementSummary = {
  configured: false,
  eventCount: 0,
  lastEventAt: null,
  totals: { delivered: 0, opens: 0, clicks: 0, openRate: null, clickRate: null },
  broadcasts: [],
};

function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export async function getEmailEngagement(limit = 5000): Promise<EmailEngagementSummary> {
  let events: Array<{
    type: string;
    email: string;
    broadcastId: string | null;
    slug: string | null;
    occurredAt: Date;
  }>;
  try {
    events = await db.emailEvent.findMany({
      // Two sources feed this table and they key differently: Resend's webhook
      // events carry a broadcastId, our own pixel/redirect hits carry a slug
      // (the broadcast id doesn't exist yet when the HTML is built).
      where: { OR: [{ broadcastId: { not: null } }, { slug: { not: null } }] },
      select: { type: true, email: true, broadcastId: true, slug: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  } catch {
    // Table not migrated yet, or DB unreachable — treat as "no data captured."
    return EMPTY;
  }

  if (events.length === 0) return EMPTY;

  // Resolve broadcastId -> { slug, sentAt } and slug -> title.
  const bySlug = await listBroadcastsByName().catch(() => new Map());
  const idToMeta = new Map<string, { slug: string; sentAt: string | null }>();
  for (const [slug, info] of bySlug) idToMeta.set(info.id, { slug, sentAt: info.sentAt });
  const titleBySlug = new Map(getAllPosts().map((p) => [p.slug.toLowerCase(), p.title]));

  // Bucket on the EDITION (slug), so delivery counts from Resend and opens/clicks
  // from our own tracking land in the same row.
  type Buckets = { delivered: Set<string>; opened: Set<string>; clicked: Set<string> };
  const byEdition = new Map<string, Buckets>();
  let lastEventAt: string | null = null;

  for (const e of events) {
    const key = e.slug?.trim().toLowerCase() || (e.broadcastId ? idToMeta.get(e.broadcastId)?.slug : null);
    // An event we can't attribute to an edition (e.g. a broadcast Resend has since
    // deleted) still shouldn't be silently dropped — bucket it under its raw id.
    const editionKey = key || (e.broadcastId ? `broadcast:${e.broadcastId}` : null);
    if (!editionKey) continue;

    if (!lastEventAt) lastEventAt = e.occurredAt.toISOString(); // first row = newest (desc order)
    let b = byEdition.get(editionKey);
    if (!b) {
      b = { delivered: new Set(), opened: new Set(), clicked: new Set() };
      byEdition.set(editionKey, b);
    }
    const who = e.email || "?";
    if (e.type === "delivered" || e.type === "sent") b.delivered.add(who);
    else if (e.type === "opened") b.opened.add(who);
    else if (e.type === "clicked") b.clicked.add(who);
  }

  const broadcasts: BroadcastEngagement[] = [];
  let tDel = 0,
    tOpen = 0,
    tClick = 0;

  for (const [editionKey, b] of byEdition) {
    const delivered = b.delivered.size;
    // An open/click implies delivery even if the delivered event was missed — so
    // the denominator is at least the number of unique openers.
    const deliveredEff = Math.max(delivered, b.opened.size);
    const opens = b.opened.size;
    const clicks = b.clicked.size;
    const info = bySlug.get(editionKey);
    tDel += deliveredEff;
    tOpen += opens;
    tClick += clicks;
    broadcasts.push({
      broadcastId: info?.id ?? editionKey,
      slug: info ? editionKey : null,
      title: titleBySlug.get(editionKey) ?? null,
      sentAt: info?.sentAt ?? null,
      delivered: deliveredEff,
      opens,
      clicks,
      openRate: rate(opens, deliveredEff),
      clickRate: rate(clicks, deliveredEff),
      ctor: rate(clicks, opens),
    });
  }

  broadcasts.sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));

  return {
    configured: true,
    eventCount: events.length,
    lastEventAt,
    totals: {
      delivered: tDel,
      opens: tOpen,
      clicks: tClick,
      openRate: rate(tOpen, tDel),
      clickRate: rate(tClick, tDel),
    },
    broadcasts,
  };
}
