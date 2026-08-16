/**
 * Persist a first-party open/click hit into EmailEvent.
 *
 * Shared by /api/track/open and /api/track/click. Never throws — a tracking
 * failure must never turn into a broken image or a dead link for a reader.
 */

import { db } from "@/lib/db";
import { EMAIL_MERGE_TAG, UNKNOWN_RECIPIENT } from "@/lib/publish/track";

/** Collapse repeat hits inside this window into one row (bots, prefetchers, reloads). */
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Normalise the `e` param. If the merge tag failed to render we'd otherwise store
 * the literal "{{{EMAIL}}}" as an address, so map anything tag-shaped to a
 * placeholder — it still counts as one recipient, just an unidentified one.
 */
export function normaliseRecipient(raw: string | null): string {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e) return UNKNOWN_RECIPIENT;
  if (e.includes("{{") || e === EMAIL_MERGE_TAG.toLowerCase()) return UNKNOWN_RECIPIENT;
  if (!e.includes("@")) return UNKNOWN_RECIPIENT;
  return e;
}

export interface TrackingHit {
  type: "opened" | "clicked";
  slug: string;
  email: string;
  link?: string | null;
  userAgent?: string | null;
}

export async function recordTrackingHit(hit: TrackingHit): Promise<void> {
  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await db.emailEvent.findFirst({
      where: {
        slug: hit.slug,
        type: hit.type,
        email: hit.email,
        link: hit.link ?? null,
        occurredAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return;

    await db.emailEvent.create({
      data: {
        type: hit.type,
        email: hit.email,
        slug: hit.slug,
        link: hit.link ?? null,
        source: "first-party",
        occurredAt: new Date(),
        // Keep the UA: opens are inflated by privacy proxies (Apple Mail Privacy
        // Protection prefetches images), and this is the only way to analyse that
        // after the fact.
        raw: { userAgent: hit.userAgent ?? null } as object,
      },
    });
  } catch (e) {
    console.error("[track] persist failed", e);
  }
}
