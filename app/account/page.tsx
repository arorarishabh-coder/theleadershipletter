import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { membershipStatus } from "@/lib/membership";
import { Dateline } from "@/components/dateline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your account",
  description: "Manage your membership.",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });
  const m = membershipStatus(user);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 md:py-24">
      <header className="border-b border-ink pb-8">
        <Dateline strong>Members</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Your account
        </h1>
      </header>

      <dl className="mt-10 divide-y divide-rule border-y border-rule">
        <div className="flex items-baseline justify-between gap-6 py-4">
          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Signed in as</dt>
          <dd className="font-serif text-[1.0625rem] text-ink">{session.user.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6 py-4">
          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Membership</dt>
          <dd className="font-serif text-[1.0625rem] text-ink">{m.label}</dd>
        </div>
      </dl>

      {/* Upgrade / manage — wired in Phase 2 (Stripe) */}
      {m.state === "subscribed" ? (
        <p className="mt-8 font-serif text-[15px] italic text-ink-faded">
          Thanks for subscribing. Billing management is coming shortly.
        </p>
      ) : (
        <div className="mt-8">
          <p className="font-serif text-[1.0625rem] leading-relaxed text-ink">
            {m.state === "trial"
              ? "You have full access to the archive during your free week."
              : m.state === "trial_expired"
                ? "Your free week has ended. Subscribe to keep reading the full archive."
                : "Start your free week to read the full archive — no card required."}
          </p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex cursor-not-allowed items-center gap-2 border border-ink/30 px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-ink-light"
            title="Subscriptions go live in the next phase"
          >
            Subscribe — $3/mo · coming soon
          </button>
        </div>
      )}

      <div className="mt-12 flex items-center justify-between border-t border-rule pt-6">
        <Link
          href="/"
          className="font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick"
        >
          ← Back to the archive
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="font-sans text-[12px] uppercase tracking-[0.18em] text-ink-light transition-colors hover:text-brick"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
