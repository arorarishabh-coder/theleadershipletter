# The Leadership Letter — Charter

The editorial constitution. Every published post must satisfy this document.

## Mission

Surface real internal corporate correspondence — executive emails, board memos, strategy letters, court exhibits, shareholder letters — and pair each with a genuine leadership lesson. Founders and curious professionals should leave every post knowing something true about how real leaders think, decide, and communicate under pressure.

## Audience

- Founders and operators (early to growth stage)
- Curious business professionals (Acquired podcast / Matt Levine reader profile)

## Editorial Principles

### Truth over flattery
- Both wins and failures are valid material. No hagiography. No hit pieces.
- Lessons must be grounded in the document. Every meaningful claim cites a specific line, section, or quoted excerpt.
- When surrounding context is unclear, we say so. Never fabricate background facts to make a narrative tighter.

### Transformative commentary, not republication
- Every post is analysis-first. The document is the **exhibit**; the lesson is the **product**.
- Excerpt length capped at the lesser of: **300 words** OR **10% of source document**.
- Quoted text is always clearly marked, attributed, and linked to the original public source.

### Provenance always
- Every post links to the original public document (PACER, EDGAR, Congress.gov, foreign-gov publication, etc.)
- Every post includes a "How this surfaced" footer: which case, which hearing, which leak, which letter, what date.
- Sources we cannot link to publicly do not get published. No "I heard from a friend at Meta" sourcing — ever.

## What We Publish — Article Inclusion Spec

The operative definition of what enters the pipeline. The relevance gate
(`lib/prompts/relevance.ts`) is the machine enforcement of this section.

### The single test (north star)
> A document earns a post only if a founder or operator finishes it knowing
> something **true and transferable** about how a real business leader thinks,
> decides, competes, or communicates under pressure.

A real internal email is *necessary but not sufficient* — a lawyer's scheduling
letter is genuine correspondence and teaches nothing. The document is the
**exhibit**; the lesson is the **product**.

### What qualifies — four archetypes
1. **Executive decision emails** — a leader reasoning through a real call (e.g. the
   Zuckerberg "we should buy Instagram" email; Cue→Cook "Competing on Privacy").
2. **Founder / exec chat threads** — WhatsApp / SMS / iMessage / Slack / Signal.
   Just as valid as email: no From/To/Subject headers required; chat handles and
   redaction bars are normal for exhibit logs (e.g. the Musk↔Altman texts).
3. **Strategy / board memos & decks** — how a leader frames a bet or a rivalry.
4. **Substantive shareholder / CEO letters** — Bezos / Buffett / Dimon / Hastings
   genre. Public distribution does NOT disqualify; genuine reasoning is what counts.

### What we reject (hard exclusions)
- **Procedural / legal** — motions, discovery disputes, scheduling, declarations,
  lawyer-to-lawyer letters.
- **Logistics / scheduling** — calendar confirmations, "got it, thanks," rubber-stamp
  approvals with no reasoning.
- **Content-free boilerplate** — earnings tables, dividend notices, safe-harbor
  language, mission/values fluff. (A shareholder letter with real reasoning is NOT
  boilerplate — see archetype 4.)
- **Non-correspondence** — cover sheets, charts, financial statements, exhibit dividers.
- **Off-theme** — HR/benefits admin, pure engineering minutiae, personal/lifestyle,
  partisan politics.
- **No transferable lesson** — real correspondence that generalizes to nothing.
- **RED sources** — per the Source Tiers table below.

### Two publishing lanes
1. **Lesson post** (default) — clears the bar → gets an AI leadership lesson. Fuels
   the newsletter.
2. **Notable Artifact** — an iconic exchange with no clean transferable lesson but
   real historical significance (recognizable leader OR pivotal moment). Gets a
   factual "why this matters," **never an invented lesson**. This is the lane that
   earns reach on social (raw artifact > guru-lesson).

### CourtListener selection — marquee-only
CourtListener/RECAP is a firehose of entire federal dockets. We do not ingest cases;
we ingest **the right exhibits from the right cases**:
- **Case scope:** the DEFAULT discovery sweep and alert fingerprints are pinned to
  **marquee cases** (`MARQUEE_CASE_IDS` in `lib/ingest/watchlist.ts`) — recognizable-
  company antitrust/securities dockets (Meta, Apple, Google, Microsoft, OpenAI,
  Amazon, Uber, Anthropic). Emerging cases stay on the watchlist and remain pullable
  on demand via `--case=<id>`; they are just kept out of the auto-firehose.
