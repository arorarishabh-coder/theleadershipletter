import "dotenv/config";
import { getAllPosts } from "@/lib/queries";
import { listPublishedIdentities, isPublished } from "@/lib/publish/resend";
async function main() {
  const published = await listPublishedIdentities();
  const all = getAllPosts();
  const unsent = all
    .filter((p) => !isPublished(p, published))
    .sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""));
  console.log(`total posts in corpus : ${all.length}`);
  console.log(`already broadcast     : ${all.length - unsent.length}`);
  console.log(`buffer remaining      : ${unsent.length}  (~${unsent.length} days at 1/day)`);
  console.log(`\nnext 5 to send (oldest publishedAt first):`);
  for (const p of unsent.slice(0, 5)) console.log(`  ${p.publishedAt}  ${p.slug}  — ${p.title.slice(0,50)}`);
  console.log(`\nestimated buffer-exhaustion date: ~${new Date(Date.now() + unsent.length*864e5).toISOString().slice(0,10)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
