/**
 * Machine-readable case watchlist for CourtListener RECAP discovery.
 *
 * This is the structured counterpart to WATCHLIST.md. Each entry is a federal
 * docket we monitor for newly-filed exhibits containing internal corporate
 * correspondence. Discovery (lib/ingest/discovery.ts) queries each case for
 * email-bearing exhibits and feeds candidates into the existing pipeline.
 *
 * IMPORTANT — federal only: RECAP mirrors PACER, which is FEDERAL courts. State
 * courts (notably the Delaware Court of Chancery, where M&A fights like
 * Twitter v. Musk live) are NOT in RECAP. Such cases are listed with
 * system: "state" and skipped by discovery — they require a separate state
 * e-filing pipeline. They're kept here so the gap is explicit, not forgotten.
 */

import type { PostTopic } from "@/lib/types";

export interface WatchedCase {
  /** Stable slug used in generated document ids. */
  id: string;
  /** Human-readable case name (becomes Post.sourceCase). */
  caseName: string;
  /** Court system: "recap" = federal/PACER (discoverable); "state" = not in RECAP. */
  system: "recap" | "state";
  /** CourtListener court id (e.g. "dcd", "cand", "nysd"). Required for recap. */
  court?: string;
  /** Docket number, e.g. "1:20-cv-03590". */
  docketNumber: string;
  /** Company most associated with the case (becomes Post.authorsCompany default). */
  knownCompany: string;
  /** Leader slugs whose correspondence this case tends to surface. */
  knownLeaderSlugs: string[];
  /** Advisory topic hints for triage. */
  hintedTopics: PostTopic[];
  /** Internal-correspondence signals used to bias discovery toward executive
   *  emails (not lawyer/procedural filings): internal email domains + principal
   *  names. The discovery query becomes: "From:" AND (one of these). */
  internalSignals?: { domains?: string[]; people?: string[] };
  /** Public exhibit-archive pages (e.g. DOJ trial-exhibit listings) that publish
   *  individual exhibits with descriptions + fetchable PDF links — the off-RECAP
   *  source that completes the loop where exhibits aren't filed on RECAP. */
  exhibitArchiveUrls?: string[];
  /** Why this docket is on the watchlist. */
  note: string;
}

