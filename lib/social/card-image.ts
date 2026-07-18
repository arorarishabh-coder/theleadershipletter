import type { Post } from "@/lib/types";
import { buildMessageCardHtml } from "@/lib/social/carousel-pdf";
import { renderHtmlToPng } from "@/lib/pdf/launch";

/**
 * Render the ITE-style transcribed card (buildMessageCardHtml) to a base64 PNG
 * data: URI, or null on failure. This is what the LinkedIn carousel embeds as
 * its document slide — our own clean reproduction of the correspondence rather
 * than the raw source screenshot. Shared by the admin PDF route and the CLI.
 */
export async function renderCardImageDataUri(post: Post): Promise<string | null> {
  try {
    const png = await renderHtmlToPng(buildMessageCardHtml(post));
    return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Render the card to raw PNG bytes (for saving to a hosted file, e.g. public/cards).
 * Unlike the data-URI variant, this throws on failure so callers can log/skip — the
 * newsletter uses a HOSTED card URL (email clients strip data: URIs), so the bytes
 * must be written to disk at ingest/backfill time, not embedded.
 */
export async function renderCardPng(post: Post): Promise<Uint8Array> {
  return renderHtmlToPng(buildMessageCardHtml(post));
}
