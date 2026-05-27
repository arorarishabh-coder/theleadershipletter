import type { PostTopic } from "@/lib/types";
import type { SourceDocument } from "./types";

// ---------- Multi-exhibit PDF helper ----------
// For large parent documents (e.g. the House Antitrust 2020 Report — 449 pages
// containing hundreds of internal-email exhibits), each exhibit becomes its own
// SourceDocument with a pdfPageRange so the pipeline ingests it as a standalone post.

interface ExhibitInParent {
  id: string;
  pdfPageRange: [number, number];
  documentTitle: string;
  knownAuthors: string[];
  knownLeaderSlugs: string[];
  knownCompany: string;
  recipientNames: string[];
  dateAuthored: string;
  hintedTopics?: PostTopic[];
}

interface ParentPdf {
  url: string;
  fetchUrl?: string;
  sourceCase: string;
  baseCitation: string;
}

function expandExhibits(parent: ParentPdf, exhibits: ExhibitInParent[]): SourceDocument[] {
  return exhibits.map((e) => ({
    id: e.id,
    url: parent.url,
    fetchUrl: parent.fetchUrl,
    documentTitle: e.documentTitle,
    knownAuthors: e.knownAuthors,
    knownLeaderSlugs: e.knownLeaderSlugs,
    knownCompany: e.knownCompany,
    recipientNames: e.recipientNames,
    dateAuthored: e.dateAuthored,
    sourceType: "congress",
    sourceCase: parent.sourceCase,
    sourceCitation: `${parent.baseCitation} (pp. ${e.pdfPageRange[0]}-${e.pdfPageRange[1]})`,
    licensingPath: "public_domain",
    hintedTopics: e.hintedTopics,
    pdfPageRange: e.pdfPageRange,
  }));
}

// ---------- House Antitrust 2020 Report exhibits ----------
//
// Parent: 449-page "Investigation of Competition in Digital Markets" final
// report, U.S. House Judiciary Subcommittee on Antitrust, October 2020.
// Contains hundreds of internal-email exhibits from Facebook, Google, Amazon,
// and Apple executives.
//
// NOTE ON PAGE RANGES: The structural layout is known (Facebook section
// roughly pp. 130-200, Google ~200-280, Amazon ~270-340, Apple ~340-440), but
// the *exact* page of each named exhibit below is my best estimate and may be
// off by ±10 pages. Wider ranges below give the triage stage enough context to
// identify the relevant excerpt even if the page is slightly off. After the
// first live ingest, read the extracted text and tighten the ranges.
//
// PRIMARY URL: govinfo.gov hosts the official Congressional Print
// (CPRT-117HPRT47832). If it 404s, set fetchUrl to a Wayback Machine mirror.
const HOUSE_ANTITRUST_2020: ParentPdf = {
  url: "https://www.govinfo.gov/content/pkg/CPRT-117HPRT47832/pdf/CPRT-117HPRT47832.pdf",
  sourceCase: "U.S. House Subcommittee on Antitrust — Investigation of Competition in Digital Markets",
  baseCitation: "Final Report, October 2020 (Congressional Print 117-HPRT-47832)",
};

