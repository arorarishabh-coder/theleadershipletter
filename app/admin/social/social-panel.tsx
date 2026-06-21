"use client";

import { useState } from "react";
import type { SocialPackage } from "@/lib/social/draft";

interface PostRef {
  slug: string;
  title: string;
  publishedAt: string;
}

const TWEET_LIMIT = 280;
const LI_LIMIT = 3000;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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

function Count({ n, limit }: { n: number; limit: number }) {
  const over = n > limit;
  return (
    <span className={`font-mono text-[10px] tracking-dateline ${over ? "text-brick" : "text-ink-light"}`}>
      {n}/{limit}
    </span>
  );
}

function Block({ label, text, limit }: { label: string; text: string; limit: number }) {
  return (
    <div className="border border-rule bg-parchment-light">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">{label}</span>
        <div className="flex items-center gap-3">
          <Count n={text.length} limit={limit} />
          <CopyButton text={text} />
        </div>
      </div>
      <p className="whitespace-pre-wrap px-4 py-3 font-serif text-[15px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

export function SocialPanel({ posts, defaultSlug }: { posts: PostRef[]; defaultSlug: string }) {
  const [slug, setSlug] = useState(defaultSlug);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [pkg, setPkg] = useState<SocialPackage | null>(null);

  async function generate() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/admin/social-draft?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPkg(json.drafts as SocialPackage);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 border-y border-ink py-5">
        <label className="flex-1 min-w-[240px]">
          <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Post</span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 block w-full border border-ink bg-parchment-light px-3 py-2.5 font-serif text-[15px] text-ink focus:outline-none"
          >
            {posts.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.publishedAt} · {p.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading"}
          className="bg-ink px-6 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick disabled:opacity-60"
        >
          {status === "loading" ? "Generating…" : status === "done" ? "Regenerate" : "Generate drafts"}
        </button>
      </div>

      {status === "error" && <p className="mt-4 font-mono text-[12px] text-brick">Error: {error}</p>}
      {status === "idle" && <p className="mt-6 font-serif italic text-ink-faded">Pick a post and generate copy-ready Twitter + LinkedIn drafts.</p>}

      {pkg && status !== "loading" && (
        <div className="mt-8 space-y-12">
          {/* Image + links — the "everything you need to post" strip */}
          <section className="border border-ink bg-parchment-deep/40 p-5">
            <div className="font-mono text-[11px] uppercase tracking-dateline text-ink">Attach to every post</div>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
              <div>
                {pkg.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pkg.imageUrl} alt={pkg.imageAlt} className="w-full border border-rule" />
                ) : (
                  <div className="border border-rule p-4 text-center font-mono text-[11px] text-ink-light">no image</div>
                )}
              </div>
              <div className="space-y-3">
                {pkg.imageUrl && (
                  <div className="flex items-center gap-3">
                    <span className="w-[78px] font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Image</span>
                    <code className="flex-1 truncate font-mono text-[12px] text-ink">{pkg.imageUrl}</code>
                    <CopyButton text={pkg.imageUrl} label="Copy URL" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-[78px] font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Alt text</span>
                  <code className="flex-1 truncate font-serif text-[13px] text-ink-faded">{pkg.imageAlt}</code>
                  <CopyButton text={pkg.imageAlt} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-[78px] font-mono text-[10px] uppercase tracking-dateline text-ink-faded">X link</span>
                  <code className="flex-1 truncate font-mono text-[12px] text-ink">{pkg.links.twitter}</code>
                  <CopyButton text={pkg.links.twitter} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-[78px] font-mono text-[10px] uppercase tracking-dateline text-ink-faded">LI link</span>
                  <code className="flex-1 truncate font-mono text-[12px] text-ink">{pkg.links.linkedin}</code>
                  <CopyButton text={pkg.links.linkedin} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                  Post times · X {pkg.postingTimes.twitter} · LinkedIn {pkg.postingTimes.linkedin}
                </p>
              </div>
            </div>
          </section>

          {/* Twitter */}
          <section>
            <h2 className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}>Twitter / X</h2>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Thread ({pkg.twitterThread.length} tweets)</span>
              <CopyButton text={pkg.twitterThread.join("\n\n")} label="Copy thread" />
            </div>
            <div className="mt-3 space-y-3">
              {pkg.twitterThread.map((t, i) => (
                <Block key={i} label={`Tweet ${i + 1}`} text={t} limit={TWEET_LIMIT} />
              ))}
            </div>
            <div className="mt-6">
              <Block label="Standalone tweet (pair with image)" text={pkg.twitterSingle} limit={TWEET_LIMIT} />
            </div>
            {pkg.hashtags.twitter.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Hashtags</span>
                <code className="flex-1 font-mono text-[12px] text-ink">{pkg.hashtags.twitter.join(" ")}</code>
                <CopyButton text={pkg.hashtags.twitter.join(" ")} />
              </div>
            )}
          </section>

          {/* LinkedIn */}
          <section>
            <h2 className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}>LinkedIn</h2>
            <div className="mt-4">
              <Block label="Post" text={pkg.linkedinPost} limit={LI_LIMIT} />
            </div>
            {pkg.linkedinCarousel.slides.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Carousel ({pkg.linkedinCarousel.slides.length} slides)</span>
                  <CopyButton text={pkg.linkedinCarousel.slides.map((s, i) => `Slide ${i + 1}\n${s}`).join("\n\n")} label="Copy all slides" />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pkg.linkedinCarousel.slides.map((s, i) => (
                    <div key={i} className="border border-rule bg-parchment-light p-4">
                      <div className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Slide {i + 1}</div>
                      <p className="mt-2 whitespace-pre-wrap font-serif text-[14px] leading-snug text-ink">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pkg.hashtags.linkedin.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Hashtags</span>
                <code className="flex-1 font-mono text-[12px] text-ink">{pkg.hashtags.linkedin.join(" ")}</code>
                <CopyButton text={pkg.hashtags.linkedin.join(" ")} />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
