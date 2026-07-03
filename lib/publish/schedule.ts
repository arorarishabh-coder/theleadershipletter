import type { Post } from "@/lib/types";
import { COMPANIES, companyMatches } from "@/lib/taxonomy";

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
