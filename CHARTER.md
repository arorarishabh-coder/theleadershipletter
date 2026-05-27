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
