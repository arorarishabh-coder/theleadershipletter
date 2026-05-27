# Sources Registry

Every source we use, evaluate, or decline. License verdict and rationale recorded per source. See `CHARTER.md` for the tier system.

## Active for v1

| Source | Tier | License | Access | Status | Notes |
|---|---|---|---|---|---|
| **SEC EDGAR** | GREEN | US gov work / public domain | REST API, 10 req/s, no key | Planned Week 2 | 8-K Exhibit 99.1, DEF 14A, DEFC14A, litigation releases. Highest-yield baseline source. |
| **Federal court exhibits** | GREEN | Court records are public | CourtListener RECAP API as discovery index → storage.courtlistener.com PDF fetch → our own text extraction | **LIVE (discovery built)** | Watchlist-driven (see `lib/ingest/watchlist.ts`). `npm run discover`. Never republish CL's `snippet`/extracted text (CC BY-ND) — signal only; we re-extract from the public-record PDF. |
| **Congress.gov + committee sites** | GREEN | US gov work | Congress.gov API + per-committee HTML scrape | Planned Week 4 | Hearing exhibits. Weekly cadence. |
| **UK Parliament publications** | GREEN | Open Parliament License v3.0 | Per-publication direct fetch | Planned Week 4 | Six4Three Facebook cache is signature example. |
| **Self-published CEO letters** | GREEN | Per-publisher; quote with attribution | Per-source crawlers / RSS | Planned Week 3 | Bezos archive, Berkshire, JPM Dimon, Hastings memos, Stratechery free pieces, Stripe annual, Coinbase shareholder. |
| **Press-quoted internal memos** | YELLOW | Fair use — quote only what journalist already published; cite + link source article | RSS scan of The Verge / GeekWire / Business Insider / The Information / Insider | Planned Week 4 | Nadella, Musk, Pichai, Cook internal memos as quoted in tech press. Never reproduce more than the journalist did. |

## Evaluated and Declined

| Source | Why declined |
|---|---|
| **Enron Email Corpus (CMU/Kaggle)** | Enron.com ToS prohibits commercial use despite public-domain dataset status. Skip. |
| **Sony Pictures email leak (WikiLeaks)** | Hacked private data, active rights-holder opposition, employee PII exposure. Skip. |
| **Hacking Team leak (WikiLeaks)** | Hacked materials, weak commercial fair-use defense. Skip. |
| **UCSF Industry Documents Library (bulk)** | Commercial fair-use defense weakens at scale; court-approved collection agreements are user-bears-risk. Skip bulk; allow individual fair-use quotes only. |
| **CourtListener content directly** | CC BY-ND blocks derivative works (AI lesson + commentary = derivative). Use only as a search index; fetch underlying court PDFs from PACER for republication. |
| **DocumentCloud (ProPublica collections)** | CC BY-NC-ND — link/cite only, never republish. |
| **Twitter Files** | Copyright ambiguous, no canonical archive, scattered as thread screenshots. Skip. |
| **Climate Files** | All rights reserved, no API, no commercial license. Skip. |

## Excerpt-Only (no bulk republication)

| Source | Treatment |
|---|---|
| **UCSF Industry Documents (individual fair-use quotes)** | Quote within cap, transformative analysis required, cite + link the specific document. Used sparingly when a tobacco/opioid/chemical-industry exec letter is uniquely instructive. |
| **Books that quoted internal correspondence** (Bethany McLean, Charles Duhigg, Michael Lewis, etc.) | Quote the excerpt the author published; cite the book; never reproduce more than the author did. |

## Ingestion Cadence

| Source | Cadence | Driver |
|---|---|---|
| SEC EDGAR | Daily | Vercel Cron |
| Federal court exhibits | Daily | Vercel Cron (watchlist-driven) |
| Congress.gov | Weekly | Vercel Cron |
| Self-published CEO letters | On publish (RSS where available) + annual sweep | Vercel Cron + manual annual |
| Press-quoted memos | Daily RSS | Vercel Cron |

## Known Constraint — Scanned-Image Exhibits Need OCR

Many court exhibits are **scanned-image PDFs**, not born-digital text (validated 2026-05-26: FTC v. Meta exhibits extract clean email text; Musk v. Altman exhibits are image scans where `pdfjs` returns only the page-stamp boilerplate). This is *why* Internal Tech Emails transcribes documents rather than relying on extracted text.

- **OCR is implemented** via Claude vision transcription (`lib/ingest/ocr.ts`, prompts in `lib/prompts/transcribe.ts`). When text extraction yields < 250 body chars after stripping boilerplate, the pipeline sends the public-record PDF to a Claude vision model and transcribes the correspondence **verbatim** (no summarizing, no invention; redactions → `[REDACTED]`, illegible → `[illegible]`). The transcription is our own derivative of the public-record PDF — NOT CourtListener's CC BY-ND OCR text, which we use only as a relevance signal.
- Transcribed posts are flagged `textSource: "ocr_transcribed"` (`lib/types.ts`) so editorial can review for transcription errors before publishing.
- In `--dry-run` (no Claude calls), scanned PDFs are reported as "OCR needed" and skipped. OCR runs only in live mode (requires `ANTHROPIC_API_KEY`).

## Provenance Note Template (every published post)

> **How this surfaced**: [Source name] · [Case / hearing / article name with URL] · [Filing date or article date] · [License tier]

Example:
> **How this surfaced**: Federal court exhibit · *FTC v. Meta Platforms, Inc.*, 1:20-cv-03590 (D.D.C.), Docket #82-3, filed 2021-08-19 · Public-record exhibit
