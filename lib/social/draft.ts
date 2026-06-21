// Social-draft generation. Turns a Post into paste-ready Twitter/X + LinkedIn
// content (via Claude) plus the deterministic extras a human needs to post
// effectively: the document image URL, alt text, UTM-tagged article links, and
// suggested posting times. No posting happens here — drafts are for copy-paste.

import type { Post } from "@/lib/types";
import { claude, MODELS } from "@/lib/anthropic";
import { SOCIAL_PROMPT } from "@/lib/prompts/social";
import { SITE } from "@/lib/site";

export interface SocialDrafts {
  twitterThread: string[];
  twitterSingle: string;
  linkedinPost: string;
  linkedinCarousel: { slides: string[] };
  carouselTitle: string; // <=58 chars — the LinkedIn document title
  hashtags: { twitter: string[]; linkedin: string[] };
}

export interface SocialPackage extends SocialDrafts {
  slug: string;
  title: string;
  imageUrl: string | null; // the real source-document screenshot (the scroll-stopper)
  imageAlt: string;
  links: { twitter: string; linkedin: string }; // UTM-tagged article links to append to the CTA
  postingTimes: { twitter: string; linkedin: string };
  sourceUrl: string;
}

function safeJSON<T>(raw: string): T | null {
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

export async function generateSocialDrafts(post: Post): Promise<SocialPackage> {
  const prompt = SOCIAL_PROMPT({
    title: post.title,
    authors: post.authorsName.join(" & "),
    company: post.authorsCompany,
    dateAuthored: post.dateAuthored,
    sourceCase: post.sourceCase,
    situation: post.situation ?? "",
    insight: post.insight ?? "",
    application: post.application ?? "",
    pullQuote: post.pullQuote,
  });

  const res = await claude.messages.create({
    model: MODELS.lesson,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text : "";
  const drafts = safeJSON<SocialDrafts>(text);
  if (!drafts || !Array.isArray(drafts.twitterThread) || !drafts.linkedinPost) {
    throw new Error("Failed to parse social drafts JSON");
  }

  const base = SITE.url.replace(/\/$/, "");
  const shot = post.screenshots?.[0];
  const imageUrl = shot && !shot.url.includes("_pending") ? `${base}${shot.url}` : null;
  const link = (src: string, medium: string) =>
    `${base}/post/${post.slug}?utm_source=${src}&utm_medium=${medium}&utm_campaign=${encodeURIComponent(post.slug)}`;

  return {
    twitterThread: drafts.twitterThread,
    twitterSingle: drafts.twitterSingle,
    linkedinPost: drafts.linkedinPost,
    linkedinCarousel: drafts.linkedinCarousel ?? { slides: [] },
    carouselTitle: (drafts.carouselTitle || post.title).trim(),
    hashtags: drafts.hashtags ?? { twitter: [], linkedin: [] },
    slug: post.slug,
    title: post.title,
    imageUrl,
    imageAlt: shot?.alt ?? post.title,
    links: { twitter: link("twitter", "thread"), linkedin: link("linkedin", "post") },
    postingTimes: { twitter: "Tue–Thu, 9:00 AM ET", linkedin: "Tue–Wed, 8:00 AM ET" },
    sourceUrl: post.sourceUrl,
  };
}
