/**
 * Register CourtListener RECAP search alerts from the watchlist fingerprints.
 *
 *   npm run alerts                 # register/sync alerts (needs COURTLISTENER_API_TOKEN)
 *   npm run alerts -- --dry-run    # print the fingerprint queries, register nothing
 *   npm run alerts -- --list       # list existing alerts on the account
 *   npm run alerts -- --rate=wly   # cadence: rt|dy|wly|mly (default dy)
 *
 * See lib/ingest/alerts.ts for the one-time webhook setup on courtlistener.com.
 */
import "dotenv/config";
import { buildFingerprints, registerAlerts } from "@/lib/ingest/alerts";
import { listSearchAlerts, deleteSearchAlert, type AlertRate } from "@/lib/ingest/courtlistener";

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const list = argv.includes("--list");
  const rate = (argv.find((a) => a.startsWith("--rate="))?.split("=")[1] as AlertRate) || "dly";
  const only = argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const del = argv.find((a) => a.startsWith("--delete="))?.split("=")[1];

  if (del) {
    await deleteSearchAlert(parseInt(del, 10));
    console.log(`Deleted alert ${del}.`);
    return;
  }

  if (list) {
    const alerts = await listSearchAlerts();
    console.log(`\n=== ${alerts.length} existing CourtListener alert(s) ===`);
    for (const a of alerts) console.log(`  [${a.id}] ${a.rate}  ${a.name}`);
    return;
  }

  const fps = buildFingerprints();
  console.log(`\n=== ${fps.length} company fingerprint(s) from the watchlist ===`);
  for (const fp of fps) console.log(`  ${fp.name}\n    ${decodeURIComponent(fp.query)}`);

  if (dryRun) {
    console.log("\n(--dry-run — nothing registered)");
    return;
  }
  if (!process.env.COURTLISTENER_API_TOKEN && !process.env.COURTLISTENER_TOKEN) {
    console.error("\nCOURTLISTENER_API_TOKEN required to register alerts. Use --dry-run to preview.");
    process.exit(1);
  }

  console.log(`\n=== Registering alerts (rate=${rate}${only ? `, only="${only}"` : ""}) ===`);
  const out = await registerAlerts(rate, { only });
  for (const r of out) {
    if (!r.ok) console.log(`  ✗ FAILED    ${r.name} — ${r.error}`);
    else console.log(`  ${r.created ? "＋ created" : "· exists "}  [${r.id}] ${r.name}`);
  }
  const created = out.filter((r) => r.ok && r.created).length;
  const existed = out.filter((r) => r.ok && !r.created).length;
  const failed = out.filter((r) => !r.ok);
  console.log(`\nDone: ${created} created, ${existed} already existed, ${failed.length} failed.`);
  if (failed.length) console.log(`Failed alerts are usually "too broad" — CourtListener caps alert volume; narrow the fingerprint or scope it to specific dockets.`);
}

main().catch((e) => {
  console.error("alerts crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
