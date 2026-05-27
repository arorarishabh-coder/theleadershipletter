import type { Subscription, User } from "@prisma/client";

// Entitlement logic — the single source of truth for "can this person read the
// website archive?" Used by the account page (Phase 1) and the article paywall
// (Phase 3). Free = newsletter only; website access = active trial OR subscription.

export const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type UserWithSub = (User & { subscription: Subscription | null }) | null | undefined;

export type MembershipState =
  | "anonymous" // not signed in
  | "registered" // signed in, no trial yet
  | "trial" // trial active
  | "trial_expired" // trial ended, not subscribed
  | "subscribed"; // paying (or in Stripe trial)

export interface Membership {
  access: boolean;
  state: MembershipState;
  label: string;
  trialDaysLeft?: number;
  trialEndsAt?: Date;
  plan?: string | null;
}

export function membershipStatus(user: UserWithSub): Membership {
  if (!user) return { access: false, state: "anonymous", label: "Not signed in" };

  const sub = user.subscription;
  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return {
      access: true,
      state: "subscribed",
      label: sub.plan === "annual" ? "Subscriber · Annual" : "Subscriber · Monthly",
      plan: sub.plan,
    };
  }

  if (user.trialStartedAt) {
    const endsAt = user.trialStartedAt.getTime() + TRIAL_MS;
    if (Date.now() < endsAt) {
      const trialDaysLeft = Math.max(1, Math.ceil((endsAt - Date.now()) / DAY_MS));
      return {
        access: true,
        state: "trial",
        label: `Free week · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`,
        trialDaysLeft,
        trialEndsAt: new Date(endsAt),
      };
    }
    return { access: false, state: "trial_expired", label: "Free week ended" };
  }

  return { access: false, state: "registered", label: "Signed in" };
}
