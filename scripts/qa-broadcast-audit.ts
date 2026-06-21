import "dotenv/config";
async function main() {
  const key = process.env.RESEND_API_KEY!;
  const res = await fetch("https://api.resend.com/broadcasts", { headers: { Authorization: `Bearer ${key}` } });
  const json = await res.json() as { data?: Array<{ id: string; name?: string; status: string; sent_at?: string|null; scheduled_at?: string|null; created_at?: string }> };
  const all = (json.data ?? []).slice().sort((a,b) => (b.created_at||"").localeCompare(a.created_at||""));
  console.log(`total broadcasts: ${all.length}`);
  const byStatus: Record<string, number> = {};
  for (const b of all) byStatus[b.status] = (byStatus[b.status]||0)+1;
  console.log("by status:", JSON.stringify(byStatus));
  const sent = all.filter(b => b.sent_at).sort((a,b)=>(b.sent_at!).localeCompare(a.sent_at!));
  console.log(`\nlast 8 SENT broadcasts (most recent first):`);
  for (const b of sent.slice(0,8)) console.log(`  ${b.sent_at}  ${b.status.padEnd(8)} ${b.name}`);
  console.log(`\nlast 12 CREATED broadcasts (most recent first):`);
  for (const b of all.slice(0,12)) console.log(`  created ${b.created_at}  status=${b.status.padEnd(8)} sent_at=${b.sent_at ?? "—"}  ${b.name}`);
}
main().catch(e => { console.error(e); process.exit(1); });
