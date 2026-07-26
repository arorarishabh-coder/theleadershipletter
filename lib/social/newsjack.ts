/**
 * Newsjacking matcher — "what's in the news → which archive email is the receipt."
 *
 * When a company or exec is in the headlines, the fastest reach lever is to reply
 * with the relevant OLD internal email ("here's the actual email"). This maps a
 * pasted headline / company / person to the archive posts most likely to be that
 * receipt, ranked by a weighted keyword match over the corpus. Deterministic, no
 * Claude call.
 */

import type { Post } from "@/lib/types";
import { buildArtifactFirst } from "@/lib/social/artifact-first";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "at", "by", "with", "from",
  "is", "are", "was", "were", "be", "as", "it", "its", "this", "that", "these", "those", "his", "her",
  "their", "they", "he", "she", "we", "you", "new", "says", "said", "over", "after", "into", "amid",
  "inc", "corp", "llc", "ceo", "cofounder", "founder", "vs", "v",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9][a-z0-9'&.-]*/g) ?? [])
    .map((t) => t.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// Field weights — a company/person hit is a far stronger "this is the receipt"
// signal than an incidental word in the body.
const FIELDS: { get: (p: Post) => string; weight: number; label: string }[] = [
  { get: (p) => p.authorsCompany ?? "", weight: 6, label: "company" },
  { get: (p) => (p.authorsName ?? []).join(" "), weight: 6, label: "author" },
  { get: (p) => (p.leaderSlugs ?? []).join(" ").replace(/-/g, " "), weight: 5, label: "leader" },
  { get: (p) => (p.recipientNames ?? []).join(" "), weight: 4, label: "recipient" },
  { get: (p) => (p.topics ?? []).join(" ").replace(/-/g, " "), weight: 3, label: "topic" },
  { get: (p) => p.sourceCase ?? "", weight: 3, label: "case" },
  { get: (p) => p.title ?? "", weight: 2, label: "title" },
  { get: (p) => p.pullQuote ?? "", weight: 2, label: "quote" },
  { get: (p) => `${p.emailSubject ?? ""} ${p.excerptForBlog ?? ""}`, weight: 1, label: "body" },
];

export interface NewsjackMatch {
  slug: string;
  title: string;
  authorsCompany: string;
  authorsName: string[];
  dateAuthored: string;
  score: number;
  matchedOn: string[]; // high-value fields that matched (company/author/leader/topic)
  tweet: string; // ready artifact-first caption
  replyText: string;
}

/**
 * Rank archive posts against a free-text query (a headline, a company, a name).
 * Returns only posts with a non-zero score, best first.
 */
export function matchNewsjack(query: string, posts: Post[], limit = 6): NewsjackMatch[] {
  const tokens = Array.from(new Set(tokenize(query)));
  if (tokens.length === 0) return [];

  const scored = posts.map((p) => {
    let score = 0;
    const matchedOn = new Set<string>();
    // Precompute each field's token set once.
    for (const f of FIELDS) {
      const fieldTokens = new Set(tokenize(f.get(p)));
      if (fieldTokens.size === 0) continue;
      let fieldHit = false;
      for (const t of tokens) {
        if (fieldTokens.has(t)) {
          score += f.weight;
          fieldHit = true;
        }
      }
      if (fieldHit && f.weight >= 3) matchedOn.add(f.label);
    }
    return { p, score, matchedOn: Array.from(matchedOn) };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.p.dateAuthored || "").localeCompare(a.p.dateAuthored || ""))
    .slice(0, limit)
    .map(({ p, score, matchedOn }) => {
      const af = buildArtifactFirst(p);
      return {
        slug: p.slug,
        title: p.title,
        authorsCompany: p.authorsCompany,
        authorsName: p.authorsName,
        dateAuthored: p.dateAuthored,
        score,
        matchedOn,
        tweet: af.tweet,
        replyText: af.replyText,
      };
    });
}
