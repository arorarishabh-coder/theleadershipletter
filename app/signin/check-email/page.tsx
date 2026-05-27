import { Dateline } from "@/components/dateline";

export const metadata = {
  title: "Check your email",
  description: "We sent you a sign-in link.",
};

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 md:py-28 text-center">
      <Dateline strong>Members</Dateline>
      <h1
        className="mt-4 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em] text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
      >
        Check your inbox
      </h1>
      <p className="mx-auto mt-5 max-w-md font-serif text-[1.0625rem] leading-relaxed text-ink-faded">
        We just emailed you a one-time sign-in link. Click it to finish signing in — it expires shortly, so use it soon. You can close this tab.
      </p>
      <p className="mt-8 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
        Didn&rsquo;t get it? Check spam, or{" "}
        <a href="/signin" className="text-brick hover:underline">
          try again
        </a>
        .
      </p>
    </div>
  );
}
