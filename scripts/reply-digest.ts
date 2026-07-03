/**
 * Build the daily reply digest FROM A RESIDENTIAL IP and store it.
 *
 * X's public timeline endpoint (syndication) serves residential IPs but blocks/
 * hard-rate-limits datacenter IPs — so the Vercel cron can't read tweets, but
 * your machine can. Run this once a day (manually, or via Windows Task Scheduler
 * / the /schedule skill); it fetches each Tier-1 target's recent tweets, drafts
 * replies with Claude, and writes the snapshot to the same Postgres the prod
 * /admin/reply page reads. So the page shows fresh, ready-to-post replies.
 *
 *   npm run reply-digest
 *
 * Needs .env: DATABASE_URL (prod Neon), ANTHROPIC_API_KEY. Don't run it in a
 * tight loop — a handful of daily hits is fine; hammering trips the rate limit.
 */
import "dotenv/config";
import { refreshTierDigest } from "@/lib/social/reply-digest";

async function main() {
  const tier = 1;
  console.log(`Building reply digest for Tier ${tier}…`);
  const { generatedAt, data } = await refreshTierDigest(tier);

  let tweets = 0;
  let replies = 0;
  let throttled = 0;
  for (const f of data.feeds) {
    tweets += f.tweets.length;
    replies += f.tweets.reduce((n, t) => n + t.replies.length, 0);
    if (f.error === "rate_limited") throttled++;
    const tag = f.error ? ` [${f.error}]` : "";
    console.log(`  @${f.handle} — ${f.tweets.length} tweets, ${f.tweets.reduce((n, t) => n + t.replies.length, 0)} replies${tag}`);
  }

  console.log(`\nStored snapshot @ ${generatedAt}: ${tweets} tweets, ${replies} replies.`);
  if (tweets === 0) {
    console.log(
      throttled === data.feeds.length
        ? "All handles were rate-limited. You've likely hit the endpoint too often — wait ~15–30 min and re-run."
        : "No tweets found. Check the handles in lib/social/reply-targets.ts still resolve.",
    );
    process.exitCode = 1;
  } else {
    console.log("Open /admin/reply to see them.");
  }
}

main().catch((e) => {
  console.error("ERR:", e?.message || e);
  process.exit(1);
});
