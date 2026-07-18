import { promises as fs } from "node:fs";
import path from "node:path";
import type { Post } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content", "posts");

export async function savePost(post: Post): Promise<string> {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DIR, `${post.slug}.json`);
  await fs.writeFile(filePath, JSON.stringify(post, null, 2), "utf8");
  return filePath;
}

export async function listSavedPosts(): Promise<string[]> {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files.filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

const CARDS_DIR = path.join(process.cwd(), "public", "cards");

/** Write a recreated card PNG to public/cards/{slug}.png and return its hosted path. */
export async function saveCardImage(slug: string, png: Uint8Array): Promise<string> {
  await fs.mkdir(CARDS_DIR, { recursive: true });
  await fs.writeFile(path.join(CARDS_DIR, `${slug}.png`), png);
  return `/cards/${slug}.png`;
}

export async function loadAllSavedPosts(): Promise<Post[]> {
  const files = await listSavedPosts();
  const posts: Post[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(CONTENT_DIR, f), "utf8");
      posts.push(JSON.parse(raw) as Post);
    } catch {
      // skip malformed
    }
  }
  return posts;
}
