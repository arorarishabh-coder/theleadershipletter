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
