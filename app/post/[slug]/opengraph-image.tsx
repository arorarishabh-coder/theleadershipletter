import { ImageResponse } from "next/og";
import { BRAND, SITE } from "@/lib/site";
import { getPostBySlug } from "@/lib/queries";

// Per-post social-share card: the headline + byline on the masthead, so a shared
// link previews as the actual letter rather than a generic banner.
export const alt = "The Leadership Letter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Generated at runtime (Vercel) per post, then CDN-cached — sidesteps a
// build-time @vercel/og asset-path quirk. The post lookup reads the content
// store, which is bundled into this route via next.config outputFileTracingIncludes.
export const dynamic = "force-dynamic";

export default function PostOgImage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  const title = post?.title ?? SITE.name;
  const byline = post ? [post.authorsName.join(" & "), post.authorsCompany].filter(Boolean).join(" · ") : SITE.tagline;
  // Keep very long titles from overflowing the card.
  const fontSize = title.length > 70 ? 56 : title.length > 44 ? 68 : 82;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND.parchment,
          color: BRAND.ink,
          padding: "76px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 24, letterSpacing: 6, color: BRAND.inkFaded, textTransform: "uppercase" }}>
          {SITE.name}
          <div style={{ width: 8, height: 8, borderRadius: 8, background: BRAND.brick, margin: "0 16px" }} />
          The Daily Edition
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 110, height: 7, background: BRAND.brick, marginBottom: 28 }} />
          <div style={{ fontSize, fontWeight: 700, lineHeight: 1.04, maxWidth: 1040 }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: 30, color: BRAND.inkFaded, fontFamily: "monospace", letterSpacing: 1 }}>
          {byline}
        </div>
      </div>
    ),
    { ...size },
  );
}
