# GTM — The Leadership Letter

Goal: **5,000 paid subscribers within 12 months.** $3/mo (or $30/yr) flat pricing, no founding-member tier. Publication-only brand on social (no personal face). Content drafted by AI, posted manually by the founder on both Twitter (X) and LinkedIn.

This document is the operating plan. Update it as we learn what works.

---

## The math

| Step | Target | Assumptions |
|------|--------|-------------|
| Paid subs | 5,000 | Goal |
| Free newsletter subs needed | ~100,000–150,000 | 3–5% free→paid conversion via paywall + free week |
| Cumulative impressions needed | ~5M–15M | 1–2% impression→signup rate |
| Realistic without personal brand or founding tier | **2,000–3,500 paid** in 12 mo | Closing to 5K requires a viral content moment or B2B/team sales |

Honest revision: the publication-only brand and absence of a launch-moment lifetime tier each cost meaningful day-one velocity. The 5K goal is reachable but not the base case. Below are the levers that can close the gap.

---

## Channel strategy

### #1 — Twitter (X), publication account

Highest volume potential. Format match is perfect: screenshot of real email + caption. ITE (Internal Tech Emails, @TechEmails) is the proof case for the format.

**Account setup**:
- Handle: candidates `@LeadershipLetter`, `@LdrshipLetter`, `@TheLeadershipLtr`, `@LeadershipLtr` (claim whichever is free)
- Bio: "Real internal corporate emails — one letter, one lesson, every weekday. Free at theleadershipletter.com"
- Pinned thread: "What this is + 3 sample letters + CTA"

**Cadence** (founder posts manually from AI-drafted queue):
- 5 long-form threads/week (each = one of our blog posts, reformatted)
- 10–15 single-tweet exhibits/week (screenshot + 2-sentence caption + link)
- Daily reply-game (30 min): comment on 5–10 high-engagement biz tweets with a relevant historical exhibit from our archive

**Series formats that work**:
1. "The email that led to [famous event]" — court drama, antitrust, acquisitions
2. "This was in your inbox if you worked at [Company] in [Year]"
3. "I read every [X] from [Person]. Here's the pattern"
4. "Bezos in 1997 vs Bezos in 2017" — compare-and-contrast
5. Reactive: tie current news to historical exhibit ("Altman said this last week. He wrote this in 2014.")

### #2 — LinkedIn (publication page)

Higher conversion per impression than Twitter for B2B content. Corporate audience reads on lunch break and converts willingly to paid biz content.

**Account setup**:
- Create a LinkedIn Company Page named "The Leadership Letter"
- Same brand identity as Twitter
- Founder personal LinkedIn re-shares each post to amplify (LinkedIn rewards employee-shares of company-page content)

