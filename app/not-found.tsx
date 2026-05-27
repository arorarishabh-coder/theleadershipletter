import Link from "next/link";
import { Dateline } from "@/components/dateline";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-32 text-center">
      <Dateline strong>404 · Off the docket</Dateline>
      <h1
        className="mt-6 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.95] tracking-[-0.025em] text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
      >
        This document does not exist.
      </h1>
      <p
        className="mx-auto mt-6 max-w-md font-serif text-[1.125rem] italic leading-relaxed text-ink-faded"
        style={{ fontVariationSettings: '"opsz" 18' }}
      >
        Either the citation was wrong or the letter was sealed before we could read it.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-brick hover:border-brick"
      >
        ← Back to the archive
      </Link>
    </div>
  );
}
