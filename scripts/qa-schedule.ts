/**
 * QA: simulate the daily newsletter send-order and report publisher variety.
 *
 * Uses the REAL scheduler (lib/publish/schedule.ts), the REAL corpus, and the
 * REAL Resend send history, then plays forward the next N days to prove editions
 * interleave publishers instead of sending one company's whole block in a row.
 *
 *   npm run qa:schedule            # next 20 sends
 *   npm run qa:schedule -- --days=40
 */
import "dotenv/config";
import { getAllPosts } from "@/lib/queries";
import { isPublished, listBroadcastsByName, listPublishedIdentities } from "@/lib/publish/resend";
import { selectNextForVariety, sourceGroupKey } from "@/lib/publish/schedule";

const daysArg = process.argv.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? parseInt(daysArg.split("=")[1], 10) : 20;

const label = (g: string) => g.replace(/^co:/, "").replace(/^case:/, "");

async function main() {
  const allPosts = getAllPosts();
  const published = await listPublishedIdentities();
  const unsent = allPosts.filter((p) => !isPublished(p, published));

  const broadcasts = await listBroadcastsByName();
  const bySlug = new Map(allPosts.map((p) => [p.slug.toLowerCase(), p]));
  const lastSentByGroup = new Map<string, string>();
  for (const [slug, info] of broadcasts) {
    if (!info.sentAt) continue;
    const post = bySlug.get(slug);
    if (!post) continue;
    const g = sourceGroupKey(post);
    if (info.sentAt > (lastSentByGroup.get(g) ?? "")) lastSentByGroup.set(g, info.sentAt);
  }

  console.log(`\n=== Send-order simulation · next ${DAYS} editions ===`);
  console.log(`Buffer: ${unsent.length} unsent posts\n`);

  const pool = unsent.slice();
  const sequence: string[] = [];
  let maxStreak = 0;
  let curStreak = 0;
  let prevGroup = "";

  for (let day = 0; day < DAYS && pool.length; day++) {
    const next = selectNextForVariety(pool, lastSentByGroup);
    if (!next) break;
    const g = sourceGroupKey(next);
    sequence.push(g);
    curStreak = g === prevGroup ? curStreak + 1 : 1;
    maxStreak = Math.max(maxStreak, curStreak);
    prevGroup = g;

    // mark this publisher as just-emailed with a synthetic increasing date so
    // the next iteration treats it as most-recently-sent (mirrors production).
    const stamp = `9999-${String(day + 1).padStart(4, "0")}`;
    lastSentByGroup.set(g, stamp);
    pool.splice(pool.indexOf(next), 1);

    console.log(`Day ${String(day + 1).padStart(2)}  ${label(g).padEnd(28)} ${next.slug}`);
  }

  const distinct = new Set(sequence).size;
  console.log(`\nDistinct publishers in the run: ${distinct}`);
  console.log(`Longest same-publisher streak: ${maxStreak}`);
  if (maxStreak <= 2) console.log("✓ PASS — no publisher runs more than 2 editions in a row.");
  else console.log(`✗ FAIL — a publisher runs ${maxStreak} editions in a row.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
