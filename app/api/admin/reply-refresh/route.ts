import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { refreshTierDigest } from "@/lib/social/reply-digest";

// POST /api/admin/reply-refresh?tier=1
// Admin-only. Rebuilds the reply digest now — reads the tier's targets and drafts
// replies — and returns it. This is what the "Refresh now" button calls; the cron
// runs the same refresh once a day. Reads X's rate-limited endpoint, so don't spam.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Admin session, OR a matching ?secret= (the shared admin-probe secret) so the
  // refresh can be triggered/verified against prod without a browser session.
  const secret = new URL(req.url).searchParams.get("secret");
  const probe = process.env.CHROMIUM_PROBE_SECRET;
  if (!(probe && secret === probe)) {
    try {
      await requireAdmin();
    } catch (e) {
      if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      throw e;
    }
  }

  const tier = Math.max(1, Number(new URL(req.url).searchParams.get("tier")) || 1);
  try {
    const { generatedAt, data, saved, tweets } = await refreshTierDigest(tier);
    return NextResponse.json({ ok: true, generatedAt, feeds: data.feeds, saved, tweets });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
