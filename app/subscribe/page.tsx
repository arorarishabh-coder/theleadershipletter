import { Dateline } from "@/components/dateline";
import { NewsletterCTA } from "@/components/newsletter-cta";

export const metadata = {
  title: "Subscribe",
  description: "One letter. One lesson. Every weekday morning.",
};

const WHAT_YOU_GET = [
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
] as const;

const STATS = [
  { k: "5", v: "letters per week" },
  { k: "7 AM", v: "Central, weekdays" },
  { k: "1-click", v: "to unsubscribe" },
] as const;

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <Dateline strong>The daily edition</Dateline>
        <h1
          className="mt-5 font-display text-[clamp(3rem,7vw,6rem)] leading-[0.95] tracking-[-0.025em] text-ink text-balance"
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
          No ads · No follow-up promotions · No "Pro" upsell
        </p>
      </div>

      {/* Stat strip — anchors the page like a paper's masthead lockup */}
      <section className="mt-20 grid grid-cols-3 gap-px overflow-hidden border border-ink bg-ink/10">
        {STATS.map((s) => (
          <div key={s.v} className="bg-parchment-light px-6 py-7 text-center">
            <div
              className="font-display text-[2rem] leading-none text-ink"
              style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
            >
              {s.k}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">{s.v}</div>
          </div>
        ))}
      </section>

      {/* What you get — two-column grid, headlines sit on top of body like editorial */}
      <section className="mt-24 border-y border-ink py-14">
        <Dateline strong>What you get</Dateline>
        <h2
          className="mt-3 max-w-3xl font-display text-display-3 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          A short, careful read &mdash; not another inbox newsletter.
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-14">
          {WHAT_YOU_GET.map((item) => (
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

      {/* Sample-day teaser — what a single edition looks like */}
      <section className="mt-20">
        <Dateline strong>A typical edition</Dateline>
        <div className="mt-6 grid grid-cols-1 gap-10 border border-ink p-8 md:p-12 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">From the morning of June 1</p>
            <h3
              className="mt-3 font-display text-display-3 leading-tight text-ink"
              style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
            >
              The memo Bezos sent before pulling the trigger on AWS.
            </h3>
            <p
              className="mt-5 font-serif text-[1.0625rem] leading-relaxed text-ink"
              style={{ fontVariationSettings: '"opsz" 17' }}
            >
              Three paragraphs of the original, a screenshot of the source page, and one short lesson on why the writing matters &mdash; not what to take away, but what to notice.
            </p>
          </div>
          <ul className="space-y-4 border-t border-rule pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
            {[
              ["Source", "The original document, linked and screenshotted."],
              ["Excerpt", "≤300 words of the writing itself, lightly framed."],
              ["Lesson", "One thing to notice. Not a takeaway, a noticing."],
              ["Context", "What was happening when the letter was written."],
            ].map(([k, v]) => (
              <li key={k} className="grid grid-cols-[100px_1fr] gap-4">
                <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">{k}</span>
                <span
                  className="font-serif text-[1rem] leading-snug text-ink"
                  style={{ fontVariationSettings: '"opsz" 17' }}
                >
                  {v}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <div className="mt-20 text-center">
        <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">Ready when you are.</p>
        <h2
          className="mt-3 font-display text-display-2 leading-[1.02] tracking-[-0.015em] text-ink"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 30' }}
        >
          Tomorrow morning, 7&nbsp;AM.
        </h2>
        <div className="mt-7 flex justify-center">
          <NewsletterCTA />
        </div>
      </div>

      <div className="mt-20 border-t border-rule pt-10 text-center">
        <Dateline>Want the full archive?</Dateline>
        <p
          className="mt-4 max-w-xl mx-auto font-serif text-[1.0625rem] italic leading-relaxed text-ink-faded"
          style={{ fontVariationSettings: '"opsz" 17' }}
        >
          Members read every letter we&rsquo;ve ever published &mdash; searchable, permanent. $3/month or $30/year, with a free week first.
        </p>
        <a
          href="/membership"
          className="mt-5 inline-flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
        >
          Become a member →
        </a>
      </div>
    </div>
  );
}
