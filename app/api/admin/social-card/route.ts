import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getPostBySlug } from "@/lib/queries";
import { buildMessageCardHtml } from "@/lib/social/carousel-pdf";
import { renderHtmlToPng } from "@/lib/pdf/launch";

// GET /api/admin/social-card?slug=<slug>
// Admin-only. Renders the ITE-style transcribed card (chat bubbles for a message
// thread, else From/To/Subject + body for an email) as a PNG to attach to a
// LinkedIn/Twitter post — cleaner than the raw document screenshot.

export const runtime = "nodejs";
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
    const png = await renderHtmlToPng(buildMessageCardHtml(post));
    return new NextResponse(new Blob([png], { type: "image/png" }), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${slug}-card.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
