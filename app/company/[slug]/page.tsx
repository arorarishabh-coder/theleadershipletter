import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { Dateline } from "@/components/dateline";
import { getAllCompanies, getCompanyBySlug, getPostsByCompany } from "@/lib/queries";

export function generateStaticParams() {
  return getAllCompanies().map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const company = getCompanyBySlug(params.slug);
  if (!company) return {};
  const url = `/company/${company.slug}`;
  const description = `Internal correspondence and leadership lessons from ${company.name}.`;
  return {
    title: company.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${company.name} — The Leadership Letter`, description, url },
  };
}

export default function CompanyPage({ params }: { params: { slug: string } }) {
  const company = getCompanyBySlug(params.slug);
  if (!company) notFound();
  const posts = getPostsByCompany(company.slug);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>Company</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          {company.name}
        </h1>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          {posts.length} {posts.length === 1 ? "letter" : "letters"}
        </p>
      </header>

      {posts.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 gap-x-14 gap-y-12 md:grid-cols-3">
          {posts.map((p, i) => (
            <ArticleCard key={p.slug} post={p} index={i} />
          ))}
        </div>
      ) : (
        <p className="mt-12 max-w-prose font-serif text-[1.0625rem] italic leading-relaxed text-ink-faded">
          No letters from {company.name} in the archive yet — it&rsquo;s on the watchlist. Check back as new documents surface.
        </p>
      )}

      <div className="mt-16 border-t border-rule pt-8">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
        >
          ← All filters
        </Link>
      </div>
    </div>
  );
}
