"use client";

import { useState } from "react";

interface TimelineTweet {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  favs: number;
}
interface Feed {
  handle: string;
  name: string;
  fit: string;
  tweets: TimelineTweet[];
  error?: "rate_limited" | "unavailable" | "empty";
}
interface ReplyOption {
  text: string;
  note: string;
  link: string | null;
  referencesSlug: string | null;
}
interface SuggestState {
  status: "loading" | "done" | "error";
  options?: ReplyOption[];
  error?: string;
}

const TWEET_LIMIT = 280;

const FEED_ERROR: Record<NonNullable<Feed["error"]>, string> = {
  rate_limited: "X rate-limited this read — wait a minute and reload.",
  unavailable: "Couldn't read this account right now.",
  empty: "No recent original tweets.",
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

function shortDate(s: string): string {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ReplyFeed() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [sugg, setSugg] = useState<Record<string, SuggestState>>({});

  async function load() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/reply-feed?tier=1");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFeeds(json.feeds as Feed[]);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function suggest(t: TimelineTweet, handle: string) {
    setSugg((s) => ({ ...s, [t.id]: { status: "loading" } }));
    try {
      const res = await fetch("/api/admin/reply-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweet: t.text, author: `@${handle}` }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSugg((s) => ({ ...s, [t.id]: { status: "done", options: json.replies as ReplyOption[] } }));
    } catch (e) {
      setSugg((s) => ({ ...s, [t.id]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
    }
  }

  return (
    <section className="mt-14 border-t border-ink pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}>
          Today&rsquo;s Tier 1 tweets
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={status === "loading"}
          className="bg-ink px-5 py-2.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick disabled:opacity-50"
        >
          {status === "loading" ? "Reading…" : status === "done" ? "Reload" : "Load Tier 1 tweets"}
        </button>
      </div>
      <p className="mt-2 font-serif text-[13px] italic leading-relaxed text-ink-light">
        Reads recent tweets from your Tier 1 targets. Pick one worth engaging and hit &ldquo;Draft reply&rdquo; — it writes a value-add reply, matched to a real exhibit when one fits.
      </p>

      {status === "error" && <p className="mt-4 font-mono text-[12px] text-brick">Error: {error}</p>}

      {status === "done" && (
        <div className="mt-6 space-y-8">
          {feeds.map((f) => (
            <div key={f.handle}>
              <div className="flex flex-wrap items-baseline gap-x-3 border-b border-rule pb-1.5">
                <a href={`https://x.com/${f.handle}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] font-semibold text-ink hover:text-brick">
                  @{f.handle}
                </a>
                <span className="font-serif text-[13px] text-ink-faded">{f.name}</span>
              </div>

              {f.error ? (
                <p className="mt-3 font-mono text-[11px] text-ink-light">{FEED_ERROR[f.error]}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {f.tweets.map((t) => {
                    const st = sugg[t.id];
                    return (
                      <li key={t.id} className="border border-rule bg-parchment-light">
                        <p className="whitespace-pre-wrap px-4 pt-3 font-serif text-[15px] leading-relaxed text-ink">{t.text}</p>
                        <div className="flex flex-wrap items-center gap-3 px-4 py-2 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                          {shortDate(t.createdAt) && <span>{shortDate(t.createdAt)}</span>}
                          <span>♥ {t.favs}</span>
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-brick">Open on X →</a>
                          <button
                            type="button"
                            onClick={() => suggest(t, f.handle)}
                            disabled={st?.status === "loading"}
                            className="ml-auto border border-ink px-3 py-1 text-ink transition-colors hover:bg-ink hover:text-parchment disabled:opacity-50"
                          >
                            {st?.status === "loading" ? "Drafting…" : st?.status === "done" ? "Redraft" : "Draft reply"}
                          </button>
                        </div>

                        {st?.status === "error" && <p className="px-4 pb-3 font-mono text-[11px] text-brick">Error: {st.error}</p>}
                        {st?.status === "done" && st.options && (
                          <div className="space-y-2 border-t border-rule px-4 py-3">
                            {st.options.map((r, i) => (
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
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
          <p className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
            Reply with the text only; if it references an exhibit, drop the link in a follow-up. Reads are cached ~10 min and rate-limited by X.
          </p>
        </div>
      )}
    </section>
  );
}
