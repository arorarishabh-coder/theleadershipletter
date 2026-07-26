/**
 * Aggregate the raw EmailEvent log into open/click rates per daily edition.
 *
 * Resend exposes no aggregate broadcast-stats API, so we log every per-recipient
 * webhook event (see app/api/webhooks/resend) and roll them up here. Rates are
 * UNIQUE-recipient based (a recipient opening twice counts once), with delivered
 * as the denominator — the honest denominator for "who could have opened."
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
  let events: Array<{ type: string; email: string; broadcastId: string | null; occurredAt: Date }>;
  try {
    events = await db.emailEvent.findMany({
      where: { broadcastId: { not: null } },
      select: { type: true, email: true, broadcastId: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  } catch {
    // Table not migrated yet, or DB unreachable — treat as "no data captured."
    return EMPTY;
  }

  if (events.length === 0) return EMPTY;

  // broadcastId -> per-type set of unique recipient emails.
  type Buckets = { delivered: Set<string>; opened: Set<string>; clicked: Set<string> };
  const byBroadcast = new Map<string, Buckets>();
  let lastEventAt: string | null = null;

  for (const e of events) {
    if (!e.broadcastId) continue;
    if (!lastEventAt) lastEventAt = e.occurredAt.toISOString(); // first row = newest (desc order)
    let b = byBroadcast.get(e.broadcastId);
    if (!b) {
      b = { delivered: new Set(), opened: new Set(), clicked: new Set() };
      byBroadcast.set(e.broadcastId, b);
    }
    const who = e.email || "?";
    if (e.type === "delivered" || e.type === "sent") b.delivered.add(who);
    else if (e.type === "opened") b.opened.add(who);
    else if (e.type === "clicked") b.clicked.add(who);
  }

  // Resolve broadcastId -> { slug, sentAt } and slug -> title.
  const bySlug = await listBroadcastsByName().catch(() => new Map());
  const idToMeta = new Map<string, { slug: string; sentAt: string | null }>();
  for (const [slug, info] of bySlug) idToMeta.set(info.id, { slug, sentAt: info.sentAt });
  const titleBySlug = new Map(getAllPosts().map((p) => [p.slug.toLowerCase(), p.title]));

  const broadcasts: BroadcastEngagement[] = [];
  let tDel = 0,
    tOpen = 0,
    tClick = 0;

  for (const [broadcastId, b] of byBroadcast) {
    const delivered = b.delivered.size;
    // An open/click implies delivery even if the delivered event was missed — so
    // the denominator is at least the number of unique openers.
    const deliveredEff = Math.max(delivered, b.opened.size);
    const opens = b.opened.size;
    const clicks = b.clicked.size;
    const meta = idToMeta.get(broadcastId);
    tDel += deliveredEff;
    tOpen += opens;
    tClick += clicks;
    broadcasts.push({
      broadcastId,
      slug: meta?.slug ?? null,
      title: meta ? titleBySlug.get(meta.slug.toLowerCase()) ?? null : null,
      sentAt: meta?.sentAt ?? null,
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
