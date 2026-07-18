import type { Post } from "@/lib/types";
import { COMPANIES, companyMatches } from "@/lib/taxonomy";

/**
 * Newsletter quality floor (0-10). A post is only auto-emailed when its recorded
 * relevance-gate leadershipSignal clears this bar. The blog admits at themeFit/
 * lessonClarity ≥ 6; the newsletter is the premium surface, so it holds a higher
 * signal floor — this is what keeps merely-fine letters (e.g. an obscure small-cap
 * bank's shareholder note) off the daily email while they still live on the blog.
 *
 * Grandfathering: posts with NO recorded leadershipSignal (legacy seed content and
 * court exhibits generated before signal-persistence landed) pass the floor — the
 * gate only bites content generated afterward. Override with NEWSLETTER_MIN_SIGNAL.
 */
export const NEWSLETTER_MIN_SIGNAL = Number(process.env.NEWSLETTER_MIN_SIGNAL ?? 7);

/**
 * Whether the daily cron may auto-email this post. Three independent gates:
 *   1. Lesson-only — Notable Artifacts carry a factual "why this matters" note,
 *      NOT a leadership lesson, so the email's analysis section would be empty.
 *      They belong on the blog + social; never the daily lesson newsletter.
 *   2. Quarantine — firehose-discovered EDGAR letters (blind full-text sweep of
 *      every 8-K filer) are held for human review; they reach the blog but are NOT
 *      auto-emailed until an editor sets reviewStatus:"approved".
 *   3. Signal floor — recorded leadershipSignal ≥ minSignal. Undefined signal is
 *      grandfathered (see NEWSLETTER_MIN_SIGNAL).
 * Deterministic and side-effect free so it can be unit-simulated.
 */
export function isSendEligible(post: Post, minSignal: number = NEWSLETTER_MIN_SIGNAL): boolean {
  if (post.postKind === "artifact") return false;
  if (post.reviewStatus === "quarantined") return false;
  if (post.leadershipSignal !== undefined && post.leadershipSignal < minSignal) return false;
  return true;
}

/**
 * Canonical grouping key for send-variety. Maps a post to the *publisher* it
 * should count against when we interleave the newsletter:
 *   1. a taxonomy company slug when authorsCompany maps to one (collapses
 *      "Square, Inc." / "Block, Inc." → block, "Apple Inc." / "Apple" → apple,
 *      the whole US-v-Google ad-tech exhibit set → google), else
 *   2. a normalized company string (suffixes stripped), else
 *   3. the source case, else "unknown".
 */
export function sourceGroupKey(post: Post): string {
  const company = (post.authorsCompany || "").trim();
  if (company) {
    for (const c of COMPANIES) {
      if (companyMatches(c, company)) return `co:${c.slug}`;
    }
    const norm = company
      .toLowerCase()
      .replace(/\b(inc|corp|corporation|company|co|holdings|group|ltd|plc|llc|the)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (norm) return `co:${norm}`;
  }
  if (post.sourceCase) return `case:${post.sourceCase.toLowerCase().trim()}`;
  return "unknown";
}

/**
 * Pick the next post to email for maximum publisher variety: the oldest unsent
 * post (by publishedAt) belonging to the source group that was LEAST recently
 * emailed. Never-emailed groups win first (their last-sent sorts as ""). This
 * interleaves publishers instead of draining one company's entire block before
 * moving on — the fix for "every edition is Google".
 *
 * Deterministic and side-effect free so it can be unit-simulated.
 *
 * @param unsent           unsent posts, any order
 * @param lastSentByGroup  group key → most-recent ISO sent_at ("" / absent = never sent)
 */
export function selectNextForVariety(
  unsent: Post[],
  lastSentByGroup: Map<string, string>,
): Post | undefined {
  return unsent
    .slice()
    .sort((a, b) => {
      const ga = lastSentByGroup.get(sourceGroupKey(a)) ?? "";
      const gb = lastSentByGroup.get(sourceGroupKey(b)) ?? "";
      if (ga !== gb) return ga < gb ? -1 : 1; // least-recently-sent group first
      return (a.publishedAt || "").localeCompare(b.publishedAt || ""); // then oldest content
    })[0];
}
