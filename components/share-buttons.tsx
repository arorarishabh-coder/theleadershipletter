"use client";

import { useState } from "react";

interface ShareButtonsProps {
  /** Absolute, canonical URL of the post. */
  url: string;
  /** Post title — fallback share text. */
  title: string;
  /** The pull quote / shocking line — leads the share text (artifact-first). */
  quote?: string;
  /** Optional label above the row. Set "" to hide. */
  label?: string;
}

// X truncates around 280; leave room for the quotes, an em dash, and the URL
// (~24 chars after t.co wrapping) so the tweet never overflows.
const QUOTE_MAX = 200;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, "") + "…";
}

function shareText(quote: string | undefined, title: string): string {
  const q = (quote ?? "").trim();
  if (q) return `“${truncate(q, QUOTE_MAX)}”`;
  return truncate(title, QUOTE_MAX);
}

const BTN =
  "inline-flex items-center gap-1.5 border border-ink/25 px-3 py-2 font-mono text-[11px] uppercase tracking-dateline text-ink transition-colors hover:border-ink hover:text-brick";

export function ShareButtons({ url, title, quote, label = "Share this letter" }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const text = shareText(quote, title);
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  function openPopup(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (older browser / no https) — select-and-copy fallback.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {label ? (
        <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-light mr-1">{label}</span>
      ) : null}
      <button type="button" onClick={() => openPopup(xHref)} className={BTN} aria-label="Share on X">
        <span aria-hidden>𝕏</span> Post
      </button>
      <button type="button" onClick={() => openPopup(liHref)} className={BTN} aria-label="Share on LinkedIn">
        <span aria-hidden>in</span> Share
      </button>
      <button type="button" onClick={copy} className={BTN} aria-label="Copy link">
        {copied ? "✓ Copied" : "Copy link"}
      </button>
    </div>
  );
}
