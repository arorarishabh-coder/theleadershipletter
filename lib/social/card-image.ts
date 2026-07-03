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
