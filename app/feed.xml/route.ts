import { getAllPosts } from "@/lib/queries";
import { buildPostHtml } from "@/lib/publish/beehiiv";

// RSS 2.0 feed. This is the plan-agnostic delivery path: Beehiiv's RSS-import
// automation (and Zapier, Mailchimp, or any reader) can poll this to create/send
// the daily issue — no Enterprise "Create Post" API required. <content:encoded>
// carries the full post HTML so the email body is complete.

export const dynamic = "force-static";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const site = (process.env.SITE_URL || "https://corporate-letters.vercel.app").replace(/\/$/, "");
  const posts = getAllPosts().slice(0, 50);

  const items = posts
    .map((p) => {
      const url = `${site}/post/${p.slug}`;
      const pubDate = new Date(`${p.dateAuthored || p.publishedAt}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(p.pullQuote)}</description>
      <content:encoded><![CDATA[${buildPostHtml(p, site)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Leadership Letter</title>
    <link>${site}</link>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Real internal corporate correspondence, paired with a practical management lesson for founders and operators.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
