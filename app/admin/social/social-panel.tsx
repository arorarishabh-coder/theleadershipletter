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

export function SocialPanel({ posts, defaultSlug, todaySlug }: { posts: PostRef[]; defaultSlug: string; todaySlug: string }) {
  const [slug, setSlug] = useState(defaultSlug);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [pkg, setPkg] = useState<SocialPackage | null>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pdfError, setPdfError] = useState("");
  const [cardStatus, setCardStatus] = useState<"idle" | "loading" | "error">("idle");
  const [cardError, setCardError] = useState("");

  // Download the ITE-style transcribed card (PNG) for the selected post — a
  // clean sender-labeled reproduction to attach to a LinkedIn/Twitter post.
  async function downloadCard() {
    setCardStatus("loading");
    setCardError("");
    try {
      const res = await fetch(`/api/admin/social-card?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          msg = (await res.json()).error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-card.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setCardStatus("idle");
    } catch (e) {
      setCardError(e instanceof Error ? e.message : String(e));
      setCardStatus("error");
    }
  }

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

  // Render the branded LinkedIn "document" (carousel) PDF from the drafts we
  // already generated and download it — upload via LinkedIn "Start a post →
  // Add a document".
  async function downloadPdf() {
    setPdfStatus("loading");
    setPdfError("");
    try {
      // If drafts are already generated, send them so the PDF matches the preview
      // exactly (no extra Claude call). Otherwise send just the slug and let the
      // route generate the carousel on the fly — so the top-bar button works
      // without a prior "Generate drafts" click.
      const payload = pkg
        ? { slug, slides: pkg.linkedinCarousel.slides, imageUrl: pkg.imageUrl }
        : { slug };
      const res = await fetch("/api/admin/social-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          msg = (await res.json()).error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfStatus("idle");
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
      setPdfStatus("error");
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
                {p.slug === todaySlug ? "★ Emailed today — " : ""}
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
        <button
          type="button"
          onClick={downloadCard}
          disabled={cardStatus === "loading"}
          title="Render the correspondence as a clean, sender-labeled ITE-style card (PNG) to attach to a post"
          className="border border-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment disabled:opacity-60"
        >
          {cardStatus === "loading" ? "Rendering…" : "⬇ Card image"}
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfStatus === "loading"}
          title="Branded LinkedIn document (carousel) PDF. Generates the drafts on the fly if you haven't already — post it via LinkedIn Start a post → Add a document."
          className="border border-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-parchment disabled:opacity-60"
        >
          {pdfStatus === "loading" ? "Building PDF…" : "⬇ LinkedIn PDF"}
        </button>
      </div>

      {cardStatus === "error" && <p className="mt-3 font-mono text-[12px] text-brick">Card error: {cardError}</p>}
      {pdfStatus === "error" && <p className="mt-3 font-mono text-[12px] text-brick">PDF error: {pdfError}</p>}
      {status === "error" && <p className="mt-4 font-mono text-[12px] text-brick">Error: {error}</p>}
      {status === "idle" && <p className="mt-6 font-serif italic text-ink-faded">Pick a post and generate copy-ready Twitter + LinkedIn drafts.</p>}

      {pkg && status !== "loading" && (
        <div className="mt-8 space-y-12">
          {/* Image + links — the "everything you need to post" strip */}
          <section className="border border-ink bg-parchment-deep/40 p-5">
            <div className="font-mono text-[11px] uppercase tracking-dateline text-ink">Attach to every post</div>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
              <div>
                {pkg.imageUrl ? (
                  <a href={pkg.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pkg.imageUrl} alt={pkg.imageAlt} className="w-full border border-rule" />
                  </a>
                ) : (
                  <div className="border border-rule p-4 text-center font-mono text-[11px] text-ink-light">no image</div>
                )}
              </div>
              <div className="min-w-0 space-y-3">
                {pkg.imageUrl && (
                  <div className="flex items-center gap-3">
                    <span className="w-[64px] shrink-0 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Image</span>
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{pkg.imageUrl}</code>
                    <a
                      href={pkg.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 border border-ink px-3 py-1 font-mono text-[10px] uppercase tracking-dateline text-ink transition-colors hover:bg-ink hover:text-parchment"
                    >
                      Open
                    </a>
                    <CopyButton text={pkg.imageUrl} label="Copy URL" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-[64px] shrink-0 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Alt text</span>
                  <code className="min-w-0 flex-1 truncate font-serif text-[13px] text-ink-faded">{pkg.imageAlt}</code>
                  <CopyButton text={pkg.imageAlt} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-[64px] shrink-0 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">X link</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{pkg.links.twitter}</code>
                  <CopyButton text={pkg.links.twitter} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-[64px] shrink-0 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">LI link</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{pkg.links.linkedin}</code>
                  <CopyButton text={pkg.links.linkedin} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                  Post times · X {pkg.postingTimes.twitter} · LinkedIn {pkg.postingTimes.linkedin}
                </p>
                <p className="border-t border-rule/60 pt-3 font-serif text-[13px] leading-relaxed text-ink-faded">
                  <strong className="text-ink">How to post:</strong> click <em>Open</em> to view the document image, save it, and upload it natively to the post — don&rsquo;t paste the URL. The draft text refers to &ldquo;the email below.&rdquo; Use the article link as your source: append it on X; on LinkedIn put it in the <strong className="text-ink">first comment</strong> (links in the body cut reach).
                </p>
              </div>
            </div>
          </section>

          {/* Twitter */}
          <section>
            <h2 className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 36, "wght" 500' }}>Twitter / X</h2>
            {/* Lead with the single tweet + image — best reach for a new account */}
            <div className="mt-4">
              <div className="font-mono text-[11px] uppercase tracking-dateline text-brick">★ Post this first — single tweet + the image</div>
              <div className="mt-2">
                <Block label="Standalone tweet" text={pkg.twitterSingle} limit={TWEET_LIMIT} />
              </div>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                Attach the document image. Highest reach for a cold account — threads need followers.
              </p>
            </div>
            {/* Thread — secondary */}
            <div className="mt-8 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Thread · {pkg.twitterThread.length} tweets (better once you have followers)</span>
              <CopyButton text={pkg.twitterThread.join("\n\n")} label="Copy thread" />
            </div>
            <div className="mt-3 space-y-3">
              {pkg.twitterThread.map((t, i) => (
                <Block key={i} label={`Tweet ${i + 1}`} text={t} limit={TWEET_LIMIT} />
              ))}
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
                {/* One-click branded PDF — the "post as a document" flow */}
                <div className="flex flex-wrap items-center gap-3 border border-ink bg-parchment-deep/40 px-4 py-3">
                  <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={pdfStatus === "loading"}
                    className="bg-ink px-5 py-2.5 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick disabled:opacity-60"
                  >
                    {pdfStatus === "loading" ? "Building PDF…" : "⬇ Download LinkedIn PDF"}
                  </button>
                  <p className="min-w-0 flex-1 font-serif text-[13px] leading-relaxed text-ink-faded">
                    Branded {pkg.linkedinCarousel.slides.length + (pkg.imageUrl ? 1 : 0)}-page document (1080×1350). Post it via
                    LinkedIn <strong className="text-ink">Start a post → Add a document</strong> — it renders as a swipeable
                    carousel in-feed.
                  </p>
                </div>
                {pdfStatus === "error" && <p className="mt-2 font-mono text-[12px] text-brick">PDF error: {pdfError}</p>}
                <div className="mt-4 flex items-center gap-3 border border-rule bg-parchment-light px-4 py-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-dateline text-ink-faded">Doc title</span>
                  <code className="min-w-0 flex-1 truncate font-serif text-[14px] text-ink">{pkg.carouselTitle}</code>
                  <Count n={pkg.carouselTitle.length} limit={58} />
                  <CopyButton text={pkg.carouselTitle} />
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-dateline text-ink-light">
                  Use as the LinkedIn document title (≤58 chars). The hook goes in the post caption.
                </p>
                <div className="mt-4 flex items-center justify-between">
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
