import { ImageResponse } from "next/og";
import { BRAND, SITE } from "@/lib/site";

// Default social-share card (Open Graph + Twitter) for any page without its own.
export const alt = "The Leadership Letter — real corporate correspondence, paired with the lesson it teaches.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Generated at runtime (Vercel), CDN-cached — sidesteps a build-time @vercel/og
// asset-path quirk while keeping the card fully dynamic.
export const dynamic = "force-dynamic";

export default function OpengraphImage() {
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
          padding: "84px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: BRAND.inkFaded, textTransform: "uppercase" }}>
            The Daily Edition
          </div>
          <div style={{ fontSize: 104, fontWeight: 700, marginTop: 16, lineHeight: 1.02 }}>
            {SITE.name}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 132, height: 8, background: BRAND.brick }} />
          <div style={{ fontSize: 34, marginTop: 28, color: BRAND.inkFaded, maxWidth: 940, lineHeight: 1.3 }}>
            {SITE.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
