import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { Dateline } from "@/components/dateline";
import { NewsletterCTA } from "@/components/newsletter-cta";
import { SectionRule } from "@/components/section-rule";
import { getPostsByTopic, getTopicBySlug } from "@/lib/queries";
import { topics } from "@/lib/mock-data";
import type { PostTopic } from "@/lib/types";

export function generateStaticParams() {
  return topics.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const topic = getTopicBySlug(params.slug);
  if (!topic) return {};
  const url = `/topic/${topic.slug}`;
  return {
    title: topic.label,
    description: topic.blurb,
    alternates: { canonical: url },
    openGraph: { title: `${topic.label} — Correspondence`, description: topic.blurb, url },
  };
}

export default function TopicPage({ params }: { params: { slug: string } }) {
  const topic = getTopicBySlug(params.slug);
  if (!topic) notFound();
  const posts = getPostsByTopic(topic.slug as PostTopic);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>Topic</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          {topic.label}
        </h1>
        <p
          className="mt-6 max-w-prose font-serif text-[1.25rem] leading-snug italic text-ink-faded"
          style={{ fontVariationSettings: '"opsz" 22' }}
        >
          {topic.blurb}
        </p>
        <Dateline className="mt-6">{posts.length} {posts.length === 1 ? "letter" : "letters"} · most recent first</Dateline>
      </header>

      <section className="pt-14">
        {posts.length === 0 ? (
          <p className="text-base text-ink-faded">No letters in this topic yet.</p>
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
