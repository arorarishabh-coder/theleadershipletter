import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Dateline } from "@/components/dateline";

export const metadata = {
  title: "Sign in",
  description: "Sign in to The Leadership Letter — passwordless, via a one-time email link.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();
  if (session?.user) redirect("/account");

  // Only allow same-site relative paths as the post-login destination (no open
  // redirects). Falls back to the account page.
  const raw = searchParams.callbackUrl ?? "";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";

  return (
    <div className="mx-auto max-w-xl px-6 py-20 md:py-28">
      <header className="border-b border-ink pb-8">
        <Dateline strong>Members</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Sign in
        </h1>
        <p className="mt-4 font-serif text-[1.0625rem] leading-relaxed text-ink-faded">
          One tap with Google, or a one-time link to your email. No password.
        </p>
      </header>

      {/* Primary: one-tap Google — no email round-trip, works inside saved
          home-screen apps where a magic link would open the wrong browser. */}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl });
        }}
        className="mt-10"
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 border border-ink bg-parchment-light px-6 py-3.5 font-sans text-[13px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-parchment"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>
      </form>

      {/* Divider */}
      <div className="mt-8 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">or by email</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form
        action={async (formData) => {
          "use server";
          await signIn("resend", {
            email: String(formData.get("email") || "").trim(),
            redirectTo: callbackUrl,
          });
        }}
        className="mt-8"
      >
        <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          Email address
        </label>
        <div className="mt-2 flex border border-ink">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            placeholder="your@email.com"
            className="w-full bg-parchment-light px-4 py-3.5 font-serif text-[1.0625rem] text-ink placeholder:text-ink-light focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            className="whitespace-nowrap bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
          >
            Email me a link
          </button>
        </div>
      </form>

      <p className="mt-6 font-serif text-[15px] italic leading-relaxed text-ink-faded">
        Just want the free daily letter?{" "}
        <a href="/subscribe" className="text-brick underline decoration-brick/30 underline-offset-4 hover:text-brick">
          Subscribe to the newsletter
        </a>{" "}
        — no account needed.
      </p>
    </div>
  );
}