export const WATCHED_CASES: WatchedCase[] = [
  {
    id: "ftc-v-meta",
    caseName: "FTC v. Meta Platforms, Inc.",
    system: "recap",
    court: "dcd",
    docketNumber: "1:20-cv-03590",
    knownCompany: "Meta Platforms, Inc.",
    knownLeaderSlugs: ["mark-zuckerberg"],
    hintedTopics: ["acquisitions", "competition", "strategy", "comms"],
    internalSignals: {
      domains: ["fb.com", "facebook.com", "instagram.com"],
      people: ["Zuckerberg", "Sandberg", "Systrom", "Olivan", "Cox"],
    },
    note: "Instagram/WhatsApp acquisition emails; Zuckerberg correspondence; antitrust trial exhibits.",
  },
  {
    id: "epic-v-apple",
    caseName: "Epic Games, Inc. v. Apple Inc.",
    system: "recap",
    court: "cand",
    docketNumber: "4:20-cv-05640",
    knownCompany: "Apple Inc.",
    knownLeaderSlugs: ["tim-cook"],
    hintedTopics: ["strategy", "competition", "product", "finance"],
    internalSignals: {
      domains: ["apple.com", "epicgames.com"],
      people: ["Cook", "Schiller", "Federighi", "Sweeney", "Maestri"],
    },
    note: "App Store policy + commission emails; Cook/Schiller correspondence; trial exhibits.",
  },
  {
    id: "us-v-google-search",
    caseName: "United States v. Google LLC (Search)",
    system: "recap",
    court: "dcd",
    docketNumber: "1:20-cv-03010",
    knownCompany: "Google LLC",
    knownLeaderSlugs: ["sundar-pichai"],
    hintedTopics: ["strategy", "competition", "comms", "product"],
    internalSignals: {
      domains: ["google.com"],
      people: ["Pichai", "Raghavan", "Roszak", "Kavanaugh", "Cue"],
    },
    exhibitArchiveUrls: [
      "https://www.justice.gov/atr/us-and-plaintiff-states-v-google-llc-2020-trial-exhibits",
    ],
    note: "Search default-deal strategy; internal revenue-share emails.",
  },
  {
    id: "us-v-google-adtech",
    caseName: "United States v. Google LLC (Ad Tech)",
    system: "recap",
    court: "vaed",
    docketNumber: "1:23-cv-00108",
    knownCompany: "Google LLC",
    knownLeaderSlugs: ["sundar-pichai"],
    hintedTopics: ["competition", "strategy", "product", "partnerships"],
    internalSignals: {
      domains: ["google.com"],
      people: ["Pichai", "Raghavan", "Mohan", "Ramaswamy", "Bellack"],
    },
    exhibitArchiveUrls: [
      "https://www.justice.gov/atr/us-and-plaintiff-states-v-google-llc-2023-trial-exhibits",
    ],
    note: "Ad-tech monopolization; internal display-ads strategy emails. DOJ public exhibit archive.",
  },
  {
    id: "ftc-v-microsoft-activision",
    caseName: "FTC v. Microsoft Corp. & Activision Blizzard",
    system: "recap",
    court: "cand",
    docketNumber: "3:23-cv-02880",
    knownCompany: "Microsoft Corporation",
    knownLeaderSlugs: ["satya-nadella"],
    hintedTopics: ["acquisitions", "competition", "strategy", "product"],
    internalSignals: {
      domains: ["microsoft.com", "activision.com", "activisionblizzard.com"],
      people: ["Nadella", "Spencer", "Kotick", "Bond", "Stuart"],
    },
    note: "Activision merger; Xbox strategy; Nadella + Spencer + Kotick correspondence.",
  },
  {
    id: "musk-v-altman",
    caseName: "Musk v. Altman (OpenAI)",
    system: "recap",
    court: "cand",
    docketNumber: "4:24-cv-04722",
    knownCompany: "OpenAI",
    knownLeaderSlugs: ["elon-musk", "sam-altman"],
    hintedTopics: ["board-governance", "strategy", "comms", "leadership-transitions"],
    internalSignals: {
      domains: ["openai.com", "tesla.com", "spacex.com", "x.com"],
      people: ["Musk", "Altman", "Brockman", "Sutskever", "Nadella"],
    },
    note: "OpenAI founding correspondence; Musk/Altman/Nadella emails; the case ITE itself mines heavily.",
  },
  {
    id: "waymo-v-uber",
    caseName: "Waymo LLC v. Uber Technologies, Inc.",
    system: "recap",
    court: "cand",
    docketNumber: "3:17-cv-00939",
    knownCompany: "Uber Technologies, Inc.",
    knownLeaderSlugs: ["travis-kalanick"],
    hintedTopics: ["crisis-management", "strategy", "comms"],
    internalSignals: {
      domains: ["uber.com", "google.com"],
      people: ["Kalanick", "Levandowski", "Page", "Krafcik"],
    },
    note: "Kalanick-era internal emails; trade-secret exhibits.",
  },
  // ── Added 2026-06-25 to broaden RECAP discovery beyond the tapped-out original
  // set. Docket numbers + CourtListener court ids verified against public record.
  // NOTE: Visa & Live Nation have not gone to trial yet, so DOJ exhibit archives
  // aren't populated — they're monitored via RECAP for now (no exhibitArchiveUrls
  // until a trial-exhibit table exists in the format doj-exhibits.ts parses).
  {
    id: "ftc-v-amazon-ecommerce",
    caseName: "FTC v. Amazon.com, Inc.",
    system: "recap",
    court: "wawd", // W.D. Washington
    docketNumber: "2:23-cv-01495",
    knownCompany: "Amazon.com, Inc.",
    knownLeaderSlugs: ["andy-jassy", "jeff-bezos"],
    hintedTopics: ["competition", "strategy", "finance"],
    internalSignals: {
      domains: ["amazon.com"],
      people: ["Jassy", "Bezos", "Wilke", "Herrington"],
    },
    note: "Monopoly-maintenance; 'Project Nessie' pricing-algorithm emails; Jassy/Bezos correspondence.",
  },
  {
    id: "ftc-v-kroger-albertsons",
    caseName: "FTC v. The Kroger Co. & Albertsons Companies, Inc.",
    system: "recap",
    court: "ord", // D. Oregon
    docketNumber: "3:24-cv-00347",
    knownCompany: "The Kroger Co.",
    knownLeaderSlugs: [],
    hintedTopics: ["acquisitions", "competition", "strategy"],
    internalSignals: {
      domains: ["kroger.com", "albertsons.com"],
      people: ["McMullen", "Sankaran"],
    },
    note: "Blocked $24.6B grocery merger; internal pricing/divestiture emails surfaced at the PI hearing.",
  },
  {
    id: "epic-v-google-play",
    caseName: "In re Google Play Store Antitrust Litigation (Epic v. Google)",
    system: "recap",
    court: "cand", // N.D. California
    docketNumber: "3:21-md-02981",
    knownCompany: "Google LLC",
    knownLeaderSlugs: ["sundar-pichai"],
    hintedTopics: ["app-stores", "competition", "strategy", "partnerships"],
    internalSignals: {
      domains: ["google.com"],
      people: ["Pichai", "Kochikar", "Rosenberg", "Samat"],
    },
    note: "Play Store monopoly jury trial (Epic win, 2023); 'Project Hug' developer-deal emails; 300+ admitted exhibits.",
  },
  {
    id: "us-v-live-nation",
    caseName: "United States v. Live Nation Entertainment, Inc. & Ticketmaster L.L.C.",
    system: "recap",
    court: "nysd", // S.D.N.Y.
    docketNumber: "1:24-cv-03973",
    knownCompany: "Live Nation Entertainment, Inc.",
    knownLeaderSlugs: [],
    hintedTopics: ["competition", "strategy", "comms"],
    internalSignals: {
      domains: ["livenation.com", "ticketmaster.com"],
      people: ["Rapino", "Berchtold"],
    },
    note: "Live-events monopolization (trial pending). Monitored via RECAP; add DOJ exhibit page once trial materials post.",
  },
  {
    id: "us-v-visa",
    caseName: "United States v. Visa Inc.",
    system: "recap",
    court: "nysd", // S.D.N.Y.
    docketNumber: "1:24-cv-07214",
    knownCompany: "Visa Inc.",
    knownLeaderSlugs: [],
    hintedTopics: ["competition", "strategy", "partnerships", "finance"],
    internalSignals: { domains: ["visa.com"], people: [] },
    note: "Debit-network monopolization (trial pending). DOJ 'Plaintiff Exhibits' page not yet populated; monitored via RECAP.",
  },
  // ── Added 2026-07-02. Anthropic sued the DoD ("Department of War") over its
  // "supply-chain risk" designation; the Amodei↔Emil Michael guardrail
  // negotiation emails were filed as exhibits (346-page compilation, also mirrored
  // at archive.org/details/anthropic-vs-pentagon-emails). This is the case ITE
  // pulled the "Dario Amodei emails the Pentagon" post from — a live, fast-moving
  // docket that is exactly our sourcing model.
  {
    id: "anthropic-v-dod",
    caseName: "Anthropic PBC v. U.S. Department of War",
    system: "recap",
    court: "cand", // N.D. California
    docketNumber: "3:26-cv-01996",
    knownCompany: "Anthropic",
    knownLeaderSlugs: ["dario-amodei"],
    hintedTopics: ["strategy", "comms", "partnerships", "leadership-transitions"],
    internalSignals: {
      domains: ["anthropic.com"],
      people: ["Amodei", "Emil Michael", "Krieger", "Hegseth"],
    },
    exhibitArchiveUrls: [
      "https://archive.org/details/anthropic-vs-pentagon-emails",
    ],
    note: "AI-use guardrails (autonomous weapons + domestic surveillance) negotiation; Amodei↔Emil Michael emails. Exhibit compilation also on archive.org (346pp). The source of ITE's Feb 2026 Pentagon post.",
  },
  // ── Added 2026-07-02. The youth social-media-harms MDL: the source of ITE's
  // "Mark Zuckerberg's WhatsApp messages" post (Oct 2021 teen-safety exchange).
  // Federal + RECAP-discoverable, so no coverage gap — we just hadn't added it.
  // Parallel state-AG suits (MA, NM, 40-state coalition) carry overlapping
  // exhibits but live in state courts (off-RECAP).
  {
    id: "social-media-adolescent-addiction",
    caseName: "In re: Social Media Adolescent Addiction/Personal Injury Products Liability Litigation",
    system: "recap",
    court: "cand", // N.D. California
    docketNumber: "4:22-md-03047",
    knownCompany: "Meta Platforms, Inc.",
    knownLeaderSlugs: ["mark-zuckerberg"],
    hintedTopics: ["crisis-management", "product", "comms", "strategy"],
    internalSignals: {
      domains: ["fb.com", "facebook.com", "meta.com", "instagram.com"],
      people: ["Zuckerberg", "Bejar", "Mosseri", "Clegg", "Cox"],
    },
    note: "Teen-safety internal messages (Zuckerberg WhatsApp/email, Bejar warnings) unsealed in the MDL; also Meta, TikTok, Snap, Google defendants. Trial materials + unsealed exhibits.",
  },
  // ── Added 2026-07-18 to widen the marquee net (recognizable-company federal
  // dockets with internal-email exhibits). Docket numbers + CourtListener court
  // ids verified against the public record before adding.
  {
    id: "in-re-tesla-securities",
    caseName: "In re Tesla, Inc. Securities Litigation",
    system: "recap",
    court: "cand", // N.D. California
    docketNumber: "3:18-cv-04865",
    knownCompany: "Tesla, Inc.",
    knownLeaderSlugs: ["elon-musk"],
    hintedTopics: ["comms", "board-governance", "crisis-management", "finance"],
    internalSignals: {
      domains: ["tesla.com"],
      people: ["Musk", "Ahuja", "Denholm", "Teller", "Viecha", "Gracias"],
    },
    note: "Musk's 2018 'funding secured' tweets; went to a 2023 jury trial → internal Tesla/Musk comms admitted as exhibits.",
  },
  {
    id: "us-v-apple",
    caseName: "United States v. Apple Inc. (Smartphone Antitrust)",
    system: "recap",
    court: "njd", // D. New Jersey
    docketNumber: "2:24-cv-04055",
    knownCompany: "Apple Inc.",
    knownLeaderSlugs: ["tim-cook"],
    hintedTopics: ["competition", "strategy", "product", "app-stores"],
    internalSignals: {
      domains: ["apple.com"],
      people: ["Cook", "Federighi", "Schiller", "Joswiak", "Maestri", "Ternus"],
    },
    note: "DOJ smartphone-monopoly suit (filed 2024, MTD denied 2025). Discovery early — monitored for internal Apple exec-strategy exhibits as they're filed.",
  },
  {
    id: "sec-v-coinbase",
    caseName: "SEC v. Coinbase, Inc.",
    system: "recap",
    court: "nysd", // S.D.N.Y.
    docketNumber: "1:23-cv-04738",
    knownCompany: "Coinbase, Inc.",
    knownLeaderSlugs: [], // brian-armstrong not yet in PERSONS; add if a post surfaces
    hintedTopics: ["policy", "strategy", "finance", "comms"],
    internalSignals: {
      domains: ["coinbase.com"],
      people: ["Armstrong", "Grewal", "Choi", "Haas"],
    },
    note: "SEC token-as-security suit (Armstrong/Grewal). Legal-argument-heavy; monitored for internal exec-strategy exhibits.",
  },
  {
    // Kept to make the RECAP coverage gap explicit. Delaware Chancery is a STATE
    // court — not in PACER/RECAP — so discovery will (correctly) return nothing.
    id: "twitter-v-musk",
    caseName: "Twitter, Inc. v. Musk",
    system: "state",
    docketNumber: "2022-0613-KSJM",
    knownCompany: "Twitter, Inc.",
    knownLeaderSlugs: ["elon-musk"],
    hintedTopics: ["acquisitions", "board-governance", "crisis-management"],
    note: "Delaware Court of Chancery — NOT in RECAP. Needs a separate state e-filing pipeline.",
  },
];

