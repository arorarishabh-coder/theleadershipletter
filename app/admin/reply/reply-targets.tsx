import { REPLY_TARGETS, REPLY_ROUTINE } from "@/lib/social/reply-targets";

// Daily reply-target list — the "who to reply to" that turns the reply assistant
// into a repeatable routine. Server component: static data + outbound links only.

export function ReplyTargets() {
  return (
    <section className="mt-14 border-t border-ink pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          className="font-display text-2xl text-ink"
          style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}
        >
          Daily reply targets
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-dateline text-brick">
          Goal · {REPLY_ROUTINE.goal}
        </span>
      </div>

      <ol className="mt-4 space-y-1.5">
        {REPLY_ROUTINE.how.map((h, i) => (
          <li key={i} className="flex gap-2 font-serif text-[14px] leading-relaxed text-ink-faded">
            <span className="font-mono text-[11px] text-brick">{i + 1}.</span>
            <span>{h}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-8">
        {REPLY_TARGETS.map((group) => (
          <div key={group.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-1.5">
              <span className="font-mono text-[11px] uppercase tracking-dateline text-ink">{group.title}</span>
              <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">{group.cadence}</span>
            </div>
            <p className="mt-2 font-serif text-[13px] italic leading-relaxed text-ink-light">{group.blurb}</p>

            <ul className="mt-3 space-y-3">
              {group.targets.map((t) => (
                <li key={t.handle} className="border border-rule bg-parchment-light px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a
                      href={`https://x.com/${t.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[13px] font-semibold text-ink hover:text-brick"
                    >
                      @{t.handle}
                    </a>
                    <span className="font-serif text-[13px] text-ink-faded">{t.name}</span>
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`from:${t.handle}`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 border border-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-dateline text-ink transition-colors hover:bg-ink hover:text-parchment"
                    >
                      Recent →
                    </a>
                  </div>
                  <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-ink-faded">{t.why}</p>
                  <p className="mt-1 font-serif text-[13px] leading-relaxed text-ink-light">
                    <span className="font-mono text-[10px] uppercase tracking-dateline text-brick">Reply with · </span>
                    {t.fit}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
        Handles change — if a “Recent →” link 404s, update lib/social/reply-targets.ts.
      </p>
    </section>
  );
}
