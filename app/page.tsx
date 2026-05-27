import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { FeaturedArticleCard } from "@/components/featured-article-card";
import { NewsletterCTA } from "@/components/newsletter-cta";
import { SectionRule } from "@/components/section-rule";
import { Dateline } from "@/components/dateline";
import { getFeaturedPost, getDailyFeed, getAllTopics } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import { SITE } from "@/lib/site";

// Regenerate hourly so the daily-rotating featured post updates on the live site
// (the page would otherwise be frozen at build time).
export const revalidate = 3600;

export default function HomePage() {
  const featured = getFeaturedPost();
  const recent = getDailyFeed(featured ? [featured.slug] : []);
  const topics = getAllTopics().slice(0, 9);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon`,
    description: SITE.description,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <JsonLd data={[websiteLd, orgLd]} />
      {/* Featured */}
      {featured && (
        <section className="border-b border-rule pb-16">
          <FeaturedArticleCard post={featured} />
        </section>
      )}

      {/* Inline CTA */}
      <section className="border-b border-rule py-10">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center md:gap-10">
          <div>
            <Dateline strong>Daily edition · Free · No filler</Dateline>
            <p className="mt-2 max-w-2xl font-serif text-[1.0625rem] leading-relaxed text-ink-faded italic" style={{ fontVariationSettings: '"opsz" 17' }}>
              One real corporate letter every weekday morning. The lesson it teaches, and a link to the original source.
            </p>
          </div>
          <NewsletterCTA />
        </div>
      </section>

      {/* Recent issues */}
      <section className="py-16">
        <header className="mb-10 flex items-baseline justify-between border-b border-ink pb-3">
          <h2
            className="font-display text-display-3 leading-none text-ink"
            style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
          >
            From the archive
          </h2>
          <Dateline>Reshuffled daily</Dateline>
        </header>
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {recent.map((p, i) => (
            <ArticleCard key={p.slug} post={p} index={i} />
          ))}
        </div>
      </section>

      <SectionRule />

      {/* Topics index */}
      <section className="py-12">
        <Dateline strong>Browse by topic</Dateline>
        <h2
          className="mt-3 max-w-3xl font-display text-display-3 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          The decisions, fights, and crises we keep returning to.
        </h2>
        <ul className="mt-7 grid grid-cols-1 gap-x-12 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/topic/${t.slug}`}
                className="group flex items-center justify-between gap-3 border-b border-rule py-3 transition-colors hover:border-ink"
              >
                <span
                  className="font-display text-lg text-ink transition-colors group-hover:text-brick"
                  style={{ fontVariationSettings: '"opsz" 36, "wght" 500, "SOFT" 30' }}
                >
                  {t.label}
                </span>
                <span className="font-mono text-[14px] text-ink-light group-hover:text-brick transition-colors">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/browse"
          className="mt-6 inline-flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
        >
          Browse by company, person &amp; topic
          <span aria-hidden>→</span>
        </Link>
      </section>
    </div>
  );
}
