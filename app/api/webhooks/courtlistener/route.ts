import { NextResponse } from "next/server";
import { alertHitToSource, type AlertHit } from "@/lib/ingest/alerts";
import { runPipeline } from "@/lib/ingest/pipeline";

// POST /api/webhooks/courtlistener?secret=<CL_WEBHOOK_SECRET>
// Receives CourtListener Search-Alert hits (new RECAP filings matching our
// exec-email fingerprints) and feeds the downloadable ones straight into the
// ingest pipeline. Gated by a shared secret configured on the CourtListener
// webhook. The pipeline's relevance gate is the real quality filter, and its
// dedup guard makes redelivery safe.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CL_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed until configured
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || req.headers.get("x-webhook-secret");
  return provided === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { payload?: { results?: AlertHit[] }; results?: AlertHit[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const hits = body.payload?.results ?? body.results ?? [];
  const sources = hits.map(alertHitToSource).filter((s): s is NonNullable<typeof s> => s != null);
  if (!sources.length) {
    return NextResponse.json({ ok: true, received: hits.length, ingested: 0, note: "no fetchable hits" });
  }

  // Fire-and-report: run the pipeline; the dedup guard skips anything we already have.
  const results = await runPipeline({ sources });
  const ok = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  return NextResponse.json({
    ok: true,
    received: hits.length,
    candidates: sources.length,
    ingested: ok,
    skipped,
    slugs: results.filter((r) => r.ok).map((r) => r.postSlug),
  });
}
