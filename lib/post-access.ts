import type { Membership, MembershipState } from "@/lib/membership";

// Per-article access logic + admin simulate-mode helper. Centralizes the rule
// so the post page, paywall component, and any future API gate (e.g. RSS) all
// agree on what "access" means.

export type SimulatedState = "anonymous" | "registered" | "trial" | "trial_expired" | "subscribed";

const VALID_SIMULATE: ReadonlySet<string> = new Set([
  "anonymous",
  "registered",
  "trial",
  "trial_expired",
  "subscribed",
]);

export function parseSimulate(raw: unknown): SimulatedState | null {
  if (typeof raw !== "string") return null;
  return VALID_SIMULATE.has(raw) ? (raw as SimulatedState) : null;
}

/**
 * Free edition rule: the post whose slug matches the most recently broadcast
 * newsletter is free for everyone. This is THE article they got in their inbox
 * — the brand promise. All other posts (including same-day posts that haven't
 * been broadcast yet) are gated.
 */
export function isFreeEdition(postSlug: string, freeSlug: string | null): boolean {
  return freeSlug !== null && postSlug === freeSlug;
}

export interface AccessDecision {
  /** Render the full article when true; show paywall when false. */
  hasAccess: boolean;
  /** The (real or simulated) membership state, drives paywall copy. */
  state: MembershipState;
  /** True when an admin is forcing a simulated state via ?simulate=. */
  simulated: boolean;
}

/**
 * Decide whether the visitor sees the article body or the paywall.
 *
 *   - The most-recently-broadcast article (the one in subscribers' inboxes
 *     this morning): always free for everyone.
 *   - Admin + ?simulate=…: render whichever state was asked for.
 *   - Otherwise: gate on the real membership.access flag.
 */
export function decideAccess(opts: {
  postSlug: string;
  freeSlug: string | null;
  membership: Membership;
  isAdmin: boolean;
  simulate: SimulatedState | null;
}): AccessDecision {
  if (isFreeEdition(opts.postSlug, opts.freeSlug)) {
    return { hasAccess: true, state: opts.membership.state, simulated: false };
  }
  if (opts.simulate && opts.isAdmin) {
    const hasAccess = opts.simulate === "trial" || opts.simulate === "subscribed";
    return { hasAccess, state: opts.simulate, simulated: true };
  }
  return { hasAccess: opts.membership.access, state: opts.membership.state, simulated: false };
}
