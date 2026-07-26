import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";

// POST /api/webhooks/resend
// Receives Resend email events (delivered / opened / clicked / bounced /
// complained) and logs them to EmailEvent so we can compute open/click rates —
// Resend has no aggregate broadcast-stats API, so this per-recipient event log
// is the only way to measure engagement.
//
// Security: Resend signs webhooks with Svix. We verify the signature against
// RESEND_WEBHOOK_SECRET (whsec_...) with no external dependency. Fail closed:
// if the secret is unset or the signature is bad, we reject.
//
// Idempotency: Svix retries redeliver the same svix-id, which we upsert on, so
// replays don't double-count.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOLERANCE_MS = 5 * 60 * 1000; // reject timestamps older/newer than 5 min (replay guard)

/**
 * Verify a Svix (Resend) webhook signature. `secret` is the whsec_… string,
 * `id`/`timestamp` are the svix-id / svix-timestamp headers, `payload` is the
 * RAW request body. `header` is the svix-signature header ("v1,<b64> v1,<b64>").
 */
function verifySvix(secret: string, id: string, timestamp: string, payload: string, header: string): boolean {
  if (!id || !timestamp || !header) return false;

  // Replay guard: svix-timestamp is unix seconds.
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TOLERANCE_MS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

  // The header may carry multiple space-separated "v1,<sig>" versions.
  for (const part of header.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (!sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

interface ResendEvent {
  type?: string; // "email.opened", "email.clicked", ...
  created_at?: string;
  data?: {
    broadcast_id?: string;
    email_id?: string;
    to?: string[] | string;
    created_at?: string;
    click?: { link?: string; timestamp?: string };
  };
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 401 });
  }

  // Read the raw body BEFORE parsing — signature is over the exact bytes.
  const raw = await req.text();
  const ok = verifySvix(
    secret,
    req.headers.get("svix-id") ?? "",
    req.headers.get("svix-timestamp") ?? "",
    raw,
    req.headers.get("svix-signature") ?? "",
  );
  if (!ok) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let evt: ResendEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // "email.opened" -> "opened"
  const type = (evt.type ?? "").replace(/^email\./, "").trim();
  if (!type) return NextResponse.json({ ok: true, ignored: "no type" });

  const data = evt.data ?? {};
  const to = Array.isArray(data.to) ? data.to[0] : data.to;
  const occurredAt = new Date(data.created_at || evt.created_at || Date.now());
  const svixId = req.headers.get("svix-id") ?? undefined;

  try {
    // Upsert on svixId so a redelivered webhook is a no-op (idempotent).
    if (svixId) {
      await db.emailEvent.upsert({
        where: { svixId },
        create: {
          svixId,
          type,
          email: (to ?? "").toLowerCase(),
          broadcastId: data.broadcast_id ?? null,
          emailId: data.email_id ?? null,
          link: data.click?.link ?? null,
          occurredAt,
          raw: evt as object,
        },
        update: {}, // already recorded — nothing to change
      });
    } else {
      await db.emailEvent.create({
        data: {
          type,
          email: (to ?? "").toLowerCase(),
          broadcastId: data.broadcast_id ?? null,
          emailId: data.email_id ?? null,
          link: data.click?.link ?? null,
          occurredAt,
          raw: evt as object,
        },
      });
    }
  } catch (e) {
    // Don't 500 on a DB hiccup — Resend would retry forever. Log and ack.
    console.error("[resend-webhook] persist failed", e);
    return NextResponse.json({ ok: false, error: "persist failed" }, { status: 200 });
  }

  return NextResponse.json({ ok: true, type });
}
