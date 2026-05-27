import Link from "next/link";
import { formatIssueDate } from "@/lib/queries";

const NAV_ITEMS = [
  { href: "/", label: "Latest" },
  { href: "/browse", label: "Browse" },
  { href: "/topics", label: "Topics" },
  { href: "/about", label: "About" },
];

export function Header() {
  const issueDate = formatIssueDate();
  const issueNumber = 142; // mock — would compute from publication count

  return (
    <header className="border-b border-rule bg-parchment">
      {/* Top bar — dateline + utilities */}
      <div className="border-b border-rule/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-[11px] uppercase tracking-dateline text-ink-faded">
          <span className="font-mono">
            Issue №{issueNumber}
            <span className="mx-2 text-ink-light">·</span>
            {issueDate}
          </span>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/search" className="hover:text-brick transition-colors">
              Search
            </Link>
            <Link href="/signin" className="hover:text-brick transition-colors">
              Sign in
            </Link>
            <Link href="/subscribe" className="hover:text-brick transition-colors">
              Subscribe
            </Link>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="group inline-block">
            <h1
              className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.02em] text-ink"
              style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
            >
              The Leadership <em className="not-italic" style={{ fontVariationSettings: '"opsz" 144, "wght" 400, "SOFT" 100' }}>Letter</em>
            </h1>
          </Link>
          <p
            className="mt-5 max-w-md text-balance font-serif text-base italic leading-snug text-ink-faded"
            style={{ fontVariationSettings: '"opsz" 16' }}
          >
            Real correspondence from the people running real companies — and what it reveals about leadership.
          </p>
        </div>
      </div>

      {/* Section nav */}
      <nav className="border-y border-ink">
        <div className="mx-auto max-w-7xl px-6">
          <ul className="flex flex-wrap items-stretch justify-center gap-x-1 gap-y-0 divide-x divide-rule/70">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-5 py-3 font-sans text-[13px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-parchment-deep hover:text-brick"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="flex items-center">
              <Link
                href="/subscribe"
                className="block bg-ink px-5 py-3 font-sans text-[13px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick"
              >
                Subscribe →
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
