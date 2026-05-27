/**
 * Send a single rendered newsletter to yourself, to preview how a post looks in
 * an inbox. Uses Resend's transactional /emails endpoint (allowed from
 * onboarding@resend.dev — unlike Broadcasts, which need a verified domain).
 *
 *   npm run test-email -- --to=you@example.com [--slug=<slug>]
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildEmailDocument } from "@/lib/publish/resend";
import type { Post } from "@/lib/types";

const CONTENT = path.join(process.cwd(), "content", "posts");

async function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  const to = val("to");
  if (!to) {
    console.error("Provide --to=<email>");
    process.exit(1);
  }

  let slug = val("slug");
  if (!slug) {
    const files = (await fs.readdir(CONTENT)).filter((f) => f.endsWith(".json"));
    const posts: Post[] = [];
    for (const f of files) {
      try {
        posts.push(JSON.parse(await fs.readFile(path.join(CONTENT, f), "utf8")) as Post);
      } catch {
        /* skip */
      }
    }
    slug = posts.sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""))[0]?.slug;
  }
  const post = JSON.parse(await fs.readFile(path.join(CONTENT, `${slug}.json`), "utf8")) as Post;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "The Leadership Letter <onboarding@resend.dev>",
      to: [to],
      subject: `[Preview] ${post.title}`,
      html: buildEmailDocument(post, process.env.SITE_URL || ""),
    }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(res.status, JSON.stringify(json));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
