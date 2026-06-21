import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DocumentFrame } from "@/components/document-frame";
import { ExcerptBlock } from "@/components/excerpt-block";
import { MarkdownLesson } from "@/components/markdown-lesson";
import { Paywall } from "@/components/paywall";
import { ProvenanceFooter } from "@/components/provenance-footer";
import { PullQuote } from "@/components/pull-quote";
import { TopicPill } from "@/components/topic-pill";
import { NewsletterCTA } from "@/components/newsletter-cta";
import { SectionRule } from "@/components/section-rule";
import { ArticleCard } from "@/components/article-card";
import { Dateline } from "@/components/dateline";
import { JsonLd } from "@/components/json-ld";
import { SITE } from "@/lib/site";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { membershipStatus } from "@/lib/membership";
import { decideAccess, parseSimulate } from "@/lib/post-access";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";
import {
  formatDateline,
  formatLongDate,
  getLeaderBySlug,
  getPostBySlug,
  getPostsByLeader,
  getPostsByTopic,
} from "@/lib/queries";

// Per-user paywall gates the lesson body, so the page can't be statically
// pre-rendered. The article shell (header, document frame, excerpt) is fast;
// only the lesson body + related section flip per-visitor.
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const SOURCE_TYPE_LABELS: Record<string, string> = {
  sec_edgar: "SEC EDGAR Filing",
  court_exhibit: "Court Exhibit",
  congress: "Congressional Record",
  foreign_gov: "Foreign Government Publication",
  self_published: "Self-Published",
  press_quoted: "Press-Quoted Memo",
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  const url = `/post/${post.slug}`;
  return {
    title: post.title,
    description: post.pullQuote,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.pullQuote,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.publishedAt,
      authors: post.authorsName,
      section: post.topics[0],
      tags: post.topics,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.pullQuote,
    },
  };
}