export function getWatchedCase(id: string): WatchedCase | undefined {
  return WATCHED_CASES.find((c) => c.id === id);
}

/**
 * MARQUEE cases — dockets whose exhibits feature founder-recognizable companies
 * and leaders (the ITE-grade set: Meta, Apple, Google, Microsoft, OpenAI/Musk/
 * Altman, Amazon, Uber, Anthropic). Per CHARTER.md "Article Inclusion Spec", the
 * DEFAULT CourtListener discovery sweep — and the alert fingerprints — are pinned
 * to these, so the daily firehose stays high-signal for a founder audience.
 *
 * "Emerging" cases (grocery / ticketing / payments-network antitrust with no
 * founder-famous execs, trials mostly still pending — Kroger-Albertsons, Live
 * Nation, Visa) stay ON the watchlist and remain pullable on demand via
 * `--case=<id>`; they are simply kept OUT of the auto-firehose. Nothing is lost —
 * this is a default-scope narrowing, not a deletion.
 */
export const MARQUEE_CASE_IDS = new Set<string>([
  "ftc-v-meta",
  "epic-v-apple",
  "us-v-google-search",
  "us-v-google-adtech",
  "ftc-v-microsoft-activision",
  "musk-v-altman",
  "waymo-v-uber",
  "ftc-v-amazon-ecommerce",
  "epic-v-google-play",
  "anthropic-v-dod",
  "social-media-adolescent-addiction",
  "in-re-tesla-securities",
  "us-v-apple",
  "sec-v-coinbase",
]);

export function isMarqueeCase(id: string): boolean {
  return MARQUEE_CASE_IDS.has(id);
}

/** Recap cases in the default (marquee-only) discovery scope. */
export function marqueeRecapCases(): WatchedCase[] {
  return WATCHED_CASES.filter((c) => c.system === "recap" && MARQUEE_CASE_IDS.has(c.id));
}
