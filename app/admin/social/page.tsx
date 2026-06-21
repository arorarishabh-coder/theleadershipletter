import { redirect } from "next/navigation";
import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getAllPosts } from "@/lib/queries";
import { getMostRecentBroadcastSlug } from "@/lib/publish/resend";
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

  const posts = getAllPosts()
    .slice()
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 30)
    .map((p) => ({ slug: p.slug, title: p.title, publishedAt: p.publishedAt }));

  const freeSlug = await getMostRecentBroadcastSlug();
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
        <Link href="/admin" className="font-mono text-[11px] uppercase tracking-dateline text-ink hover:text-brick">
          ← The desk
        </Link>
      </header>

      <p className="mt-5 max-w-2xl font-serif text-[1.0625rem] leading-relaxed text-ink-faded">
        Paste-ready Twitter/X + LinkedIn drafts for any edition — generated on demand, with the
        document image, UTM links, hashtags, and posting times. Copy, review, and post manually.
      </p>

      <div className="mt-8">
        <SocialPanel posts={posts} defaultSlug={defaultSlug} />
      </div>
    </div>
  );
}
