// Resolve a pasted X / Twitter status URL into the tweet's text + author, so the
// reply assistant can take a link instead of requiring a hand-pasted excerpt.
//
// X.com blocks server-side scraping, so we resolve through two public read
// mirrors with no auth: FixTweet's API (api.fxtwitter.com) first, then Twitter's
// own syndication CDN (cdn.syndication.twimg.com) as a fallback. Both return
// JSON and neither needs a logged-in token.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ResolvedTweet {
  id: string;
  text: string;
  author: string; // display name when known, else handle
  handle: string; // "@handle" when known
  url: string;
}

const STATUS_RE = /(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|nitter\.[^/]+)\/(?:[^/]+\/)?status(?:es)?\/(\d+)/i;

export function extractTweetId(input: string): string | null {
  const m = input.match(STATUS_RE);
  if (m) return m[1];
  // Bare numeric id pasted on its own.
  const bare = input.trim();
  if (/^\d{8,25}$/.test(bare)) return bare;
  return null;
}

export function looksLikeTweetUrl(input: string): boolean {
  return /https?:\/\//i.test(input) && extractTweetId(input) !== null;
}

// Twitter's syndication endpoint needs a token derived from the status id.
function syndicationToken(id: string): string {
  // Documented client-side derivation used by the embed widget.
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

async function fromFxTwitter(id: string): Promise<ResolvedTweet | null> {
  try {
    const r = await fetch(`https://api.fxtwitter.com/i/status/${id}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      tweet?: { text?: string; author?: { name?: string; screen_name?: string }; url?: string };
    };
    const t = j.tweet;
    const text = (t?.text || "").trim();
    if (!text) return null;
    const handle = t?.author?.screen_name ? `@${t.author.screen_name}` : "";
    return {
      id,
      text,
      author: t?.author?.name || handle || "Unknown",
      handle,
      url: t?.url || `https://x.com/i/status/${id}`,
    };
  } catch {
    return null;
  }
}

async function fromSyndication(id: string): Promise<ResolvedTweet | null> {
  try {
    const token = syndicationToken(id);
    const r = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      text?: string;
      user?: { name?: string; screen_name?: string };
    };
    const text = (j.text || "").trim();
    if (!text) return null;
    const handle = j.user?.screen_name ? `@${j.user.screen_name}` : "";
    return {
      id,
      text,
      author: j.user?.name || handle || "Unknown",
      handle,
      url: `https://x.com/i/status/${id}`,
    };
  } catch {
    return null;
  }
}

// Resolve a status URL (or bare id) to its text. Throws a user-readable error if
// both mirrors fail so the caller can tell the admin to paste the text instead.
export async function resolveTweet(input: string): Promise<ResolvedTweet> {
  const id = extractTweetId(input);
  if (!id) throw new Error("That doesn't look like an X/Twitter status link.");
  const resolved = (await fromFxTwitter(id)) || (await fromSyndication(id));
  if (!resolved) {
    throw new Error(
      "Couldn't read that tweet (it may be deleted, age-gated, or from a protected account). Paste the tweet text instead.",
    );
  }
  return resolved;
}
