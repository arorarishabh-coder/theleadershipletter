import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getPostBySlug } from "@/lib/queries";
import { buildCarouselHtml } from "@/lib/social/carousel-pdf";
import { renderHtmlToPdf } from "@/lib/pdf/launch";

// POST /api/admin/social-pdf   { slug, slides, imageUrl? }
// Admin-only. Renders the branded LinkedIn "document" (carousel) PDF for a post
// from ALREADY-generated drafts (no Claude call here), and streams it back as a
// download. The client passes the slides it already generated + the source-
// document image URL so the PDF matches exactly what the panel previews.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fetch an image URL and return it as a base64 data: URI, or null on failure. */
async function toDataUri(url: string | null | undefined, origin: string): Promise<string | null> {
  if (!url) return null;
  try {
    const abs = url.startsWith("http") ? url : new URL(url, origin).toString();
    const res = await fetch(abs);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

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

  const { slug, slides, imageUrl } = body;
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json({ error: "missing slides — generate drafts first" }, { status: 400 });
  }
  const post = getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });

  try {
    const imageDataUri = await toDataUri(imageUrl, new URL(req.url).origin);
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
