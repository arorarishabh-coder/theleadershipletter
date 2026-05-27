import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { getBrowseCompanies, getBrowsePersons, getAllTopics } from "@/lib/queries";

export const metadata = {
  title: "Browse",
  description: "Filter the archive by company, person, or topic.",
  alternates: { canonical: "/browse" },
};

const pillClass =
  "inline-flex items-center rounded-full border border-ink/25 bg-parchment px-3.5 py-1.5 font-sans text-[13px] leading-none text-ink transition-colors hover:border-ink hover:bg-ink hover:text-parchment";

function FacetGroup({
  label,
  items,
}: {
  label: string;
  items: { href: string; name: string }[];
}) {
  return (
    <section className="border-t border-rule py-8">
      <h2 className="mb-4 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
        {label}
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={pillClass}>
            {it.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function BrowsePage() {
  // Derived live from the taxonomy + the published archive, so names added by
  // each ingest run appear here automatically (never hand-maintained).
  const companies = getBrowseCompanies().map((c) => ({ href: `/company/${c.slug}`, name: c.name }));
  const persons = getBrowsePersons().map((p) => ({ href: `/leader/${p.slug}`, name: p.name }));
  const topics = getAllTopics().map((t) => ({ href: `/topic/${t.slug}`, name: t.label }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="pb-6">
        <Dateline strong>Filters</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Browse the archive
        </h1>
        <p className="mt-5 max-w-prose font-serif text-[1.0625rem] italic leading-relaxed text-ink-faded">
          Every letter is tagged by the company it came from, the people in it, and the decisions it turns on. Pick a thread to follow.
        </p>
      </header>

      <FacetGroup label="Company" items={companies} />
      <FacetGroup label="Person" items={persons} />
      <FacetGroup label="Topic" items={topics} />
    </div>
  );
}
