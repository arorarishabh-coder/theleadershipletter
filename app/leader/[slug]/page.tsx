import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { Dateline } from "@/components/dateline";
import { SectionRule } from "@/components/section-rule";
import { NewsletterCTA } from "@/components/newsletter-cta";
import { getAllPersons, getLeaderBySlug, getPostsByLeader } from "@/lib/queries";
import { leaders } from "@/lib/mock-data";

export function generateStaticParams() {
  // Union of bio'd leaders + every person in the browse taxonomy.
  const slugs = new Set([...leaders.map((l) => l.slug), ...getAllPersons().map((p) => p.slug)]);
  return [...slugs].map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const leader = getLeaderBySlug(params.slug);
  if (!leader) return {};
  const url = `/leader/${leader.slug}`;
  const description = leader.bio.slice(0, 200);
  return {
    title: leader.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title: `${leader.name} — Correspondence`, description, url },
  };
}

export default function LeaderPage({ params }: { params: { slug: string } }) {
  const leader = getLeaderBySlug(params.slug);
  if (!leader) notFound();
  const posts = getPostsByLeader(leader.slug);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      {/* Leader header */}
      <header className="grid grid-cols-1 gap-10 border-b border-ink pb-16 md:grid-cols-[1fr_auto] md:gap-16">
        <div>
          <Dateline strong>Leader · Profile</Dateline>
          <h1
            className="mt-4 font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
          >
            {leader.name}
          </h1>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-dateline">
            {leader.companies.map((c, i) => (
              <span key={c} className="text-ink">
                {c}
                {i < leader.companies.length - 1 && <span className="ml-3 text-ink-light">·</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
            {leader.era}
          </p>
          <p
            className="mt-8 max-w-prose font-serif text-[1.125rem] leading-relaxed text-ink"
            style={{ fontVariationSettings: '"opsz" 18' }}
          >
            {leader.bio}
          </p>
        </div>
        <div className="hidden md:block">
          <div className="aspect-[3/4] w-48 border-2 border-ink bg-parchment-deep p-3 shadow-frame">
            <div className="flex h-full w-full items-center justify-center bg-parchment-light">
              <span
                className="font-display text-7xl text-ink/15"
                style={{ fontVariationSettings: '"opsz" 144, "wght" 500' }}
              >
                {leader.name.split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Posts */}
      <section className="pt-14">
        <div className="mb-10 flex items-baseline justify-between border-b border-rule pb-3">
          <h2
            className="font-display text-display-3 leading-none text-ink"
            style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
          >
            Correspondence in the archive
          </h2>
          <Dateline>{posts.length} {posts.length === 1 ? "letter" : "letters"}</Dateline>
        </div>
        {posts.length === 0 ? (
          <p className="text-base text-ink-faded">No published letters yet for {leader.name}. Check back as the archive grows.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-2">
            {posts.map((p, i) => (
              <ArticleCard key={p.slug} post={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <SectionRule />

      <NewsletterCTA variant="boxed" />
    </div>
  );
}
