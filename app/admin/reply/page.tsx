import { redirect } from "next/navigation";
import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { ReplyPanel } from "./reply-panel";
import { ReplyFeed } from "./reply-feed";
import { ReplyTargets } from "./reply-targets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reply assistant",
  description: "Sharp, value-add replies for the daily reply game.",
  robots: { index: false, follow: false },
};

export default async function ReplyPage() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) redirect(e.to);
    throw e;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 md:py-20">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-6">
        <div>
          <Dateline strong>Editorial &middot; Distribution</Dateline>
          <h1
            className="mt-2 font-display text-display-3 leading-none tracking-[-0.015em] text-ink"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 30' }}
          >
            Reply assistant
          </h1>
        </div>
        <Link href="/admin/social" className="font-mono text-[11px] uppercase tracking-dateline text-ink hover:text-brick">
          ← Social drafts
        </Link>
      </header>

      <p className="mt-5 max-w-2xl font-serif text-[1.0625rem] leading-relaxed text-ink-faded">
        The reply game is the #1 way to get noticed from zero. Paste a tweet from one of the big
        accounts you follow; get sharp, value-add replies — and where it fits, one that naturally
        references a real exhibit from your archive. Reply as yourself, add value, get seen.
      </p>

      <div className="mt-8">
        <ReplyPanel />
      </div>

      <ReplyFeed />

      <ReplyTargets />
    </div>
  );
}
