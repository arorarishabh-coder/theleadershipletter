import Link from "next/link";
import { Dateline } from "@/components/dateline";
import type { MembershipState } from "@/lib/membership";

interface PaywallProps {
  state: MembershipState;
  postSlug: string;
  simulated?: boolean;
}

interface Copy {
  headline: string;
  body: string;
  cta: { label: string; href?: string; form?: { action: string; plan?: string } };
  secondary?: { label: string; href: string };
}

function copyFor(state: MembershipState, callbackUrl: string): Copy {
  switch (state) {
    case "anonymous":
      return {
        headline: "This edition is for members.",
        body:
          "The daily letter is free. The archive — every prior edition, fully searchable — is for members. Sign in to start your free week.",
        cta: { label: "Sign in to continue →", href: `/signin?callbackUrl=${callbackUrl}` },
        secondary: { label: "What members get →", href: "/membership" },
      };
    case "registered":
      return {
        headline: "Start your free week.",
        body:
          "You're signed in. Begin your 7-day free week to read this and every other archive edition. No card required.",
        cta: { label: "Start free week →", form: { action: "/api/membership/start-trial" } },
        secondary: { label: "What you get →", href: "/membership" },
      };
    case "trial_expired":
      return {
        headline: "Your free week has ended.",
        body:
          "Subscribe to keep reading the archive — every letter we've published, searchable, permanent. $3/month or $30/year.",
        cta: { label: "Subscribe — $3/mo →", form: { action: "/api/stripe/checkout", plan: "monthly" } },
        secondary: { label: "Or go annual ($30/yr) →", href: "/membership#pricing" },
      };
    case "trial":
    case "subscribed":
      // Shouldn't be reached — access logic would have returned true. Defensive only.
      return {
        headline: "Membership required.",
        body: "Members read every letter in the archive.",
        cta: { label: "See plans →", href: "/membership#pricing" },
      };
  }
}

export function Paywall({ state, postSlug, simulated = false }: PaywallProps) {
  const callbackUrl = encodeURIComponent(`/post/${postSlug}`);
  const c = copyFor(state, callbackUrl);

  return (
    <section className="border-y border-ink bg-parchment-deep/40">
      {simulated && (
        <div className="border-b border-ink/40 bg-brick/10 px-6 py-2 text-center">
          <span className="font-mono text-[11px] uppercase tracking-dateline text-brick">
            Admin simulate · rendering as: {state}
          </span>
        </div>
      )}
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-20 text-center">
        <Dateline strong>Members &middot; Archive</Dateline>
        <h2
          className="mt-4 font-display text-display-3 leading-tight text-ink text-balance"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          {c.headline}
        </h2>
        <p
          className="mx-auto mt-5 max-w-xl font-serif text-[1.0625rem] leading-relaxed text-ink-faded text-balance"
          style={{ fontVariationSettings: '"opsz" 17' }}
        >
          {c.body}
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          {c.cta.form ? (
            <form action={c.cta.form.action} method="POST">
              {c.cta.form.plan && <input type="hidden" name="plan" value={c.cta.form.plan} />}
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
              >
                {c.cta.label}
              </button>
            </form>
          ) : (
            <Link
              href={c.cta.href || "#"}
              className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
            >
              {c.cta.label}
            </Link>
          )}
          {c.secondary && (
            <Link
              href={c.secondary.href}
              className="border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
            >
              {c.secondary.label}
            </Link>
          )}
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          $3/month &middot; $30/year &middot; cancel anytime
        </p>
      </div>
    </section>
  );
}
