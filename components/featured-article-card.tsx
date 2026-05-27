import Link from "next/link";
import { Dateline } from "./dateline";
import { TopicPill } from "./topic-pill";
import { formatDateline } from "@/lib/queries";
import type { Post } from "@/lib/types";

interface FeaturedArticleCardProps {
  post: Post;
}

export function FeaturedArticleCard({ post }: FeaturedArticleCardProps) {
  return (
    <article className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 animate-fade-up">
      <div className="lg:col-span-7">
        <div className="flex items-center gap-3">
          <span className="bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-dateline text-parchment">
            Today's letter
          </span>
          <Dateline>
            {post.authorsName.join(" & ")}
            <span className="mx-1.5 text-ink-light">·</span>
            {post.authorsCompany}
            <span className="mx-1.5 text-ink-light">·</span>
            {formatDateline(post.dateAuthored)}
          </Dateline>
        </div>
        <Link href={`/post/${post.slug}`} className="card-title-link mt-5 block">
          <h2
            className="card-title font-display text-[clamp(2.5rem,5.5vw,4.25rem)] leading-[0.98] tracking-[-0.02em] text-ink inline"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
          >
            {post.title}
          </h2>
        </Link>
        <p
          className="mt-6 max-w-[60ch] font-serif text-[1.25rem] leading-[1.55] italic text-ink-faded"
          style={{ fontVariationSettings: '"opsz" 22' }}
        >
          {post.pullQuote}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          {post.topics.map((t) => (
            <TopicPill key={t} topic={t} />
          ))}
        </div>
        <Link
          href={`/post/${post.slug}`}
          className="mt-8 inline-flex items-center gap-2 border-b border-ink pb-1 font-sans text-[13px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
        >
          Read the letter
          <span aria-hidden>→</span>
        </Link>
      </div>
      <Link href={`/post/${post.slug}`} className="lg:col-span-5 group/img">
        <div className="document-frame transition-transform duration-300 group-hover/img:-rotate-1">
          {/* Using <img> so dev placeholders don't need Next/Image config */}
          <img
            src={post.screenshots[0]?.url}
            alt={post.screenshots[0]?.alt ?? post.title}
            className="block h-auto w-full"
          />
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          {post.screenshots[0]?.caption}
        </p>
      </Link>
    </article>
  );
}
