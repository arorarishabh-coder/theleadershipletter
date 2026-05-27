import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Dateline } from "@/components/dateline";
import { searchPosts } from "@/lib/queries";

export const metadata = {
  title: "Search",
  description: "Search The Leadership Letter archive.",
};

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = (searchParams.q ?? "").trim();
  const results = query ? searchPosts(query) : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>Archive · Search</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          Search the archive
        </h1>
        <form action="/search" method="get" className="mt-8 flex max-w-2xl border border-ink">
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Try “Activision” or “Bezos” or “acquisition”"
            className="w-full bg-parchment-light px-4 py-4 font-serif text-[1.0625rem] text-ink placeholder:text-ink-light focus:outline-none focus:bg-white"
            autoFocus
          />
          <button
            type="submit"
            className="bg-ink px-6 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
          >
            Search
          </button>
        </form>
      </header>

      <section className="pt-14">
        {!query ? (
          <p className="text-base text-ink-faded italic">
            Search across every letter in the archive — by leader, company, topic, or any phrase.
          </p>
        ) : results.length === 0 ? (
          <div>
            <Dateline strong>No results</Dateline>
            <p className="mt-4 max-w-prose text-base text-ink-faded">
              Nothing matched “<span className="text-ink not-italic">{query}</span>” in the current archive. Try a different phrase, or{" "}
              <Link href="/" className="text-brick underline decoration-brick/30 underline-offset-4 hover:text-brick-deep">
                browse the latest issues
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <Dateline strong>{results.length} {results.length === 1 ? "result" : "results"} for “{query}”</Dateline>
            <div className="mt-10 grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-2">
              {results.map((p, i) => (
                <ArticleCard key={p.slug} post={p} index={i} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
