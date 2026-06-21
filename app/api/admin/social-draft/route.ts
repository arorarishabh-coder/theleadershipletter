import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getPostBySlug } from "@/lib/queries";
import { generateSocialDrafts } from "@/lib/social/draft";

// GET /api/admin/social-draft?slug=<slug>
// Admin-only. Generates paste-ready Twitter/LinkedIn drafts for a post (Claude).
// On-demand (called from the /admin/social "Generate" button), so cost is per
// click, not per page load.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });
  const post = getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });

  try {
    const drafts = await generateSocialDrafts(post);
    return NextResponse.json({ ok: true, drafts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
