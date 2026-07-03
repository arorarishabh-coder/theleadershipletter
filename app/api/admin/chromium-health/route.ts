import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { renderHtmlToPng } from "@/lib/pdf/launch";

// GET /api/admin/chromium-health
//
// The missing QA step: actually LAUNCH the serverless headless browser and
// render a trivial PNG, reporting whether the @sparticuz/chromium binary + its
// shared libraries (libnss3.so etc.) load in the real Vercel runtime. This can
// never be reproduced locally (launch.ts uses installed Chrome off-Vercel), so
// it must be exercised on a live deploy. The card/PDF routes depend on the exact
// same launch path, so a green probe here means those work too.
//
// Gating: open on PREVIEW deploys (so it can be probed headlessly before a fix
// reaches prod) and when a matching ?secret= is supplied; admin-only otherwise.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const probeSecret = process.env.CHROMIUM_PROBE_SECRET;
  const isPreview = process.env.VERCEL_ENV === "preview";
  const secretOk = !!probeSecret && secret === probeSecret;

  if (!isPreview && !secretOk) {
    try {
      await requireAdmin();
    } catch (e) {
      if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      throw e;
    }
  }

  const started = Date.now();
  try {
    const png = await renderHtmlToPng(
      `<html><body style="margin:0"><div style="width:200px;height:80px;background:#111;color:#fff;font:16px sans-serif;display:flex;align-items:center;justify-content:center">chromium ok</div></body></html>`,
      200,
    );
    return NextResponse.json({
      ok: true,
      ms: Date.now() - started,
      pngBytes: png.byteLength,
      node: process.version,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - started,
        node: process.version,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}
