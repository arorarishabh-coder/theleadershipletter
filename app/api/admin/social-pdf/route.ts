import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getPostBySlug } from "@/lib/queries";
import { buildCarouselHtml } from "@/lib/social/carousel-pdf";
import { renderCardImageDataUri } from "@/lib/social/card-image";
import { generateSocialDrafts } from "@/lib/social/draft";
import { renderHtmlToPdf } from "@/lib/pdf/launch";

// POST /api/admin/social-pdf   { slug, slides? }
// Admin-only. Renders the branded LinkedIn "document" (carousel) PDF for a post
// and streams it back as a download. The document slide is the ITE-style
// transcribed CARD (our own reproduction), not the raw source screenshot. If the
// client passes the slides it already generated (the "Generate drafts" flow), we
// render those verbatim with no Claude call so the PDF matches the panel preview.
// If slides are omitted (the one-click top-bar button), we generate the carousel
// drafts on the fly so the PDF works without a prior "Generate drafts" step.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  let body: { slug?: string; slides?: string[]; imageUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { slug } = body;
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });
  const post = getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });

  // Use client-supplied slides when present (fast, matches the panel preview);
  // otherwise generate the carousel drafts on the fly (one-click top-bar button).
  let slides = body.slides;
  if (!Array.isArray(slides) || slides.length === 0) {
    try {
      const pkg = await generateSocialDrafts(post);
      slides = pkg.linkedinCarousel.slides;
    } catch (e) {
      return NextResponse.json({ error: `could not generate drafts: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
    }
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json({ error: "no carousel slides available for this post" }, { status: 502 });
  }

  try {
    // Document slide = the ITE-style transcribed card, not the raw screenshot.
    const imageDataUri = await renderCardImageDataUri(post);
    const html = buildCarouselHtml(post, slides, imageDataUri);
    const pdf = await renderHtmlToPdf(html);
    return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
