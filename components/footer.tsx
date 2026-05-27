import Link from "next/link";
import { formatIssueDate } from "@/lib/queries";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-ink bg-parchment-deep/50">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link href="/" className="inline-block">
              <h2
                className="font-display text-3xl leading-none tracking-[-0.01em] text-ink"
                style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
              >
                The Leadership <em className="not-italic" style={{ fontVariationSettings: '"opsz" 60, "wght" 400, "SOFT" 100' }}>Letter</em>
              </h2>
            </Link>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-faded" style={{ fontVariationSettings: '"opsz" 16' }}>
              A daily reading of real internal corporate correspondence — the letters, memos, and emails leaders wrote when they did not expect them to be public.
            </p>
            <form className="mt-6 flex max-w-sm gap-0 border border-ink">
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="w-full bg-parchment-light px-4 py-3 font-sans text-sm text-ink placeholder:text-ink-light focus:outline-none focus:bg-white"
              />
              <button
                type="submit"
                className="bg-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-2 text-[11px] uppercase tracking-dateline text-ink-light font-mono">
              Daily · Free · No filler
            </p>
          </div>

          {/* Sections */}
          <div className="md:col-span-2">
            <h3 className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Sections</h3>
            <ul className="mt-4 space-y-2 text-base text-ink">
              <li><Link href="/" className="hover:text-brick transition-colors">Latest</Link></li>
              <li><Link href="/browse" className="hover:text-brick transition-colors">Browse</Link></li>
              <li><Link href="/topics" className="hover:text-brick transition-colors">Topics</Link></li>
              <li><Link href="/search" className="hover:text-brick transition-colors">Search</Link></li>
            </ul>
          </div>

          {/* About */}
          <div className="md:col-span-2">
            <h3 className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">About</h3>
            <ul className="mt-4 space-y-2 text-base text-ink">
              <li><Link href="/about" className="hover:text-brick transition-colors">Mission</Link></li>
              <li><Link href="/about#charter" className="hover:text-brick transition-colors">Editorial Charter</Link></li>
              <li><Link href="/about#sources" className="hover:text-brick transition-colors">Sources</Link></li>
              <li><Link href="/about#removals" className="hover:text-brick transition-colors">Removals</Link></li>
            </ul>
          </div>

          {/* Provenance */}
          <div className="md:col-span-3">
            <h3 className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">Provenance</h3>
            <p className="mt-4 text-sm leading-relaxed text-ink-faded">
              Every post links to its primary public source. Excerpts are limited to fair-use length and paired with original commentary. We do not publish material from active leaks or hacks.
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-dateline text-ink-light">
              {formatIssueDate()}
            </p>
          </div>
        </div>

        {/* Bottom rule */}
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-rule pt-6 text-[11px] uppercase tracking-dateline text-ink-light font-mono md:flex-row md:items-center">
          <span>© {year} The Leadership Letter · An independent editorial project</span>
          <span>Set in Fraunces, Newsreader, DM Sans &amp; JetBrains Mono</span>
        </div>
      </div>
    </footer>
  );
}
