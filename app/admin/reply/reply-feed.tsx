"use client";

import { useCallback, useEffect, useState } from "react";

interface ReplyOption {
  text: string;
  note: string;
  link: string | null;
  referencesSlug: string | null;
}
interface DigestTweet {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  favs: number;
  replies: ReplyOption[];
}
interface Feed {
  handle: string;
  name: string;
  fit: string;
  error?: "rate_limited" | "unavailable" | "empty";
  tweets: DigestTweet[];
}

const TWEET_LIMIT = 280;

const FEED_ERROR: Record<NonNullable<Feed["error"]>, string> = {
  rate_limited: "X rate-limited this read — the next daily run should catch it.",
  unavailable: "Couldn't read this account on the last run.",
  empty: "No recent original tweets on the last run.",
};

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}
      className="shrink-0 border border-ink px-3 py-1 font-mono text-[10px] uppercase tracking-dateline text-ink transition-colors hover:bg-ink hover:text-parchment"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ReplyFeed() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshNote, setRefreshNote] = useState("");

  const loadStored = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/reply-feed?tier=1");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFeeds(json.feeds as Feed[]);
      setGeneratedAt(json.generatedAt ?? null);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => { void loadStored(); }, [loadStored]);

  async function refreshNow() {
    setRefreshing(true);
    setError("");
    setRefreshNote("");
    try {
      const res = await fetch("/api/admin/reply-refresh?tier=1", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.saved && (json.tweets ?? 0) > 0) {
        setFeeds(json.feeds as Feed[]);
        setGeneratedAt(json.generatedAt ?? null);
        setStatus("ready");
      } else {
        // The server (Vercel) can't read X — datacenter IPs are blocked. Keep the
        // stored digest on screen and tell the user to run the local job.
        setRefreshNote("Couldn't read X from the server (datacenter IPs are blocked). Run `npm run reply-digest` on your machine to refresh — it writes here.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  const hasAny = feeds.some((f) => f.tweets.length > 0);

  return (
    <section className="mt-14 border-t border-ink pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}>
          Today&rsquo;s Tier 1 tweets
        </h2>
        <div className="flex items-center gap-3">
          {generatedAt && <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">Updated {timeAgo(generatedAt)}</span>}
          <button
            type="button"
            onClick={refreshNow}
            disabled={refreshing}
            className="border border-ink px-4 py-2 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>
      <p className="mt-2 font-serif text-[13px] italic leading-relaxed text-ink-light">
        Recent tweets from your Tier 1 targets, each with ready-to-post replies (matched to a real exhibit when one fits). Copy, tweak, post. Refreshed by <code className="not-italic">npm run reply-digest</code> on your machine (X blocks the server from reading tweets).
      </p>

      {status === "error" && <p className="mt-4 font-mono text-[12px] text-brick">Error: {error}</p>}
      {refreshNote && <p className="mt-4 border-l-2 border-brick bg-parchment-light px-4 py-2 font-serif text-[13px] leading-relaxed text-ink-faded">{refreshNote}</p>}
      {status === "loading" && <p className="mt-6 font-serif italic text-ink-faded">Loading today&rsquo;s digest…</p>}

      {status === "ready" && !generatedAt && (
        <p className="mt-6 font-serif italic text-ink-faded">
          No digest yet — run <code className="not-italic text-ink">npm run reply-digest</code> on your machine to pull the first batch.
        </p>
      )}

      {status === "ready" && generatedAt && !hasAny && (
        <p className="mt-6 font-serif italic text-ink-faded">
          The last run couldn&rsquo;t read any tweets. Re-run <code className="not-italic text-ink">npm run reply-digest</code> locally (wait a bit if X rate-limited you).
        </p>
      )}

      {status === "ready" && hasAny && (
        <div className="mt-6 space-y-8">
          {feeds.map((f) => (
            <div key={f.handle}>
              <div className="flex flex-wrap items-baseline gap-x-3 border-b border-rule pb-1.5">
                <a href={`https://x.com/${f.handle}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] font-semibold text-ink hover:text-brick">
                  @{f.handle}
                </a>
                <span className="font-serif text-[13px] text-ink-faded">{f.name}</span>
              </div>

              {f.tweets.length === 0 ? (
                <p className="mt-3 font-mono text-[11px] text-ink-light">{f.error ? FEED_ERROR[f.error] : "No tweets."}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {f.tweets.map((t) => (
                    <li key={t.id} className="border border-rule bg-parchment-light">
                      <p className="whitespace-pre-wrap px-4 pt-3 font-serif text-[15px] leading-relaxed text-ink">{t.text}</p>
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                        <span>♥ {t.favs}</span>
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-brick">Open on X →</a>
                      </div>

                      {t.replies.length > 0 ? (
                        <div className="space-y-2 border-t border-rule px-4 py-3">
                          {t.replies.map((r, i) => (
                            <div key={i} className="border border-rule bg-parchment">
                              <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-1.5">
                                <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Reply {i + 1}{r.note ? ` · ${r.note}` : ""}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-[10px] ${r.text.length > TWEET_LIMIT ? "text-brick" : "text-ink-light"}`}>{r.text.length}/{TWEET_LIMIT}</span>
                                  <Copy text={r.text} />
                                </div>
                              </div>
                              <p className="whitespace-pre-wrap px-3 py-2 font-serif text-[14px] leading-relaxed text-ink">{r.text}</p>
                              {r.link && (
                                <div className="flex items-center gap-2 border-t border-rule px-3 py-1.5">
                                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-dateline text-brick">Ref</span>
                                  <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-faded">{r.link}</code>
                                  <Copy text={r.link} label="Copy link" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="border-t border-rule px-4 py-2 font-mono text-[10px] text-ink-light">No reply drafted for this one.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
            Reply with the text only; if it references an exhibit, drop the link in a follow-up. Auto-refreshes each morning.
          </p>
        </div>
      )}
    </section>
  );
}
