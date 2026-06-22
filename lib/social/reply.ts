// Reply-assistant generation. Given a tweet, suggest value-add replies for the
// daily reply game, matched (when relevant) to a real exhibit in the archive.

import { claude, MODELS } from "@/lib/anthropic";
import { getAllPosts } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { REPLY_PROMPT, type ReplyArchiveItem } from "@/lib/prompts/reply";

export interface ReplyOption {
  text: string;
  referencesSlug: string | null;
  note: string;
  link: string | null; // UTM-tagged article link for the referenced exhibit, if any
}

function safeJSON<T>(raw: string): T | null {
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

function archiveIndex(): ReplyArchiveItem[] {
  return getAllPosts().map((p) => ({
    slug: p.slug,
    title: p.title,
    company: p.authorsCompany,
    who: p.authorsName.join(", "),
    gist: p.pullQuote,
  }));
}

export async function suggestReplies(tweet: string, author = "", angle = ""): Promise<ReplyOption[]> {
  const prompt = REPLY_PROMPT(tweet.trim(), author.trim(), angle.trim(), archiveIndex());
  const res = await claude.messages.create({
    model: MODELS.lesson,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text : "";
  const parsed = safeJSON<{ replies: { text: string; referencesSlug: string | null; note: string }[] }>(text);
  if (!parsed?.replies?.length) throw new Error("Failed to parse reply suggestions");

  const base = SITE.url.replace(/\/$/, "");
  const valid = new Set(getAllPosts().map((p) => p.slug));
  return parsed.replies.map((r) => {
    const slug = r.referencesSlug && valid.has(r.referencesSlug) ? r.referencesSlug : null;
    return {
      text: r.text,
      referencesSlug: slug,
      note: r.note || "",
      link: slug ? `${base}/post/${slug}?utm_source=twitter&utm_medium=reply&utm_campaign=${encodeURIComponent(slug)}` : null,
    };
  });
}
