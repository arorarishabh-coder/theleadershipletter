/**
 * Ingestion CLI.
 *
 * Usage:
 *   npm run ingest -- --dry-run                  # fetch + preview, no Claude calls
 *   npm run ingest                                # full live run on all registry docs
 *   npm run ingest -- --limit=3                   # first 3 documents only
 *   npm run ingest -- --only=bezos-2014-failure,dimon-2008-financial-crisis
 *
 * Requires ANTHROPIC_API_KEY in env unless --dry-run.
 */

import "dotenv/config";
import { runPipeline } from "@/lib/ingest/pipeline";

function parseArgs(): { dryRun: boolean; limit?: number; onlyIds?: string[] } {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : undefined;
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const onlyIds = onlyArg ? onlyArg.split("=")[1]!.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return { dryRun, limit, onlyIds };
}

async function main() {
  const opts = parseArgs();

  if (!opts.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("\nMissing ANTHROPIC_API_KEY in environment.");
    console.error("Either set it in .env and re-run, or pass --dry-run to preview without Claude calls.\n");
    process.exit(1);
  }

  const results = await runPipeline(opts);
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error("Ingestion crashed:", e);
  process.exit(1);
});
