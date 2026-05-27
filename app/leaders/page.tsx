import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { getAllLeaders, getPostsByLeader } from "@/lib/queries";

export const metadata = {
  title: "Leaders",
  description: "Browse the people whose correspondence we read closely.",
  alternates: { canonical: "/leaders" },
};

export default function LeadersIndexPage() {
  const leaders = getAllLeaders();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>Index</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Leaders
        </h1>
        <p className="mt-5 max-w-prose font-serif text-[1.0625rem] italic leading-relaxed text-ink-faded">
          The people whose correspondence has surfaced often enough to read closely. Listed by last name. Profiles are auto-rolled-up from published letters as the archive grows.
        </p>
      </header>

      <ul className="mt-10 divide-y divide-rule border-b border-rule">
        {leaders.map((l) => {
          const count = getPostsByLeader(l.slug).length;
          return (
            <li key={l.slug}>
              <Link
                href={`/leader/${l.slug}`}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-6 py-5 transition-colors hover:bg-parchment-deep/40 px-2 -mx-2"
              >
                <div>
                  <h2
                    className="font-display text-2xl text-ink transition-colors group-hover:text-brick"
                    style={{ fontVariationSettings: '"opsz" 48, "wght" 500, "SOFT" 30' }}
                  >
                    {l.name}
                  </h2>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
                    {l.companies.join(" · ")}
                    <span className="mx-2 text-ink-light">·</span>
                    {l.era}
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">
                  {count} {count === 1 ? "letter" : "letters"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
