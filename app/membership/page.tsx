import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { membershipStatus, PRICING, TRIAL_DAYS, type PlanId } from "@/lib/membership";
import { Dateline } from "@/components/dateline";
import { SectionRule } from "@/components/section-rule";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Membership",
  description:
    "Read the full archive of The Leadership Letter. $3/month or $30/year. Start with a free week — no card required.",
};

export default async function MembershipPage() {
  const session = await auth();
  const user = session?.user?.email
    ? await db.user.findUnique({
        where: { email: session.user.email },
        include: { subscription: true },
      })
    : null;
  const m = membershipStatus(user);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <Hero state={m.state} />

      {/* State-dependent status strip */}
      <MembershipStatus state={m.state} label={m.label} trialDaysLeft={m.trialDaysLeft} signedIn={Boolean(session?.user)} />

      {/* Pricing */}
      <section className="mt-20" id="pricing">
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-3">
          <h2
            className="font-display text-display-3 leading-none text-ink"
            style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
          >
            Choose a plan
          </h2>
          <Dateline>Cancel anytime</Dateline>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
          <PricingCard
            plan="monthly"
            headline="Monthly"
            subline="The flexible option. Pay as you go."
            features={["Full archive access", "All future editions", "Reader-only experience — no ads or sponsors"]}
            state={m.state}
            signedIn={Boolean(session?.user)}
          />
          <PricingCard
            plan="annual"
            headline="Annual"
            subline="Two months free. The serious-reader rate."
            features={[
              "Full archive access",
              "All future editions",
              "Reader-only experience — no ads or sponsors",
              "Two months free vs. the monthly plan",
            ]}
            state={m.state}
            signedIn={Boolean(session?.user)}
            highlighted
          />
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-dateline text-ink-faded text-center">
          Secure checkout via Stripe · Receipts emailed automatically · Cancel from the customer portal
        </p>
      </section>

      {/* What members get */}
      <section className="mt-24 border-y border-ink py-14">
        <Dateline strong>What members get</Dateline>
        <ul className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-14">
          {[
            {
              h: "The full archive.",
              p: "Every letter we've ever published, fully searchable. Read the whole corpus end-to-end, or jump straight to a leader, a company, or a moment.",
            },
            {
              h: "Every future edition.",
              p: "One letter every weekday — court exhibits, shareholder memos, internal emails. The pace doesn't change; what changes is what you can come back to.",
            },
            {
              h: "Primary documents.",
              p: "Every post links to the original source and includes screenshots. The lesson is the product, but the document is the proof.",
            },
            {
              h: "Reader-only experience.",
              p: "No ads. No sponsorships. The only thing in your way is the writing.",
            },
            {
              h: "Editorial standards in writing.",
              p: "The same charter every post is held to — grounded, transformative, neutral. Both wins and failures, no hagiography.",
            },
            {
              h: "Support an independent project.",
              p: "Your subscription is the entire business model. No VCs, no acquihire path. You're the customer, not the product.",
            },
          ].map((item) => (
            <li key={item.h}>
              <h3
                className="font-display text-xl text-ink"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 500, "SOFT" 30' }}
              >
                {item.h}
              </h3>
              <p
                className="mt-2 font-serif text-[1.0625rem] leading-relaxed text-ink-faded"
                style={{ fontVariationSettings: '"opsz" 17' }}
              >
                {item.p}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Free vs Members comparison */}
      <section className="mt-20">
        <Dateline strong>Free vs Members</Dateline>
        <h2
          className="mt-3 max-w-3xl font-display text-display-3 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          The daily edition stays free. Members get the rest.
        </h2>
        <div className="mt-8 overflow-x-auto border border-ink">
          <table className="w-full min-w-[560px] font-serif text-[1.0625rem] text-ink">
            <thead>
              <tr className="border-b border-ink bg-parchment-deep/60 font-mono text-[11px] uppercase tracking-dateline text-ink">
                <th className="px-5 py-3 text-left font-normal">&nbsp;</th>
                <th className="w-[110px] border-l border-rule px-5 py-3 text-left font-normal">Free reader</th>
                <th className="w-[110px] border-l border-rule px-5 py-3 text-left font-normal">Member</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Daily letter in your inbox", true, true],
                ["Today's edition on the web", true, true],
                ["Source screenshots on today's letter", true, true],
                ["Full searchable archive", false, true],
                ["Read every prior edition end-to-end", false, true],
                ["No ads, no sponsors", true, true],
              ].map(([label, free, member]) => (
                <tr key={label as string} className="border-t border-rule">
                  <td className="px-5 py-3.5">{label}</td>
                  <td className="border-l border-rule px-5 py-3.5 font-mono text-[14px] text-ink-faded">{free ? "✓" : "—"}</td>
                  <td className="border-l border-rule px-5 py-3.5 font-mono text-[14px] text-brick">{member ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-20 border-t border-ink pt-14">
        <Dateline strong>Questions</Dateline>
        <dl className="mt-8 divide-y divide-rule border-y border-rule">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="grid grid-cols-1 gap-3 py-7 md:grid-cols-[1fr_2fr] md:gap-10">
              <dt
                className="font-display text-xl leading-snug text-ink"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 500, "SOFT" 30' }}
              >
                {q}
              </dt>
              <dd
                className="font-serif text-[1.0625rem] leading-relaxed text-ink"
                style={{ fontVariationSettings: '"opsz" 17' }}
              >
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <SectionRule />

      {/* Final CTA */}
      <div className="mt-4 text-center">
        <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">Ready when you are.</p>
        <h2
          className="mt-3 font-display text-display-2 leading-[1.02] tracking-[-0.015em] text-ink"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 30' }}
        >
          Start reading the archive.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
          <span>{TRIAL_DAYS}-day free week</span>
          <span aria-hidden>·</span>
          <span>No card to start</span>
          <span aria-hidden>·</span>
          <span>Cancel anytime</span>
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
          >
            See plans
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Hero({ state }: { state: ReturnType<typeof membershipStatus>["state"] }) {
  const lede =
    state === "subscribed"
      ? "You're already in. Read anything you like — the full archive is yours."
      : state === "trial"
        ? "Your free week is active. Read everything; subscribe whenever you're ready."
        : "The daily letter is free. Members read the rest — every court exhibit, every shareholder letter, every memo we've published. Searchable. Permanent.";
  return (
    <header className="border-b border-ink pb-12 text-center">
      <Dateline strong>Members · The full archive</Dateline>
      <h1
        className="mt-5 font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.95] tracking-[-0.025em] text-ink text-balance"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
      >
        Read every letter. Not just today&rsquo;s.
      </h1>
      <p
        className="mx-auto mt-7 max-w-2xl text-balance font-serif text-[1.25rem] leading-[1.55] italic text-ink-faded"
        style={{ fontVariationSettings: '"opsz" 22' }}
      >
        {lede}
      </p>
    </header>
  );
}

function MembershipStatus({
  state,
  label,
  trialDaysLeft,
  signedIn,
}: {
  state: ReturnType<typeof membershipStatus>["state"];
  label: string;
  trialDaysLeft?: number;
  signedIn: boolean;
}) {
  if (state === "anonymous") {
    return (
      <section className="mt-10 border-y border-ink bg-parchment-deep/60 px-6 py-10 text-center">
        <Dateline strong>Free week</Dateline>
        <h2
          className="mt-3 font-display text-display-3 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          Start your {TRIAL_DAYS}-day free week.
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-serif text-[1.0625rem] text-ink-faded" style={{ fontVariationSettings: '"opsz" 17' }}>
          Read the entire archive for {TRIAL_DAYS} days — no card required. Sign in to begin; you can start your free week in one click.
        </p>
        <Link
          href="/signin?callbackUrl=/membership"
          className="mt-7 inline-block bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
        >
          Sign in to start &rarr;
        </Link>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
          Already a member?{" "}
          <Link href="/signin?callbackUrl=/account" className="text-ink underline transition-colors hover:text-brick">
            Sign in
          </Link>
        </p>
      </section>
    );
  }

  if (state === "registered") {
    return (
      <section className="mt-10 border-y border-ink bg-parchment-deep/60 px-6 py-10 text-center">
        <Dateline strong>Free week</Dateline>
        <h2
          className="mt-3 font-display text-display-3 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          Start your {TRIAL_DAYS}-day free week.
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-serif text-[1.0625rem] text-ink-faded" style={{ fontVariationSettings: '"opsz" 17' }}>
          No card required. Read the entire archive. Subscribe only if you decide to keep it.
        </p>
        <form
          action="/api/membership/start-trial"
          method="POST"
          className="mt-7 inline-block"
        >
          <button
            type="submit"
            className="bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
          >
            Start free week →
          </button>
        </form>
      </section>
    );
  }

  if (state === "trial") {
    return (
      <section className="mt-10 border-y border-ink bg-parchment-deep/60 px-6 py-7 text-center font-mono text-[12px] uppercase tracking-dateline text-ink">
        Free week active · {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left · Subscribe below to keep reading after it ends
      </section>
    );
  }

  if (state === "trial_expired") {
    return (
      <section className="mt-10 border-y border-ink bg-parchment-deep/60 px-6 py-7 text-center font-mono text-[12px] uppercase tracking-dateline text-ink">
        Free week ended · Subscribe below to restore archive access
      </section>
    );
  }

  if (state === "subscribed") {
    return (
      <section className="mt-10 border-y border-ink bg-parchment-deep/60 px-6 py-8 text-center">
        <Dateline strong>{label}</Dateline>
        <p className="mt-3 font-serif text-[1.0625rem] italic text-ink-faded" style={{ fontVariationSettings: '"opsz" 17' }}>
          Thanks for subscribing. Manage billing from your account.
        </p>
        <div className="mt-5">
          <Link
            href="/account"
            className="border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
          >
            Go to account →
          </Link>
        </div>
      </section>
    );
  }

  return null;
}

interface PricingCardProps {
  plan: PlanId;
  headline: string;
  subline: string;
  features: string[];
  state: ReturnType<typeof membershipStatus>["state"];
  signedIn: boolean;
  highlighted?: boolean;
}

function PricingCard({ plan, headline, subline, features, state, signedIn, highlighted }: PricingCardProps) {
  const price = PRICING[plan];
  const isSubscribed = state === "subscribed";

  return (
    <article
      className={
        highlighted
          ? "relative border-2 border-ink bg-parchment-light p-8 md:p-10 shadow-frame"
          : "border border-ink bg-parchment-light p-8 md:p-10"
      }
    >
      {highlighted && (
        <span className="absolute -top-3 left-8 bg-brick px-3 py-1 font-mono text-[10px] uppercase tracking-dateline text-parchment">
          Best value
        </span>
      )}

      <header className="border-b border-rule pb-6">
        <Dateline strong>{headline}</Dateline>
        <div className="mt-4 flex items-baseline gap-2">
          <span
            className="font-display text-[clamp(3.5rem,7vw,5rem)] leading-none text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
          >
            {price.label}
          </span>
          <span className="font-mono text-[12px] uppercase tracking-dateline text-ink-faded">
            / {price.per}
          </span>
        </div>
        <p className="mt-3 font-serif text-[1rem] italic leading-snug text-ink-faded" style={{ fontVariationSettings: '"opsz" 17' }}>
          {subline}
        </p>
      </header>

      <ul className="mt-6 space-y-3 font-serif text-[1rem] leading-relaxed text-ink" style={{ fontVariationSettings: '"opsz" 17' }}>
        {features.map((f) => (
          <li key={f} className="flex gap-3">
            <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-brick" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {isSubscribed ? (
          <Link
            href="/account"
            className="block w-full border border-ink bg-parchment-light px-5 py-3.5 text-center font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment"
          >
            Manage billing →
          </Link>
        ) : !signedIn ? (
          <Link
            href={`/signin?callbackUrl=${encodeURIComponent(`/membership?plan=${plan}`)}`}
            className={
              highlighted
                ? "block w-full bg-ink px-5 py-3.5 text-center font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
                : "block w-full border border-ink bg-parchment-light px-5 py-3.5 text-center font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment"
            }
          >
            Sign in to subscribe →
          </Link>
        ) : (
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="plan" value={plan} />
            <button
              type="submit"
              className={
                highlighted
                  ? "block w-full bg-ink px-5 py-3.5 text-center font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
                  : "block w-full border border-ink bg-parchment-light px-5 py-3.5 text-center font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment"
              }
            >
              Subscribe {headline.toLowerCase()} →
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

const FAQ = [
  {
    q: "What does the free week actually include?",
    a: "Everything a paid member gets — the full searchable archive, every prior edition, every screenshot. For seven days, with no card on file. If you don't subscribe by the end, the archive locks again and you keep getting the free daily letter as usual.",
  },
  {
    q: "Is the daily newsletter still free?",
    a: "Yes — always. The daily edition goes out to everyone, member or not. Membership unlocks the back catalog and is what keeps the project going.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Anytime. Cancel from your account and you'll keep access until the end of the period you've already paid for. No retention dark patterns, no calls to make.",
  },
  {
    q: "Do you offer refunds?",
    a: "If something isn't working or you're unhappy, email us within 14 days of a charge and we'll refund it without friction.",
  },
  {
    q: "Why $3 a month?",
    a: "Cheap enough to be a rounding error if you read one good letter a quarter. Expensive enough that, in volume, it funds a slow, careful editorial process instead of an ad-driven content treadmill.",
  },
  {
    q: "Where does my money actually go?",
    a: "Hosting, the LLM bill for the editorial pipeline, court-document costs (PACER fees add up), and editor time. No advertisers, no sponsors, no affiliate links — your subscription is the entire business model.",
  },
];