// One labeled analysis block ("The situation" / "The lesson" / "Put it to work").
// Body is short prose that may carry light **bold**, so it reuses the markdown
// renderer for consistent typography.
function AnalysisSection({ label, body, dropcap = false }: { label: string; body: string; dropcap?: boolean }) {
  return (
    <div className={dropcap ? undefined : "no-dropcap"}>
      <Dateline strong>{label}</Dateline>
      <div className="mt-4">
        <MarkdownLesson source={body} />
      </div>
    </div>
  );
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { simulate?: string };
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  // Membership lookup. Anonymous users never hit the DB. Admin's `simulate=…`
  // overrides the real state for testing (see lib/post-access.ts).
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase();
  const user = userEmail
    ? await db.user.findUnique({
        where: { email: userEmail },
        include: { subscription: true },
      })
    : null;
  const membership = membershipStatus(user);
  const isAdmin = Boolean(userEmail && ADMIN_EMAILS.has(userEmail));
  // Resend tells us which post slug was actually emailed most recently.
  // That single article is the free edition; everything else is gated.
  const freeSlug = await getMostRecentBroadcastSlug();
  const access = decideAccess({
    postSlug: post.slug,
    freeSlug,
    membership,
    isAdmin,
    simulate: parseSimulate(searchParams.simulate),
  });

  const primaryLeader = post.leaderSlugs[0] ? getLeaderBySlug(post.leaderSlugs[0]) : undefined;
  const relatedByLeader = primaryLeader ? getPostsByLeader(primaryLeader.slug, post.slug).slice(0, 3) : [];
  const relatedByTopic = post.topics[0] ? getPostsByTopic(post.topics[0], post.slug).slice(0, 3) : [];

  const canonical = `${SITE.url}/post/${post.slug}`;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.pullQuote,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    image: [`${canonical}/opengraph-image`],
    author: post.authorsName.map((name) => ({ "@type": "Person", name })),
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icon` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    articleSection: post.topics,
    inLanguage: "en",
    ...(post.sourceUrl ? { isBasedOn: post.sourceUrl } : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Browse", item: `${SITE.url}/browse` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  };

  return (
    <article>
      <JsonLd data={[articleLd, breadcrumbLd]} />
      {/* Article header */}
      <header className="border-b border-rule">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
          <Dateline>
            <span className="text-ink">{SOURCE_TYPE_LABELS[post.sourceType] ?? post.sourceType}</span>
            <span className="mx-2 text-ink-light">·</span>
            {formatDateline(post.dateAuthored)}
          </Dateline>
          <h1
            className="mt-6 font-display text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-balance text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
          >
            {post.title}
          </h1>
          <div className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-dateline">
            <span className="text-ink">{post.authorsName.join(" & ")}</span>
            <span className="text-ink-light">·</span>
            <span className="text-ink-faded">{post.authorsCompany}</span>
            {post.recipientNames.length > 0 && (
              <>
                <span className="text-ink-light">·</span>
                <span className="text-ink-faded">to {post.recipientNames.join(", ")}</span>
              </>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {post.topics.map((t) => (
              <TopicPill key={t} topic={t} size="md" />
            ))}
          </div>
        </div>
      </header>

      {/* Pull quote */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <PullQuote attribution={`${SITE.name} · ${formatLongDate(post.publishedAt)}`}>
            {post.pullQuote}
          </PullQuote>
        </div>
      </section>

      {/* Document */}
      <section className="border-b border-rule bg-parchment-light/40">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <DocumentFrame screenshots={post.screenshots} />
        </div>
      </section>

      {/* Excerpt */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-3xl px-6">
          <ExcerptBlock
            excerpt={post.excerptForBlog}
            authorsName={post.authorsName}
            documentTitle={post.documentTitle}
            dateAuthored={post.dateAuthored}
          />
        </div>
      </section>

      {/* Lesson body — gated for archive editions, free for today's letter */}
      {access.hasAccess ? (
      <section>
        <div className="mx-auto max-w-2xl px-6 py-14 md:py-20">
          {post.situation && post.insight && post.application ? (
            <div className="space-y-12">
              <AnalysisSection label="The situation" body={post.situation} dropcap />
              <AnalysisSection label="The lesson" body={post.insight} />
              <AnalysisSection label="Put it to work" body={post.application} />
            </div>
          ) : (
            <MarkdownLesson source={post.lessonBody ?? ""} />
          )}
          <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-rule pt-6">
            <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-light mr-2">
              Traits in evidence
            </span>
            {post.leadershipTraits.map((trait) => (
              <span
                key={trait}
                className="border border-ink/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-dateline text-ink"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </section>
      ) : (
        <Paywall state={access.state} postSlug={post.slug} simulated={access.simulated} />
      )}

      {/* Provenance */}
      <div className="mx-auto max-w-3xl px-6">
        <ProvenanceFooter post={post} />
      </div>

      {/* Newsletter CTA — only shown to anonymous readers. Signed-in users
          (members or not) are already in the audience, so suppressing it
          removes a redundant ask and keeps the page calmer. */}
      {!session && <NewsletterCTA variant="boxed" />}

      {/* Related */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        {primaryLeader && relatedByLeader.length > 0 && (
          <div className="border-t border-ink pt-10">
            <Dateline strong>More from {primaryLeader.name}</Dateline>
            <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-12 md:grid-cols-3">
              {relatedByLeader.map((p, i) => (
                <ArticleCard key={p.slug} post={p} index={i} />
              ))}
            </div>
          </div>
        )}
        {relatedByTopic.length > 0 && (
          <div className="mt-20 border-t border-ink pt-10">
            <Dateline strong>More on this topic</Dateline>
            <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-12 md:grid-cols-3">
              {relatedByTopic.map((p, i) => (
                <ArticleCard key={p.slug} post={p} index={i} />
              ))}
            </div>
          </div>
        )}
        <SectionRule />
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
          >
            ← Back to all issues
          </Link>
        </div>
      </section>
    </article>
  );
}