const HOUSE_ANTITRUST_EXHIBITS: ExhibitInParent[] = [
  {
    id: "house-2020-zuck-buy-vs-compete",
    pdfPageRange: [135, 150],
    documentTitle: "Zuckerberg–Ebersman Email — \"It is better to buy than compete\" (Feb 2012)",
    knownAuthors: ["Mark Zuckerberg"],
    knownLeaderSlugs: ["mark-zuckerberg"],
    knownCompany: "Facebook, Inc.",
    recipientNames: ["David Ebersman"],
    dateAuthored: "2012-02-28",
    hintedTopics: ["acquisitions", "competition", "strategy"],
  },
  {
    id: "house-2020-zuck-instagram-threat",
    pdfPageRange: [150, 165],
    documentTitle: "Zuckerberg Internal Discussion of Instagram as Competitive Threat",
    knownAuthors: ["Mark Zuckerberg"],
    knownLeaderSlugs: ["mark-zuckerberg"],
    knownCompany: "Facebook, Inc.",
    recipientNames: ["Facebook senior leadership"],
    dateAuthored: "2012-04-09",
    hintedTopics: ["acquisitions", "competition", "strategy"],
  },
  {
    id: "house-2020-google-search-defaults",
    pdfPageRange: [200, 220],
    documentTitle: "Google Internal Correspondence on Search Default Deals",
    knownAuthors: ["Google search leadership"],
    knownLeaderSlugs: [],
    knownCompany: "Google LLC",
    recipientNames: ["Google internal"],
    dateAuthored: "2014-01-01",
    hintedTopics: ["strategy", "competition", "board-governance"],
  },
  {
    id: "house-2020-amazon-third-party-sellers",
    pdfPageRange: [275, 295],
    documentTitle: "Amazon Internal Correspondence on Third-Party Seller Data Use",
    knownAuthors: ["Amazon Marketplace leadership"],
    knownLeaderSlugs: [],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Amazon internal"],
    dateAuthored: "2015-01-01",
    hintedTopics: ["strategy", "competition", "comms"],
  },
  {
    id: "house-2020-apple-app-store",
    pdfPageRange: [355, 375],
    documentTitle: "Apple Internal Correspondence on App Store Review & Commission",
    knownAuthors: ["Apple App Store leadership"],
    knownLeaderSlugs: [],
    knownCompany: "Apple Inc.",
    recipientNames: ["Apple internal"],
    dateAuthored: "2017-01-01",
    hintedTopics: ["strategy", "competition", "product"],
  },
];



// Curated registry of source documents to ingest. Add new entries here as the
// archive grows; the pipeline picks them up on the next run.
//
// Editorial discipline: every entry must have a verifiable public URL.
// Hand-curated topics (`hintedTopics`) are advisory — the triage stage may
// refine them based on actual content.

