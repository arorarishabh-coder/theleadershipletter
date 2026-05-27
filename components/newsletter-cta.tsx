"use client";

import { useState } from "react";

interface NewsletterCTAProps {
  variant?: "inline" | "boxed";
}

type Status = "idle" | "loading" | "success" | "error";

function useSubscribe() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string };
      if (res.ok && json.ok) {
        setStatus("success");
        setMessage(json.already ? "You're already on the list — see you tomorrow morning." : "You're in. The next edition lands tomorrow morning.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(json.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return { email, setEmail, status, message, submit };
}

export function NewsletterCTA({ variant = "inline" }: NewsletterCTAProps) {
  const { email, setEmail, status, message, submit } = useSubscribe();

  if (variant === "boxed") {
    return (
      <aside className="my-16 border-y border-ink bg-parchment-deep/60 py-12">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
            One letter. One lesson. Every weekday morning.
          </p>
          <h3
            className="mt-4 font-display text-display-3 text-ink"
            style={{ fontVariationSettings: '"opsz" 60, "wght" 500, "SOFT" 30' }}
          >
            Subscribe to the daily edition.
          </h3>
          <p className="mt-3 text-base text-ink-faded">
            Real correspondence, read closely. Free. Unsubscribe in one click.
          </p>
          {status === "success" ? (
            <p className="mt-6 font-serif text-[1.0625rem] text-brick">{message}</p>
          ) : (
            <>
              <form onSubmit={submit} className="mt-6 flex max-w-md mx-auto border border-ink">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-parchment-light px-4 py-3 font-sans text-sm text-ink placeholder:text-ink-light focus:outline-none focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick disabled:opacity-60"
                >
                  {status === "loading" ? "…" : "Subscribe"}
                </button>
              </form>
              {status === "error" && <p className="mt-3 font-sans text-xs text-brick">{message}</p>}
            </>
          )}
        </div>
      </aside>
    );
  }

  if (status === "success") {
    return <p className="font-serif text-[1.0625rem] text-brick">{message}</p>;
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={submit} className="flex border border-ink">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full bg-parchment-light px-4 py-3 font-sans text-sm text-ink placeholder:text-ink-light focus:outline-none focus:bg-white"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.18em] text-parchment transition-colors hover:bg-brick whitespace-nowrap disabled:opacity-60"
        >
          {status === "loading" ? "…" : "Subscribe"}
        </button>
      </form>
      {status === "error" && <p className="mt-2 font-sans text-xs text-brick">{message}</p>}
    </div>
  );
}
