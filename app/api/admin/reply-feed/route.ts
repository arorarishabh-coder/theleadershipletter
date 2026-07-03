import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { loadLatestDigest } from "@/lib/social/reply-digest";

// GET /api/admin/reply-feed?tier=1
// Admin-only. Returns the latest STORED reply digest (recent Tier-1 tweets with
// pre-drafted replies) — no live X fetch, so it's instant and never rate-limited.
// The snapshot is refreshed daily by the cron, or on demand via /reply-refresh.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  const tier = Math.max(1, Number(new URL(req.url).searchParams.get("tier")) || 1);
  const latest = await loadLatestDigest(tier);
  if (!latest) {
    return NextResponse.json({ ok: true, generatedAt: null, feeds: [] });
  }
  return NextResponse.json({ ok: true, generatedAt: latest.generatedAt, feeds: latest.data.feeds });
}
