import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/site";

// Favicon — generated "CL" monogram. Next wires this to <link rel="icon">.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
// Generated at runtime (avoids an @vercel/og build-time prerender quirk on some
// platforms); CDN-cached after first request.
export const dynamic = "force-dynamic";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.ink,
          color: BRAND.parchment,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        CL
      </div>
    ),
    { ...size },
  );
}
