"use client";

import { useEffect, useRef, useState } from "react";

interface Match {
  slug: string;
  title: string;
  authorsCompany: string;
  authorsName: string[];
  dateAuthored: string;
  score: number;
  matchedOn: string[];
  tweet: string;
  replyText: string;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="shrink-0 border border-ink px-3 py-1 font-mono text-[10px] uppercase tracking-dateline text-ink transition-colors hover:bg-ink hover:text-parchment"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/**
 * Newsjacking search: paste a headline (or a company / person in the news) and
 * get the archive emails that are "the receipt", each with a ready artifact-first
 * caption + first-reply text. Debounced; hits /api/admin/newsjack.
 */
export function NewsjackBox() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 3) {
      setMatches([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/newsjack?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setMatches(json.ok ? (json.matches as Match[]) : []);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <section className="border border-ink bg-parchment-deep/30 p-5">
      <div className="font-mono text-[11px] uppercase tracking-dateline text-brick">
        Newsjack · what&rsquo;s in the news?
      </div>
      <p className="mt-2 font-serif text-[14px] leading-relaxed text-ink-faded">
        Paste a headline, company, or person in the news. Get the archive email that&rsquo;s the receipt —
        reply to the news thread with &ldquo;here&rsquo;s the actual email&rdquo; + the card image.
      </p>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. OpenAI Musk lawsuit · Google antitrust ruling · Apple App Store fees"
        className="mt-4 block w-full border border-ink bg-parchment-light px-3 py-2.5 font-serif text-[15px] text-ink focus:outline-none"
      />

      {loading && <p className="mt-3 font-mono text-[11px] uppercase tracking-dateline text-ink-light">Searching…</p>}
      {!loading && searched && matches.length === 0 && (
        <p className="mt-3 font-serif italic text-ink-faded">No archive match — try the company or person&rsquo;s name.</p>
      )}

      {matches.length > 0 && (
        <div className="mt-4 space-y-3">
          {matches.map((m) => (
            <div key={m.slug} className="border border-rule bg-parchment-light">
              <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
                <div className="min-w-0">
                  <a href={`/post/${m.slug}`} target="_blank" rel="noopener noreferrer" className="block truncate font-serif text-[14px] text-ink hover:text-brick">
                    {m.title}
                  </a>
                  <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                    {m.authorsCompany} · {m.dateAuthored?.slice(0, 10)}
                    {m.matchedOn.length ? ` · ${m.matchedOn.join(", ")}` : ""}
                  </span>
                </div>
                <CopyBtn text={`${m.tweet}\n\n(first reply) ${m.replyText}`} label="Copy caption" />
              </div>
              <p className="whitespace-pre-wrap px-4 py-3 font-serif text-[14px] leading-relaxed text-ink">{m.tweet}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
