import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { formatThousands } from "@/lib/admin-stats";
import type { EmailEngagementSummary } from "@/lib/metrics/email-events";

function pct(x: number | null): string {
  return x == null ? "—" : `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
}

function fmtSentDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/**
 * Newsletter open/click engagement panel for /admin. Rendered from the
 * EmailEvent log (see lib/metrics/email-events.ts). Shows an actionable empty
 * state until Resend tracking + the webhook are switched on, then headline
 * rates + a per-edition table.
 */
export function EngagementSection({ engagement }: { engagement: EmailEngagementSummary }) {
  return (
    <section className="mt-12 border-y border-ink py-10">
      <Dateline strong>Newsletter &middot; Engagement</Dateline>
      <h2
        className="mt-3 font-display text-2xl leading-tight text-ink"
        style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
      >
        Who opens, and who clicks through.
      </h2>

      {!engagement.configured ? (
        <div className="mt-6 border border-rule bg-parchment-light px-6 py-6">
          <p className="font-serif text-[15px] leading-relaxed text-ink">
            No open/click events captured yet. The receiver is live — it just needs to be switched on in Resend.
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 font-serif text-[14px] text-ink-light">
            <li>Resend → your domain → enable <strong className="text-ink">Open tracking</strong> and <strong className="text-ink">Click tracking</strong>.</li>
            <li>Resend → Webhooks → add an endpoint at <code className="font-mono text-[12px] text-brick">/api/webhooks/resend</code> for the <em>email.delivered / opened / clicked / bounced</em> events.</li>
            <li>Set <code className="font-mono text-[12px] text-brick">RESEND_WEBHOOK_SECRET</code> (the endpoint&rsquo;s signing secret) in Vercel.</li>
          </ol>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">
            Rates appear here from the next send onward.
          </p>
        </div>
      ) : (
        <>
          {/* Headline rates */}
          <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-ink bg-ink/10 md:grid-cols-4">
            {[
              { k: pct(engagement.totals.openRate), v: "open rate", sub: "unique opens ÷ delivered" },
              { k: pct(engagement.totals.clickRate), v: "click rate", sub: "unique clicks ÷ delivered" },
              { k: pct(engagement.totals.opens ? engagement.totals.clicks / engagement.totals.opens : null), v: "click-to-open", sub: "of openers, who clicked" },
              { k: formatThousands(engagement.broadcasts.length), v: "editions tracked", sub: `${formatThousands(engagement.eventCount)} events logged` },
            ].map((s, i) => (
              <div key={i} className="bg-parchment-light px-6 py-7">
                <div
                  className="font-display text-[2.5rem] leading-none text-ink"
                  style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
                >
                  {s.k}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">{s.v}</div>
                <div className="mt-1 font-serif text-[12px] italic text-ink-light">{s.sub}</div>
              </div>
            ))}
          </section>

          {/* Per-edition table */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse font-serif text-[14px] text-ink">
              <thead>
                <tr className="border-b border-ink text-left font-mono text-[10px] uppercase tracking-dateline text-ink-faded">
                  <th className="py-3 pr-4 font-normal">Sent</th>
                  <th className="py-3 pr-4 font-normal">Edition</th>
                  <th className="py-3 pr-4 font-normal text-right">Delivered</th>
                  <th className="py-3 pr-4 font-normal text-right">Opens</th>
                  <th className="py-3 pr-4 font-normal text-right">Open %</th>
                  <th className="py-3 pr-4 font-normal text-right">Clicks</th>
                  <th className="py-3 font-normal text-right">Click %</th>
                </tr>
              </thead>
              <tbody>
                {engagement.broadcasts.slice(0, 14).map((b) => (
                  <tr key={b.broadcastId} className="border-b border-rule align-baseline">
                    <td className="py-3 pr-4 font-mono text-[12px] text-ink-faded whitespace-nowrap">{fmtSentDate(b.sentAt)}</td>
                    <td className="py-3 pr-4">
                      {b.slug ? (
                        <Link href={`/post/${b.slug}`} className="hover:text-brick transition-colors">
                          {b.title ?? b.slug}
                        </Link>
                      ) : (
                        <span className="italic text-ink-faded">{b.broadcastId.slice(0, 12)}…</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{b.delivered}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{b.opens}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-mono text-[13px]">{pct(b.openRate)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{b.clicks}</td>
                    <td className="py-3 text-right tabular-nums font-mono text-[13px]">{pct(b.clickRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