export const SOURCE_DOCUMENTS: SourceDocument[] = [
  // ---- Jeff Bezos · Amazon shareholder letters ----
  {
    id: "bezos-2002-cash-flow",
    url: "https://www.aboutamazon.com/news/company-news/2002-letter-to-shareholders",
    documentTitle: "2002 Letter to Shareholders — Free Cash Flow",
    knownAuthors: ["Jeff Bezos"],
    knownLeaderSlugs: ["jeff-bezos"],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2003-04-01",
    sourceType: "self_published",
    sourceCase: "Amazon 2002 Annual Report",
    sourceCitation: "Letter to Shareholders, 2002",
    licensingPath: "self_published",
    hintedTopics: ["strategy", "board-governance"],
  },
  {
    id: "bezos-2014-failure",
    url: "https://www.aboutamazon.com/news/company-news/2014-letter-to-shareholders",
    documentTitle: "2014 Letter to Shareholders — On Failure and Invention",
    knownAuthors: ["Jeff Bezos"],
    knownLeaderSlugs: ["jeff-bezos"],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2015-04-05",
    sourceType: "self_published",
    sourceCase: "Amazon 2014 Annual Report",
    sourceCitation: "Letter to Shareholders, 2014",
    licensingPath: "self_published",
    hintedTopics: ["strategy", "product"],
  },
  {
    id: "bezos-2016-day-one",
    url: "https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders",
    documentTitle: "2016 Letter to Shareholders — Day One Mentality",
    knownAuthors: ["Jeff Bezos"],
    knownLeaderSlugs: ["jeff-bezos"],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2017-04-12",
    sourceType: "self_published",
    sourceCase: "Amazon 2016 Annual Report",
    sourceCitation: "Letter to Shareholders, 2016",
    licensingPath: "self_published",
    hintedTopics: ["strategy", "comms"],
  },
  {
    id: "bezos-2018-high-standards",
    url: "https://www.aboutamazon.com/news/company-news/2017-letter-to-shareholders",
    documentTitle: "2017 Letter to Shareholders — Imposing High Standards",
    knownAuthors: ["Jeff Bezos"],
    knownLeaderSlugs: ["jeff-bezos"],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2018-04-18",
    sourceType: "self_published",
    sourceCase: "Amazon 2017 Annual Report",
    sourceCitation: "Letter to Shareholders, 2017",
    licensingPath: "self_published",
    hintedTopics: ["recruiting", "strategy"],
  },

  // ---- Warren Buffett · Berkshire Hathaway letters ----
  {
    id: "buffett-2001-derivatives",
    url: "https://www.berkshirehathaway.com/letters/2002pdf.pdf",
    documentTitle: "2002 Letter to Shareholders — Derivatives as Weapons of Mass Destruction",
    knownAuthors: ["Warren Buffett"],
    knownLeaderSlugs: ["warren-buffett"],
    knownCompany: "Berkshire Hathaway, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2003-02-21",
    sourceType: "self_published",
    sourceCase: "Berkshire Hathaway 2002 Annual Report",
    sourceCitation: "Letter to Shareholders, 2002",
    licensingPath: "self_published",
    hintedTopics: ["crisis-management", "strategy"],
  },
  {
    id: "buffett-2014-50year",
    url: "https://www.berkshirehathaway.com/letters/2014ltr.pdf",
    documentTitle: "2014 Letter — Berkshire Past, Present and Future (50-Year Retrospective)",
    knownAuthors: ["Warren Buffett", "Charlie Munger"],
    knownLeaderSlugs: ["warren-buffett"],
    knownCompany: "Berkshire Hathaway, Inc.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2015-02-27",
    sourceType: "self_published",
    sourceCase: "Berkshire Hathaway 2014 Annual Report",
    sourceCitation: "Letter to Shareholders, 2014",
    licensingPath: "self_published",
    hintedTopics: ["leadership-transitions", "board-governance", "strategy"],
  },

  // ---- Reed Hastings · Netflix ----
  {
    id: "hastings-2009-culture-deck",
    url: "https://www.slideshare.net/reed2001/culture-1798664",
    documentTitle: "Netflix Culture: Freedom & Responsibility (2009)",
    knownAuthors: ["Reed Hastings"],
    knownLeaderSlugs: ["reed-hastings"],
    knownCompany: "Netflix",
    recipientNames: ["Employees", "Prospective Employees"],
    dateAuthored: "2009-08-01",
    sourceType: "self_published",
    sourceCase: "Netflix Culture Deck (public)",
    sourceCitation: "Netflix Culture Deck, August 2009",
    licensingPath: "self_published",
    hintedTopics: ["recruiting", "comms"],
  },

  // ---- Jamie Dimon · JPMorgan letters ----
  {
    id: "dimon-2008-financial-crisis",
    url: "https://www.jpmorganchase.com/ir/annual-report/2008",
    documentTitle: "2008 Letter to Shareholders — Through the Financial Crisis",
    knownAuthors: ["Jamie Dimon"],
    knownLeaderSlugs: [],
    knownCompany: "JPMorgan Chase & Co.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2009-03-23",
    sourceType: "self_published",
    sourceCase: "JPMorgan Chase 2008 Annual Report",
    sourceCitation: "Letter to Shareholders, 2008",
    licensingPath: "self_published",
    hintedTopics: ["crisis-management", "board-governance"],
  },
  {
    id: "dimon-2020-pandemic",
    url: "https://reports.jpmorganchase.com/investor-relations/2020/ar-ceo-letters.htm",
    documentTitle: "2020 Letter to Shareholders — Pandemic Response",
    knownAuthors: ["Jamie Dimon"],
    knownLeaderSlugs: [],
    knownCompany: "JPMorgan Chase & Co.",
    recipientNames: ["Shareholders"],
    dateAuthored: "2021-04-07",
    sourceType: "self_published",
    sourceCase: "JPMorgan Chase 2020 Annual Report",
    sourceCitation: "Letter to Shareholders, 2020",
    licensingPath: "self_published",
    hintedTopics: ["crisis-management", "strategy"],
  },

  // ---- Brian Armstrong · Coinbase ----
  {
    id: "armstrong-2020-mission-focused",
    url: "https://www.coinbase.com/blog/coinbase-is-a-mission-focused-company",
    documentTitle: "Coinbase Is a Mission-Focused Company (2020)",
    knownAuthors: ["Brian Armstrong"],
    knownLeaderSlugs: [],
    knownCompany: "Coinbase",
    recipientNames: ["Employees"],
    dateAuthored: "2020-09-27",
    sourceType: "self_published",
    sourceCase: "Coinbase Corporate Blog",
    sourceCitation: "Brian Armstrong, 27 September 2020",
    licensingPath: "self_published",
    hintedTopics: ["comms", "recruiting"],
  },

  // ---- Patrick Collison · Stripe ----
  {
    id: "collison-2022-annual-letter",
    url: "https://stripe.com/newsroom/news/2022-update-from-the-ceo",
    documentTitle: "2022 Update from the CEO",
    knownAuthors: ["Patrick Collison"],
    knownLeaderSlugs: [],
    knownCompany: "Stripe",
    recipientNames: ["Stakeholders"],
    dateAuthored: "2022-11-03",
    sourceType: "self_published",
    sourceCase: "Stripe Newsroom",
    sourceCitation: "Patrick Collison, 3 November 2022",
    licensingPath: "self_published",
    hintedTopics: ["comms", "strategy"],
  },

  // ---- Matthew Prince · Cloudflare ----
  {
    id: "prince-2022-kiwi-farms",
    url: "https://blog.cloudflare.com/kiwifarms-blocked/",
    documentTitle: "Blocking Kiwifarms (2022)",
    knownAuthors: ["Matthew Prince"],
    knownLeaderSlugs: [],
    knownCompany: "Cloudflare",
    recipientNames: ["Customers", "Public"],
    dateAuthored: "2022-09-03",
    sourceType: "self_published",
    sourceCase: "Cloudflare Corporate Blog",
    sourceCitation: "Matthew Prince, 3 September 2022",
    licensingPath: "self_published",
    hintedTopics: ["crisis-management", "board-governance"],
  },

  // ---- Andy Jassy · Amazon (layoffs memo) ----
  {
    id: "jassy-2023-layoffs",
    url: "https://www.aboutamazon.com/news/company-news/amazon-layoffs",
    documentTitle: "Update on Role Eliminations (2023 Layoffs Memo)",
    knownAuthors: ["Andy Jassy"],
    knownLeaderSlugs: [],
    knownCompany: "Amazon.com, Inc.",
    recipientNames: ["Amazon Employees"],
    dateAuthored: "2023-01-04",
    sourceType: "self_published",
    sourceCase: "About Amazon · Corporate News",
    sourceCitation: "Andy Jassy, 4 January 2023",
    licensingPath: "self_published",
    hintedTopics: ["comms", "crisis-management"],
  },

  // ---- Mark Zuckerberg · "Year of Efficiency" memo ----
  {
    id: "zuck-2023-year-of-efficiency",
    url: "https://about.fb.com/news/2023/03/mark-zuckerberg-meta-year-of-efficiency/",
    documentTitle: "Year of Efficiency — Update (March 2023)",
    knownAuthors: ["Mark Zuckerberg"],
    knownLeaderSlugs: ["mark-zuckerberg"],
    knownCompany: "Meta Platforms",
    recipientNames: ["Meta Employees"],
    dateAuthored: "2023-03-14",
    sourceType: "self_published",
    sourceCase: "Meta Corporate Newsroom",
    sourceCitation: "Mark Zuckerberg, 14 March 2023",
    licensingPath: "self_published",
    hintedTopics: ["comms", "strategy", "comms"],
  },

  // ---- Satya Nadella · 2014 reset memo ----
  {
    id: "nadella-2014-bold-ambition",
    url: "https://news.microsoft.com/2014/07/10/bold-ambition-our-core/",
    documentTitle: "Bold Ambition & Our Core (2014 Reset Memo)",
    knownAuthors: ["Satya Nadella"],
    knownLeaderSlugs: ["satya-nadella"],
    knownCompany: "Microsoft",
    recipientNames: ["Microsoft Employees"],
    dateAuthored: "2014-07-10",
    sourceType: "self_published",
    sourceCase: "Microsoft Corporate News",
    sourceCitation: "Satya Nadella, 10 July 2014",
    licensingPath: "self_published",
    hintedTopics: ["strategy", "leadership-transitions", "comms"],
  },

  // ---- House Antitrust 2020 Report — multi-exhibit PDF ----
  // 5 exhibits extracted from the 449-page Big Tech antitrust investigation.
  // See HOUSE_ANTITRUST_EXHIBITS above for page-range caveats.
  ...expandExhibits(HOUSE_ANTITRUST_2020, HOUSE_ANTITRUST_EXHIBITS),
];

export function getSourceById(id: string): SourceDocument | undefined {
  return SOURCE_DOCUMENTS.find((s) => s.id === id);
}