**Cadence**:
- 3 long-form posts/week (1,000–2,500 char "essay" format that LinkedIn rewards)
- 1 carousel/week (5–7 slides — LinkedIn's highest-engagement format)
- Re-purposed from Twitter content but rewritten for LinkedIn voice (less casual, more "MBA-classroom")

### #3 — SEO (organic search)

Every post is a permanent, searchable artifact. Zero ongoing labor; compounds for years.

- Optimize each post title for "[CEO name] [topic] memo/email/letter"
- Internal linking between posts (leader pages, company pages already exist)
- One pillar piece per month: "Every Bezos shareholder letter, annotated" — long-tail magnets

### #4 — Reddit (manual, ~2 posts/week)

High conversion when it works, hard to automate without bans. Founder posts a single letter with a real discussion question (not "check out my newsletter").

Subreddits: r/Entrepreneur (3.5M), r/startups (1.5M), r/MBA (300K), r/SecurityAnalysis (200K, Buffett crowd), r/AskHistorians (occasionally for archival pieces).

### #5 — Newsletter swaps

Worth doing once free list hits 500. Tools:
- Beehiiv recommendations network (keep the free Beehiiv account active even though we send via Resend, just for the rec network)
- Direct 1:1 swaps with peer biz newsletters

### #6 — Podcast tour

**Skipped** until paid 1,000. Requires personal face, which the founder has explicitly opted out of for now.

### #7 — HN

Save for paid-product launch as one "Show HN" post. Make it count.

### Channels to skip

- TikTok / Instagram Reels: audience mismatch for $3/mo biz content
- Paid Twitter ads before PMF: burns cash before message is proven
- Substack: 10% rev cut + walled garden lock-in
- Cold email to "10K execs": bad CAC, deliverability hell, brand risk

---

## Content production model

**Architecture**: Claude drafts everything; founder posts everything manually. No Twitter API, no LinkedIn API, no automated posting.

This avoids: $100/mo Twitter API, account-suspension risk from automated behavior, LLM-says-something-defamatory risk, and the "low-quality automated content" algorithmic penalty.

**Pipeline (to build after Stripe Phase 2)**:
```
lib/social/
  twitter-draft.ts          # LLM: post → Twitter thread + exhibit tweets
  linkedin-draft.ts         # LLM: post → LinkedIn essay + carousel script
scripts/
  draft-social.ts           # Run after each new post → fills content/social/{slug}.md
content/social/{slug}.md    # Paste-ready drafts the founder copies to Twitter + LinkedIn
```

**What each `content/social/{slug}.md` contains**:
- Twitter long thread (hook + 4–6 reply tweets + CTA, character counts shown)
- 3 standalone tweet variants (single-exhibit format)
- 2 reply-game templates (when X kind of news happens, post Y)
- LinkedIn long-form post (1,500–2,500 chars, hook-led)
- LinkedIn carousel script (5–7 slides with copy per slide)
- Suggested posting times (Tue–Thu 9 AM ET = peak biz Twitter; LinkedIn = Tue–Wed 8 AM ET)

**Founder workflow** (target: 15 min/day):
1. Open today's `content/social/{slug}.md`
2. Copy + paste the thread to Twitter (Buffer/Typefully if scheduling ahead)
3. Copy + paste the LinkedIn post
4. Done

---

## Funnel + conversion levers

### Top of funnel
- Twitter long-form threads (highest-volume signups)
- LinkedIn essays (highest $/conversion)
- SEO posts (free, compounds)

### Middle of funnel — free newsletter signups
- Every tweet/post ends with: "Get one of these every weekday → theleadershipletter.com"
- Pop-up on `/post/[slug]` after 30s scroll: "Subscribe to the daily edition"
- Footer newsletter capture (already built)

### Bottom of funnel — free → paid
- **7-day free week** (no card required) — the primary conversion lever
- **Paywall after 4 paragraphs** on `/post/[slug]` — preserves SEO and Twitter screenshots, gates the value
- **Annual nudge** — every monthly subscriber sees "save 17%" prompt at days 30/90/180
- **Gift subscriptions** — surprisingly evergreen for B2B-adjacent content ("buy your team a year for $300")
- **B2B/team plans** — a separate $200/mo "team of 10" tier. One sale = 66 individual subs equivalent. Pitch accelerators (YC, Techstars), B-school admins, VC firms' portfolio support teams.

---

## 12-month phased timeline

| Phase | Weeks | What | Founder time | Eng work |
|-------|-------|------|---------------|----------|
| **Phase 1 — Foundation** | now–W2 | Finish Stripe + paywall; 80+ posts in archive; claim @LeadershipLetter handle + LinkedIn page | <2 hrs/wk | Stripe Phase 2 (in progress) |
| **Phase 2 — Pipeline** | W3–W4 | Build social-draft pipeline; founder provides 5–10 example tweets/posts as voice templates | ~5 hrs/wk | Social drafter, 1.5 weeks |
| **Phase 3 — Soft launch** | W5–W8 | Founder posts daily from AI-drafted queue. Measure CTR to free signups. Tune voice. | 15 min/day | Iterate on prompt quality |
| **Phase 4 — Scale** | W9–W16 | Add LinkedIn carousel automation, reply-game templates. Newsletter swaps once at 500 free subs. | 30 min/day + 2 hrs/wk outreach | Maintenance |
| **Phase 5 — B2B + paid** | M5–M9 | Team/institutional pitches. Newsletter sponsorships (~$4K spots once CAC known). SEO compounds. | 3 hrs/wk | Sponsorship tracking |
| **Phase 6 — Scale what works** | M10–M12 | Double down on the proven channel. Goal: 5K paid. | 5 hrs/wk | Optimization |

---

## Metrics to track

| Metric | Target by M3 | Target by M6 | Target by M12 |
|--------|--------------|--------------|----------------|
| Twitter followers | 2,000 | 10,000 | 40,000 |
| LinkedIn followers | 500 | 3,000 | 12,000 |
| Free newsletter subs | 2,000 | 15,000 | 100,000 |
| Trial starts/week | 50 | 500 | 3,000 |
| Paid subs | 50 | 500 | **5,000** |
| MRR | $150 | $1,500 | $15,000 |
| Free→paid conversion | 2.5% | 3.5% | 5.0% |

Instrument every link with UTM tags:
- `?utm_source=twitter&utm_medium=thread&utm_campaign={slug}`
- `?utm_source=linkedin&utm_medium=post&utm_campaign={slug}`
- `?utm_source=linkedin&utm_medium=carousel&utm_campaign={slug}`

---

## Risks + contingencies

| Risk | Mitigation |
|------|------------|
| Twitter algorithm down-ranks publication accounts | LinkedIn becomes #1; founder personal account becomes secondary amplifier (revisit personal-brand decision at M3) |
| Low engagement on first 30 threads — wrong voice | Iterate the LLM voice prompt; use top-performing posts as new few-shot examples |
| ITE (or another competitor) launches a near-identical paid product | Lean into the AI-lesson differentiation; emphasize editorial curation + transferable lessons (the rubric ITE doesn't have) |
| Legal threat over a specific letter | The CHARTER's takedown policy + 48-hour response keeps us defensible; remove + document publicly |
| LLM hallucinates a fact in a draft | Mandatory human review before posting (built into the model) |
| 5K paid not reached by M12 | At M6 reassess: revisit personal-brand decision, add founding-member tier in a "Year 2 relaunch", or pivot to B2B-team-plan sales |

---

## Decisions locked

- **Brand**: publication only ("The Leadership Letter"), no personal face
- **Pricing**: $3/mo, $30/yr — no founding-member tier
- **Posting model**: AI drafts everything → founder copy-pastes manually
- **Platforms**: Twitter (#1 volume) + LinkedIn (#1 conversion) in parallel
- **API spend**: $0 (manual posting eliminates Twitter API requirement)

---

## This week's action list

**Founder** (~3 hours total):
- [ ] Claim Twitter handle (see candidates in #1 above) — first-come-first-served, do this today
- [ ] Create LinkedIn Company Page for "The Leadership Letter"
- [ ] Send Claude 5–10 example tweets/threads whose voice you want the drafter to mimic (ITE, Trung Phan, Sahil Bloom, etc.)
- [ ] Decide on a daily posting time-slot (e.g., 9 AM ET = peak biz audience)

**Engineering** (in queue, post-Stripe-Phase-2):
- [ ] Build `lib/social/twitter-draft.ts` + `linkedin-draft.ts`
- [ ] Add `scripts/draft-social.ts` that runs after each new post
- [ ] Add a simple `app/admin/social/page.tsx` that shows pending drafts (optional polish — the markdown files alone suffice for v1)
