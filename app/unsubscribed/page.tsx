import Link from "next/link";
import { Dateline } from "@/components/dateline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unsubscribed",
  description: "You've been removed from The Leadership Letter mailing list.",
};

export default function UnsubscribedPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status === "ok" ? "ok" : searchParams.status === "invalid" ? "invalid" : "error";

  const headline =
    status === "ok"
      ? "You're unsubscribed."
      : status === "invalid"
        ? "We need a valid email."
        : "Something went wrong.";
  const body =
    status === "ok"
      ? "You won't receive any more editions from The Leadership Letter. If you change your mind, you can re-subscribe at any time."
      : status === "invalid"
        ? "The unsubscribe link didn't include a valid email address. If you'd like to be removed, reply to any letter and we'll take care of it manually."
        : "We couldn't process your unsubscribe right now. Reply to any letter and we'll handle it manually within a day.";

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 md:py-32 text-center">
      <Dateline strong>{status === "ok" ? "Unsubscribed" : "Unsubscribe"}</Dateline>
      <h1
        className="mt-5 font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink text-balance"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
      >
        {headline}
      </h1>
      <p
        className="mx-auto mt-7 max-w-lg font-serif text-[1.0625rem] leading-relaxed text-ink-faded text-balance"
        style={{ fontVariationSettings: '"opsz" 17' }}
      >
        {body}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
        <Link href="/" className="hover:text-brick transition-colors">← Back to the archive</Link>
        {status === "ok" && (
          <>
            <span aria-hidden>·</span>
            <Link href="/subscribe" className="hover:text-brick transition-colors">Re-subscribe</Link>
          </>
        )}
      </div>
    </div>
  );
}
