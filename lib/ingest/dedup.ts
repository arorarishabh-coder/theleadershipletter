import type { Post } from "@/lib/types";

/**
 * Content-level dedup. The slug-based skip guard (processDocument step 0) catches
 * a re-run of the SAME exhibit, but NOT the same underlying email/document filed
 * under a DIFFERENT exhibit number — e.g. a Google email attached to both docket
 * 1014 (slug cl-…-1014-2) and docket 1247 (slug cl-…-1247-1). Those are distinct
 * slugs, so the slug guard misses them and we publish the same email twice with
 * two different AI lessons. This module catches that by comparing document CONTENT.
 *
 * Match rule (ALL three must hold, so distinct docs that merely share a date or a
 * sender don't collide):
 *   1. same non-empty dateAuthored, AND
 *   2. participant-set overlap (authors ∪ recipients) Jaccard ≥ participantThreshold, AND
 *   3. excerpt 5-gram overlap Jaccard ≥ excerptThreshold.
 *
 * Two independent enrich runs of the same exhibit pick slightly different excerpt
 * windows, so we compare shingle SETS (order/length-tolerant), not exact strings.
 */

/** Normalize a person name to a comparable token (lowercase, letters/spaces only). */
function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function participantSet(authors: string[] = [], recipients: string[] = []): Set<string> {
  const set = new Set<string>();
  for (const n of [...authors, ...recipients]) {
    const norm = normName(n);
    if (norm) set.add(norm);
  }
  return set;
}

/** Word k-gram (shingle) set of a text — order/length tolerant overlap signal. */
function shingles(text: string, k = 5): Set<string> {
  const words = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + k <= words.length; i++) set.add(words.slice(i, i + k).join(" "));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface DedupCandidate {
  slug: string;
  dateAuthored?: string;
  authorsName?: string[];
  recipientNames?: string[];
  excerptForBlog?: string;
}

export interface DuplicateMatch {
  slug: string;
  participantJaccard: number;
  excerptJaccard: number;
  reason: string;
}

export interface DedupThresholds {
  participantThreshold?: number;
  excerptThreshold?: number;
}

/**
 * Return the existing post that `cand` duplicates, or null. Compares against
 * `existing` (typically all posts on disk); a post with the same slug as the
 * candidate is ignored so a force-regenerate isn't flagged as its own duplicate.
 */
export function findContentDuplicate(
  cand: DedupCandidate,
  existing: Post[],
  opts: DedupThresholds = {},
): DuplicateMatch | null {
  const participantThreshold = opts.participantThreshold ?? 0.6;
  const excerptThreshold = opts.excerptThreshold ?? 0.35;

  const date = (cand.dateAuthored || "").trim();
  if (!date || /^unknown$/i.test(date)) return null; // no reliable anchor → don't risk a false match

  const candParts = participantSet(cand.authorsName, cand.recipientNames);
  const candShingles = shingles(cand.excerptForBlog || "");
  if (candShingles.size === 0) return null;

  for (const p of existing) {
    if (p.slug === cand.slug) continue;
    if ((p.dateAuthored || "").trim() !== date) continue;
    const pj = jaccard(candParts, participantSet(p.authorsName, p.recipientNames));
    if (pj < participantThreshold) continue;
    const ej = jaccard(candShingles, shingles(p.excerptForBlog || ""));
    if (ej < excerptThreshold) continue;
    return {
      slug: p.slug,
      participantJaccard: pj,
      excerptJaccard: ej,
      reason: `same date ${date}, participants J=${pj.toFixed(2)}, excerpt J=${ej.toFixed(2)}`,
    };
  }
  return null;
}
