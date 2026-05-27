import { Dateline } from "@/components/dateline";
import { NewsletterCTA } from "@/components/newsletter-cta";

export const metadata = {
  title: "Subscribe",
  description: "One letter. One lesson. Every weekday morning.",
};

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <div className="text-center">
        <Dateline strong>The daily edition</Dateline>
        <h1
          className="mt-5 font-display text-[clamp(3rem,7vw,6rem)] leading-[0.95] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          One letter. One lesson. Every weekday morning.
        </h1>
        <p
          className="mx-auto mt-8 max-w-xl font-serif text-[1.25rem] leading-[1.6] italic text-ink-faded text-balance"
          style={{ fontVariationSettings: '"opsz" 22' }}
        >
          A real internal corporate document, read closely, in your inbox before the market opens. Free. Unsubscribe in one click.
        </p>
        <div className="mt-12 flex justify-center">
          <NewsletterCTA />
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          No tracking pixels · No follow-up promotions · No "Pro" upsell
        </p>
      </div>

      <section className="mt-24 border-y border-ink py-12">
        <Dateline strong>What you get</Dateline>
        <ul className="mt-8 space-y-7">
          {[
            {
              h: "One letter a day.",
              p: "Sent at 7:00 a.m. Central. Five days a week. Holidays off. The pace is deliberate — the goal is to think about one document well, not to read ten of them poorly.",
            },
            {
              h: "Primary sources only.",
              p: "Every letter links to the original public document. No paraphrases of paraphrases. If we cannot show you the source, we will not publish the lesson.",
            },
            {
              h: "Analytical, not breathless.",
              p: "We are not in the leadership-platitude business. The point is to show what real leaders wrote, and what that reveals — wins and failures alike.",
            },
            {
              h: "Editor-curated.",
              p: "Every letter is selected and reviewed by a human editor before it goes out. The analysis is grounded in the document; if the document does not support a sharp lesson, we say so.",
            },
          ].map((item) => (
            <li key={item.h} className="grid grid-cols-1 gap-3 md:grid-cols-[max-content_1fr] md:gap-10">
              <h3
                className="font-display text-xl text-ink md:pt-1"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 500, "SOFT" 30' }}
              >
                {item.h}
              </h3>
              <p className="font-serif text-[1.0625rem] leading-relaxed text-ink" style={{ fontVariationSettings: '"opsz" 17' }}>
                {item.p}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">Ready when you are.</p>
        <div className="mt-5 flex justify-center">
          <NewsletterCTA />
        </div>
      </div>
    </div>
  );
}
