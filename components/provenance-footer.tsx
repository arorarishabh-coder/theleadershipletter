import { Dateline } from "./dateline";
import { formatLongDate } from "@/lib/queries";
import type { Post } from "@/lib/types";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  sec_edgar: "SEC EDGAR Filing",
  court_exhibit: "Court Exhibit",
  congress: "Congressional Record",
  foreign_gov: "Foreign Government Publication",
  self_published: "Self-Published",
  press_quoted: "Press-Quoted Memo (Fair Use)",
};

const LICENSE_LABELS: Record<string, string> = {
  public_domain: "Public domain",
  self_published: "Publicly issued by the author",
  fair_use_excerpt: "Quoted under fair use",
};

interface ProvenanceFooterProps {
  post: Post;
}

export function ProvenanceFooter({ post }: ProvenanceFooterProps) {
  return (
    <section className="my-16 border-y-2 border-ink py-10">
      <div className="mx-auto max-w-2xl px-6 md:px-0">
        <Dateline strong>How this surfaced</Dateline>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 font-sans text-sm md:grid-cols-[max-content,1fr]">
          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Source type</dt>
          <dd className="text-ink">{SOURCE_TYPE_LABELS[post.sourceType] ?? post.sourceType}</dd>

          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Case / record</dt>
          <dd className="text-ink">{post.sourceCase}</dd>

          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Citation</dt>
          <dd className="text-ink">{post.sourceCitation}</dd>

          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Date authored</dt>
          <dd className="text-ink">{formatLongDate(post.dateAuthored)}</dd>

          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">License</dt>
          <dd className="text-ink">{LICENSE_LABELS[post.licensingPath] ?? post.licensingPath}</dd>

          <dt className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Original</dt>
          <dd>
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brick underline decoration-brick/40 underline-offset-4 transition-colors hover:text-brick-deep hover:decoration-brick"
            >
              View the primary source →
            </a>
          </dd>
        </dl>
      </div>
    </section>
  );
}
