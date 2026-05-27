import { Dateline } from "./dateline";

interface ExcerptBlockProps {
  excerpt: string;
  authorsName: string[];
  documentTitle: string;
  dateAuthored: string;
}

export function ExcerptBlock({
  excerpt,
  authorsName,
  documentTitle,
  dateAuthored,
}: ExcerptBlockProps) {
  const paragraphs = excerpt.split(/\n\n+/).filter(Boolean);
  return (
    <figure className="my-12 border-y border-ink bg-parchment-deep/40 py-10">
      <div className="mx-auto max-w-2xl px-6 md:px-0">
        <Dateline strong>
          Excerpt · In {authorsName.join(" & ")}'s own words
        </Dateline>
        <div
          className="mt-5 font-serif text-[1.125rem] leading-[1.7] text-ink"
          style={{ fontVariationSettings: '"opsz" 18, "wght" 400' }}
        >
          {paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-5" : ""}>
              <span className="italic">{p}</span>
            </p>
          ))}
        </div>
        <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          — {documentTitle}
        </figcaption>
      </div>
    </figure>
  );
}
