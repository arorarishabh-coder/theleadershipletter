"use client";

import { useState } from "react";

interface ReplyOption {
  text: string;
  referencesSlug: string | null;
  note: string;
  link: string | null;
}

const TWEET_LIMIT = 280;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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

export function ReplyPanel() {
  const [tweet, setTweet] = useState("");
  const [author, setAuthor] = useState("");
  const [angle, setAngle] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<ReplyOption[]>([]);

  async function go() {
    if (tweet.trim().length < 5) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/reply-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweet, author, angle }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setReplies(json.replies as ReplyOption[]);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div>
      <div className="space-y-4 border-y border-ink py-5">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Paste the tweet you want to reply to</span>
          <textarea
            value={tweet}
            onChange={(e) => setTweet(e.target.value)}
            rows={4}
            placeholder="Paste the tweet text here…"
            className="mt-1 block w-full border border-ink bg-parchment-light px-3 py-2.5 font-serif text-[15px] leading-relaxed text-ink focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex-1 min-w-[200px]">
            <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Author (optional)</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="@TrungTPhan" className="mt-1 block w-full border border-ink bg-parchment-light px-3 py-2 font-serif text-[15px] text-ink focus:outline-none" />
          </label>
          <label className="flex-[2] min-w-[240px]">
            <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Your angle (optional)</span>
            <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="e.g. tie to distribution moats" className="mt-1 block w-full border border-ink bg-parchment-light px-3 py-2 font-serif text-[15px] text-ink focus:outline-none" />
          </label>
        </div>
        <button
          type="button"
          onClick={go}
          disabled={status === "loading" || tweet.trim().length < 5}
          className="bg-ink px-6 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick disabled:opacity-50"
        >
          {status === "loading" ? "Thinking…" : status === "done" ? "Suggest again" : "Suggest replies"}
        </button>
      </div>

      {status === "error" && <p className="mt-4 font-mono text-[12px] text-brick">Error: {error}</p>}

      {replies.length > 0 && status !== "loading" && (
        <div className="mt-8 space-y-4">
          {replies.map((r, i) => (
            <div key={i} className="border border-rule bg-parchment-light">
              <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
                <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Option {i + 1}{r.note ? ` · ${r.note}` : ""}</span>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-[10px] ${r.text.length > TWEET_LIMIT ? "text-brick" : "text-ink-light"}`}>{r.text.length}/{TWEET_LIMIT}</span>
                  <CopyButton text={r.text} />
                </div>
              </div>
              <p className="whitespace-pre-wrap px-4 py-3 font-serif text-[15px] leading-relaxed text-ink">{r.text}</p>
              {r.link && (
                <div className="flex items-center gap-3 border-t border-rule px-4 py-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-dateline text-brick">References</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-faded">{r.link}</code>
                  <CopyButton text={r.link} label="Copy link" />
                </div>
              )}
            </div>
          ))}
          <p className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
            Reply with the text only. If it references an exhibit, drop the link in a follow-up reply if someone asks.
          </p>
        </div>
      )}
    </div>
  );
}
