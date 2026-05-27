import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Dateline } from "@/components/dateline";

export const metadata = {
  title: "Sign in",
  description: "Sign in to The Leadership Letter — passwordless, via a one-time email link.",
};

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/account");

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
          No password. Enter your email and we&rsquo;ll send a one-time sign-in link.
        </p>
      </header>

      <form
        action={async (formData) => {
          "use server";
          await signIn("resend", {
            email: String(formData.get("email") || "").trim(),
            redirectTo: "/account",
          });
        }}
        className="mt-10"
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
