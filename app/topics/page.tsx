import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { getAllTopics, getPostsByTopic } from "@/lib/queries";

export const metadata = {
  title: "Topics",
  description: "Browse correspondence by topic.",
  alternates: { canonical: "/topics" },
};

export default function TopicsIndexPage() {
  const topics = getAllTopics();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>Index</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Topics
        </h1>
        <p className="mt-5 max-w-prose font-serif text-[1.0625rem] italic leading-relaxed text-ink-faded">
          The decisions, fights, and crises we keep returning to. Topics emerge from the documents themselves rather than from a fixed taxonomy.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-1 gap-0 md:grid-cols-2">
        {topics.map((t) => {
          const count = getPostsByTopic(t.slug).length;
          return (
            <li key={t.slug}>
              <Link
                href={`/topic/${t.slug}`}
                className="group flex h-full flex-col justify-between gap-4 border border-rule p-6 transition-colors hover:bg-parchment-deep/40 hover:border-ink"
              >
                <div>
                  <h2
                    className="font-display text-2xl text-ink transition-colors group-hover:text-brick"
                    style={{ fontVariationSettings: '"opsz" 48, "wght" 500, "SOFT" 30' }}
                  >
                    {t.label}
                  </h2>
                  <p className="mt-3 font-serif text-[1rem] leading-snug text-ink-faded italic">
                    {t.blurb}
                  </p>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">
                  {count} {count === 1 ? "letter" : "letters"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
