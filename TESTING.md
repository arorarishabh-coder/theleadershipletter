# Testing & QA — Subscribers and Non-Subscribers

How to verify the membership experience end-to-end. Two ways: the **automated
suite** (fast, repeatable) and **manual steps** (what a real visitor does).

## Membership states

| State | Who | Archive access |
|-------|-----|----------------|
| `anonymous` | Not signed in | Today's free edition only |
| `registered` | Signed in, no trial yet | Today's free edition only |
| `trial` | Free week active (no card) | Full archive |
| `trial_expired` | Free week ended, not paying | Today's free edition only |
| `subscribed` | Paying ($3/mo or $30/yr) | Full archive |

> **Free edition rule:** the single most-recently-emailed post is free for
> everyone. Every *other* archive post is gated.

---

## 1. Automated suite

```bash
npm run dev                 # in one terminal (serves localhost:3000)

npm run qa:e2e              # full matrix: 5 states × every gated surface (62 checks)
npm run qa:membership      # core membership surfaces (13 checks)
npm run qa:content -- --all # content QA gate (fair-use caps, screenshots, taxonomy)
npm run qa:runway          # newsletter buffer runway
```

- Each creates throwaway users + real sessions in the DB and **cleans them up**.
- Screenshots land in `.qa-screenshots/` (gitignored) — open them to eyeball each state.
- Run any harness against production instead of local:
  `QA_BASE=https://theleadershipletter.com npm run qa:e2e`
  (⚠️ writes/deletes throwaway rows in the **production** DB — only with intent.)

---

## 2. Manual testing — the shortcut (no payment needed)

You're an admin (`arorarishabh@gmail.com`), so you can preview **any** gate on
**any** archive post by appending `?simulate=STATE` to its URL while signed in.
A red "Admin simulate" banner confirms it.

| URL suffix | Expected on a gated post |
|------------|--------------------------|
| `?simulate=anonymous` | Paywall: "This edition is for members." |
| `?simulate=registered` | Paywall: "Start your free week." |
| `?simulate=trial` | Full lesson (unlocked) |
| `?simulate=trial_expired` | Paywall: "Your free week has ended." |
| `?simulate=subscribed` | Full lesson (unlocked) |

Example: `https://theleadershipletter.com/post/<archive-slug>?simulate=trial_expired`

---

## 3. Manual testing — real non-subscriber journey

1. **Anonymous** — open the site in an incognito window.
   - Header shows **Sign in** + **Subscribe** (not Account).
   - Today's emailed edition → full lesson (free).
   - Any other archive post (via **Browse**) → paywall "This edition is for members." + a newsletter signup box.
2. **Newsletter signup** — on `/subscribe`, enter an email → "You're in." → a branded **welcome email** should arrive within ~1 min.
3. **Sign in (magic link)** — click **Sign in** → enter your email → open the "Sign in to theleadershipletter.com" email → click **Sign in →**.
   - You land signed in; header now shows **Account**.
4. **Registered** — go to `/account`.
   - Shows **Start free week →** plus $3/$30 options.
   - A gated archive post still shows the "Start your free week." paywall.
5. **Start the trial** — click **Start free week →**.
   - `/account` now shows **Free week · 7 days left**.
   - Gated archive posts now show the **full lesson**.

## 4. Manual testing — subscriber journey (real payment)

> ⚠️ **Stripe is in LIVE mode** — a checkout is a real charge. Two options:
> **(a)** make one real $3/mo purchase with your card, verify, then cancel +
> refund in the Stripe dashboard; or **(b)** to test with `4242…` test cards,
> deploy a preview with Stripe **test** keys.

1. From `/membership` or a gated post, choose **$3/mo** (or **$30/yr**).
2. Complete Stripe Checkout.
3. You're redirected to `/account?checkout=success` showing **Subscriber · Monthly** + **Manage billing →**.
4. Every archive post now shows the **full lesson**.
5. Click **Manage billing →** → Stripe customer portal (switch plan, view invoices, cancel).

## 5. Newsletter unsubscribe

- Any newsletter email's **Unsubscribe** link → `/unsubscribe?email=…` → `/unsubscribed` confirmation; the contact is marked unsubscribed in Resend.

---

## Expected-result checklist

| Surface | anonymous | registered | trial | trial_expired | subscribed |
|---------|-----------|-----------|-------|---------------|------------|
| Header | Sign in | Account | Account | Account | Account |
| `/account` | → /signin | Start free week | Free week · N days | Free week ended | Subscriber + Manage billing |
| Gated post | "for members" paywall | "start your free week" paywall | full lesson | "free week ended" paywall | full lesson |
| Free edition | full lesson | full lesson | full lesson | full lesson | full lesson |
| Newsletter CTA on post | shown | suppressed | suppressed | suppressed | suppressed |

All of the above is asserted by `npm run qa:e2e` (62/62 passing as of last run).
