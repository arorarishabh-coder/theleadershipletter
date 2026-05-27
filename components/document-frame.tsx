"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { PostScreenshot } from "@/lib/types";

interface DocumentFrameProps {
  screenshots: PostScreenshot[];
}

export function DocumentFrame({ screenshots }: DocumentFrameProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((i: number) => setActiveIndex(i), []);
  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i - 1 + screenshots.length) % screenshots.length));
  }, [screenshots.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % screenshots.length));
  }, [screenshots.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [activeIndex, closeLightbox, prev, next]);

  if (!screenshots.length) return null;
  const current = screenshots[currentIndex];
  const active = activeIndex !== null ? screenshots[activeIndex] : null;

  return (
    <>
      <figure className="my-14">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => openLightbox(currentIndex)}
            className="block w-full cursor-zoom-in group"
            aria-label="View full-size source document"
          >
            <div className="document-frame transition-transform duration-300 group-hover:scale-[1.005]">
              <img
                src={current.url}
                alt={current.alt}
                className="block h-auto w-full"
              />
            </div>
          </button>
          <figcaption className="mt-5 flex flex-col gap-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
              {current.caption}
            </p>
            {screenshots.length > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => (i - 1 + screenshots.length) % screenshots.length)}
                  className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded transition-colors hover:text-brick"
                >
                  ← Prev
                </button>
                <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-light">
                  {currentIndex + 1} of {screenshots.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => (i + 1) % screenshots.length)}
                  className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded transition-colors hover:text-brick"
                >
                  Next →
                </button>
              </div>
            )}
          </figcaption>
        </div>
      </figure>

      {/* Lightbox */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Source document, enlarged"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 p-6 animate-fade-in"
          onClick={closeLightbox}
        >
          <div
            className="relative max-h-[88vh] max-w-5xl animate-lightbox-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={active.url}
              alt={active.alt}
              className="block max-h-[88vh] w-auto max-w-full border-2 border-parchment shadow-2xl"
            />
          </div>
          <div className="mt-5 flex w-full max-w-5xl items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-dateline text-parchment/80">
              {active.caption}
            </p>
            <div className="flex items-center gap-4">
              {screenshots.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); prev(); }}
                    className={cn(
                      "font-mono text-[11px] uppercase tracking-dateline text-parchment/80 transition-colors hover:text-parchment"
                    )}
                  >
                    ← Prev
                  </button>
                  <span className="font-mono text-[11px] uppercase tracking-dateline text-parchment/60">
                    {(activeIndex ?? 0) + 1} / {screenshots.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); next(); }}
                    className="font-mono text-[11px] uppercase tracking-dateline text-parchment/80 transition-colors hover:text-parchment"
                  >
                    Next →
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={closeLightbox}
                className="font-mono text-[11px] uppercase tracking-dateline text-parchment/80 transition-colors hover:text-parchment"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
