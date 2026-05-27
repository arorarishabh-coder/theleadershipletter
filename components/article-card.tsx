import Link from "next/link";
import { Dateline } from "./dateline";
import { TopicPill } from "./topic-pill";
import { formatDateline } from "@/lib/queries";
import type { Post } from "@/lib/types";

interface ArticleCardProps {
  post: Post;
  showExcerpt?: boolean;
  index?: number;
}

export function ArticleCard({ post, showExcerpt = true, index = 0 }: ArticleCardProps) {
  return (
    <article
      className="group animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
    >
      <Dateline>
        {post.authorsName.join(" & ")} <span className="mx-1.5 text-ink-light">·</span>
        {post.authorsCompany} <span className="mx-1.5 text-ink-light">·</span>
        {formatDateline(post.dateAuthored)}
      </Dateline>
      <Link href={`/post/${post.slug}`} className="card-title-link mt-2 block">
        <h3
          className="card-title font-display text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink inline"
          style={{ fontVariationSettings: '"opsz" 48, "wght" 500, "SOFT" 30' }}
        >
          {post.title}
        </h3>
      </Link>
      {showExcerpt && (
        <p
          className="mt-3 max-w-prose font-serif text-[1.0625rem] leading-relaxed text-ink-faded"
          style={{ fontVariationSettings: '"opsz" 17' }}
        >
          {post.pullQuote}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {post.topics.slice(0, 3).map((t) => (
          <TopicPill key={t} topic={t} />
        ))}
      </div>
    </article>
  );
}
