import { redirect } from "next/navigation";
import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getAllPosts } from "@/lib/queries";
import { listBroadcastsByName } from "@/lib/publish/resend";
import { SocialPanel } from "./social-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Social drafts",
  description: "Paste-ready Twitter + LinkedIn drafts per post.",
  robots: { index: false, follow: false },
};

export default async function SocialPage() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) redirect(e.to);
    throw e;
  }

  // Join Resend's actual send timestamps onto our corpus. The posts' own
  // `publishedAt` is a backdated *document* date (the whole buffer was ingested
  // 2026-05-26), so it does NOT reflect when an edition was emailed — which made
  // the letter sent *today* show a May date and buried the newest editions. We
  // surface the real emailed date (Resend `sent_at`, → YYYY-MM-DD) instead, and
  // only fall back to `publishedAt` for unsent buffer posts.
  const broadcasts = await listBroadcastsByName();
  const sentDate = (slug: string): string | null => {
    const s = broadcasts.get(slug.toLowerCase())?.sentAt;
    return s ? s.slice(0, 10) : null;
  };
  let freeSlug: string | null = null;
  let freeSentAt = "";
  for (const [slug, info] of broadcasts) {
    if (info.sentAt && info.sentAt > freeSentAt) {
      freeSentAt = info.sentAt;
      freeSlug = slug;
    }
  }

  // Display date = actual emailed date when we have it, else the document date.
  // Sort sent editions newest-emailed first, then unsent buffer by document date.
  const all = getAllPosts()
    .slice()
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      publishedAt: sentDate(p.slug) ?? p.publishedAt,
      emailed: sentDate(p.slug) != null,
    }))
    .sort((a, b) => {
      if (a.emailed !== b.emailed) return a.emailed ? -1 : 1;
      return (b.publishedAt || "").localeCompare(a.publishedAt || "");
    });

  // Pin the most-recently-emailed edition to the very top (it's the one you'll
  // most often post about).
  let list = all.slice(0, 30);
  if (freeSlug) {
    const today = all.find((p) => p.slug === freeSlug);
    if (today) list = [today, ...list.filter((p) => p.slug !== freeSlug)];
  }
  const posts = list.map((p) => ({ slug: p.slug, title: p.title, publishedAt: p.publishedAt }));
  const defaultSlug = (freeSlug && posts.some((p) => p.slug === freeSlug) ? freeSlug : posts[0]?.slug) ?? "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-20">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-6">
        <div>
          <Dateline strong>Editorial &middot; Distribution</Dateline>
          <h1
            className="mt-2 font-display text-display-3 leading-none tracking-[-0.015em] text-ink"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 30' }}
          >
            Social drafts
          </h1>
        </div>
        <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-dateline">
          <Link href="/admin/reply" className="text-brick hover:text-ink">Reply assistant →</Link>
          <Link href="/admin" className="text-ink hover:text-brick">The desk</Link>
        </nav>
      </header>

      <p className="mt-5 max-w-2xl font-serif text-[1.0625rem] leading-relaxed text-ink-faded">
        Paste-ready Twitter/X + LinkedIn drafts for any edition — generated on demand, with the
        document image, UTM links, hashtags, and posting times. Copy, review, and post manually.
      </p>

      <details className="mt-6 border border-rule bg-parchment-light">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-dateline text-ink">
          ▾ Distribution playbook — how to actually get reach
        </summary>
        <div className="space-y-2.5 border-t border-rule px-5 py-4 font-serif text-[15px] leading-relaxed text-ink-faded">
          <p><strong className="text-ink">Lead with the image.</strong> Post the single tweet + the document screenshot first — image posts get far more reach, and threads flop for accounts without followers. Save the thread for once you have a base.</p>
          <p><strong className="text-ink">Post at peak — never late at night.</strong> X: Tue–Thu, 8–10&nbsp;AM ET. LinkedIn: Tue–Wed, ~8&nbsp;AM ET.</p>
          <p><strong className="text-ink">Reply game (daily, 20–30 min) — the #1 cold-start lever.</strong> Comment with a sharp take + a relevant exhibit on big accounts to borrow their audience: <code className="text-ink">@TechEmails, @TrungTPhan, @SahilBloom, @lennysan, @JoeKwon, @business, @WSJ</code>, plus tech/antitrust news threads.</p>
          <p><strong className="text-ink">Newsjack.</strong> When the company/topic is in the news, quote-tweet or reply with “here’s the actual email” + the screenshot.</p>
          <p><strong className="text-ink">Seed early engagement.</strong> The first 30 minutes decide reach — have a few people like/reply right after you post.</p>
          <p><strong className="text-ink">Be consistent.</strong> Daily posting + replies compound. Week 1 from zero is single-digit views — that’s normal, not a failure.</p>
        </div>
      </details>

      <div className="mt-8">
        <SocialPanel posts={posts} defaultSlug={defaultSlug} todaySlug={freeSlug ?? ""} />
      </div>
    </div>
  );
}