- **Exhibit filter:** trial / deposition / summary-judgment exhibits (PX####/DX####
  emails, chat logs) — skip the docket's procedural filings.
- **Author filter:** authored/driven by a business leader, not counsel running case
  mechanics.

### Signal routing
The gate scores `leadershipSignal` (0-10). Recognizable leaders/companies score higher
(they transfer and reach further). Routing:

| Signal | Blog | Newsletter | Social |
|---|---|---|---|
| **8-10** — featured, named exec, sharp lesson | ✅ | ✅ | ✅ push |
| **7** — solid, transferable | ✅ | ✅ | optional |
| **6** — competent but marginal (e.g. obscure small-cap letter) | ✅ | ❌ | ❌ |
| **< 6** — thin | ❌ hold | ❌ | ❌ |

Newsletter auto-send is gated at `NEWSLETTER_MIN_SIGNAL` (default **7**,
`lib/publish/schedule.ts`). Independently, **firehose-discovered** letters (the EDGAR
blind full-text sweep of *every* 8-K filer) are **quarantined** from auto-send —
visible on the blog, held from the daily email until an editor approves — so obscure
filers never reach the audience unreviewed. Legacy/court-exhibit posts generated before
signal-persistence are grandfathered past the floor.

## Source Tiers

| Tier | Examples | Treatment |
|---|---|---|
| **GREEN — public domain** | SEC EDGAR, federal court exhibits, congressional records, foreign-government publications | Republish excerpts freely with attribution; within fair-use cap |
| **GREEN — self-published** | Bezos shareholder letters, Berkshire letters, CEO blog posts, public LinkedIn essays | Quote liberally with attribution |
| **YELLOW — fair-use only** | Journalist-quoted memos in press articles (The Verge, GeekWire, Business Insider, The Information) | Quote only the excerpt the journalist published; cite + link the article; add our own analysis |
| **RED — do not use** | Hacked corpora (Sony, Hacking Team), Enron dataset (TOS), CourtListener metadata directly, NC-ND-licensed archives, Twitter Files | Skip entirely |

See `SOURCES.md` for the full registry of every source with verdict and rationale.

## Quality Bar (every post must pass)

1. **Grounded** — every claim traceable to a quote or document section
2. **Cited** — original public source linked
3. **Compliant** — excerpts within fair-use cap (300 words / 10%)
4. **Provenance noted** — "How this surfaced" section present
5. **Screenshot included** — at least one screenshot of the source document (rendered PDF page or web-page capture). Visual proof of provenance. PII in the screenshot redacted before publish.
6. **No PII** — personal email addresses, phone numbers, home addresses, SSNs redacted in both text excerpt AND screenshot before publish
7. **Analytical neutrality** — lesson works for a reader without prior ideological alignment
8. **Pull-quote present** — one ≤25-word line capturing the lesson
9. **QA agent pass** — automated review of all of the above (including screenshot present, no PII visible, fair-use length) before going live (per `feedback_qa_before_testing`)

## Takedown Response Policy

If a rights-holder or affected individual requests removal of a specific post:
1. **Acknowledge within 48 hours** (auto-reply with case number)
2. **Review** good-faith fair-use posture against the four-factor test
3. If posture is weak → **remove** the post; document the decision in the internal removals log
4. If posture is strong → **respond** with reasoning; offer to add the affected party's context as a labeled addendum
5. **Public removals log** maintained at `/removals` — counts + reason summaries only, no defamation surface

## Out of Scope (v1)

- Paid subscription / paywall (deferred until traction signal)
- User accounts (newsletter signup via Beehiiv is sufficient)
- Reader comments
- Anything sourced from active leaks, hacks, or NDAs in dispute
- Speculation about leaders' private motives beyond what the document directly supports
- "Lifestyle" content about executives (kids, partners, hobbies) — purely professional correspondence only

## Versioning

This charter is the editorial constitution. Material changes require an explicit decision recorded in `CHARTER_CHANGELOG.md` (file created on the first change). Minor copy-edits do not require a changelog entry.
