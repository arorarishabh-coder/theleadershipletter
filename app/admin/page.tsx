import Link from "next/link";
import { redirect } from "next/navigation";
import { Dateline } from "@/components/dateline";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getAdminStats, formatSource, formatThousands } from "@/lib/admin-stats";
import type { DailyBucket } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  description: "Pipeline activity, source breakdown, recent publications.",
  robots: { index: false, follow: false },
};

const RANGES = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) redirect(e.to);
    throw e;
  }

  const days = clampDays(searchParams.days);
  const stats = await getAdminStats(days);

  const maxBar = Math.max(1, ...stats.perDay.map((d) => Math.max(d.published, d.newsletters)));

  return (
    <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
      {/* Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-6">
        <div>
          <Dateline strong>Editorial &middot; Pipeline</Dateline>
          <h1
            className="mt-2 font-display text-display-3 leading-none tracking-[-0.015em] text-ink"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 30' }}
          >
            The desk
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-dateline">
            <Link href="/admin/social" className="text-brick transition-colors hover:text-ink">Social drafts →</Link>
            <Link href="/admin/reply" className="text-brick transition-colors hover:text-ink">Reply assistant →</Link>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-dateline">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin?days=${r.days}`}
              className={
                r.days === days
                  ? "bg-ink px-3 py-2 text-parchment"
                  : "border border-rule px-3 py-2 text-ink hover:border-ink hover:text-brick"
              }
            >
              Last {r.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Top-line stat strip */}
      <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-ink bg-ink/10 md:grid-cols-4">
        {[
          { k: stats.totals.published, v: "agent runs", sub: "one per article in window" },
          { k: stats.totals.published, v: "articles published", sub: `in last ${days} day${days === 1 ? "" : "s"}` },
          { k: stats.totals.newsletters, v: "newsletters sent", sub: "to subscribers" },
          { k: stats.totals.archive, v: "archive total", sub: "all-time corpus size" },
        ].map((s, i) => (
          <div key={i} className="bg-parchment-light px-6 py-7">
            <div
              className="font-display text-[2.5rem] leading-none text-ink"
              style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
            >
              {formatThousands(s.k)}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">{s.v}</div>
            <div className="mt-1 font-serif text-[12px] italic text-ink-light">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* Pace line */}
      <p className="mt-4 font-serif text-[14px] italic text-ink-faded">
        Pace: <strong className="not-italic text-ink">{stats.totals.avgPerDay}</strong> article{stats.totals.avgPerDay === 1 ? "" : "s"} per day across the window.
      </p>

      {/* Daily activity */}
      <section className="mt-12 border-y border-ink py-10">
        <Dateline strong>Daily activity &middot; last {days} day{days === 1 ? "" : "s"}</Dateline>
        <h2
          className="mt-3 font-display text-2xl leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          What the pipeline produced, day by day.
        </h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-serif text-[14px] text-ink">
            <thead>
              <tr className="border-b border-ink text-left font-mono text-[10px] uppercase tracking-dateline text-ink-faded">
                <th className="py-3 pr-4 font-normal">Day</th>
                <th className="py-3 pr-4 font-normal">Published</th>
                <th className="py-3 pr-4 font-normal">Newsletter sent</th>
                <th className="w-[260px] py-3 font-normal">Activity</th>
              </tr>
            </thead>
            <tbody>
              {stats.perDay.map((d) => (
                <DailyRow key={d.day} d={d} maxBar={maxBar} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Source breakdown */}
      <section className="mt-14">
        <Dateline strong>By source</Dateline>
        <h2
          className="mt-3 font-display text-2xl leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          Where the documents came from.
        </h2>
        {stats.bySource.length === 0 ? (
          <p className="mt-6 font-serif italic text-ink-faded">No articles in this window.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-ink bg-ink/10 md:grid-cols-2 lg:grid-cols-3">
            {stats.bySource.map((b) => {
              const pct =
                stats.totals.published > 0
                  ? Math.round((b.published / stats.totals.published) * 100)
                  : 0;
              return (
                <div key={b.source} className="bg-parchment-light px-6 py-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">{formatSource(b.source)}</span>
                    <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">{pct}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span
                      className="font-display text-[1.75rem] leading-none text-ink"
                      style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
                    >
                      {b.published}
                    </span>
                    <span className="font-serif text-[13px] italic text-ink-faded">article{b.published === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-3 h-[2px] w-full bg-rule/60">
                    <div className="h-full bg-brick" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent posts */}
      <section className="mt-14 border-t border-ink pt-10">
        <Dateline strong>Most recent &middot; last 10 in window</Dateline>
        <h2
          className="mt-3 font-display text-2xl leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
        >
          The latest publications.
        </h2>
        {stats.recent.length === 0 ? (
          <p className="mt-6 font-serif italic text-ink-faded">Nothing published in this window.</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse font-serif text-[14px] text-ink">
              <thead>
                <tr className="border-b border-ink text-left font-mono text-[10px] uppercase tracking-dateline text-ink-faded">
                  <th className="py-3 pr-4 font-normal">Published</th>
                  <th className="py-3 pr-4 font-normal">Title</th>
                  <th className="py-3 pr-4 font-normal">Company</th>
                  <th className="py-3 pr-4 font-normal">Source</th>
                  <th className="py-3 font-normal">Sent</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((p) => (
                  <tr key={p.slug} className="border-b border-rule align-baseline">
                    <td className="py-3 pr-4 font-mono text-[12px] text-ink-faded whitespace-nowrap">
                      {p.publishedAt}
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/post/${p.slug}`} className="hover:text-brick transition-colors">
                        {p.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 italic text-ink-faded">{p.authorsCompany ?? "—"}</td>
                    <td className="py-3 pr-4 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                      {formatSource(p.source)}
                    </td>
                    <td className="py-3 font-mono text-[12px] text-ink-faded">{p.newsletterSentAt ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-14 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
        Window: {stats.range.from} → {stats.range.to} &middot; UTC &middot; source = content/posts/*.json
      </p>
    </div>
  );
}

function DailyRow({ d, maxBar }: { d: DailyBucket; maxBar: number }) {
  const w = (n: number) => `${Math.round((n / maxBar) * 100)}%`;
  return (
    <tr className="border-b border-rule align-middle">
      <td className="py-3 pr-4 font-mono text-[12px] text-ink-faded whitespace-nowrap">{d.day}</td>
      <td className="py-3 pr-4 tabular-nums">{d.published}</td>
      <td className="py-3 pr-4 tabular-nums">{d.newsletters}</td>
      <td className="py-3">
        <div className="flex h-6 items-center gap-px overflow-hidden border border-rule">
          <div className="h-full bg-ink/80" style={{ width: w(d.published) }} title={`${d.published} published`} />
          <div className="h-full bg-brick/70" style={{ width: w(d.newsletters) }} title={`${d.newsletters} newsletters`} />
        </div>
      </td>
    </tr>
  );
}

function clampDays(v: string | undefined): number {
  const n = parseInt(v ?? "7", 10);
  if (!Number.isFinite(n)) return 7;
  if (n < 1) return 1;
  if (n > 365) return 365;
  return n;
}
