interface PullQuoteProps {
  children: React.ReactNode;
  attribution?: string;
}

export function PullQuote({ children, attribution }: PullQuoteProps) {
  return (
    <figure className="my-14 md:my-20">
      <div className="relative mx-auto max-w-3xl">
        <span
          aria-hidden
          className="absolute -left-2 -top-12 select-none font-display text-[10rem] leading-[0.8] text-brick/15 md:-left-10 md:-top-16 md:text-[14rem]"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 400' }}
        >
          “
        </span>
        <blockquote
          className="relative font-display text-pull-quote leading-[1.15] tracking-[-0.005em] text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 400, "SOFT" 50' }}
        >
          <em className="not-italic" style={{ fontStyle: "italic" }}>
            {children}
          </em>
        </blockquote>
      </div>
      {attribution && (
        <figcaption className="mx-auto mt-6 max-w-3xl font-mono text-[11px] uppercase tracking-dateline text-ink-light">
          — {attribution}
        </figcaption>
      )}
    </figure>
  );
}
