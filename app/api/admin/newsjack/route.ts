import { NextResponse } from "next/server";
import { requireAdmin, AdminRedirect } from "@/lib/admin";
import { getAllPosts } from "@/lib/queries";
import { matchNewsjack } from "@/lib/social/newsjack";

// GET /api/admin/newsjack?q=<headline or company/person in the news>
// Admin-only. Ranks archive posts that are "the receipt" for a news item.
// Deterministic keyword match — no Claude call, cheap enough to run per keystroke
// (debounced client-side).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRedirect) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ ok: true, matches: [] });

  const matches = matchNewsjack(q, getAllPosts(), 8);
  return NextResponse.json({ ok: true, matches });
}
