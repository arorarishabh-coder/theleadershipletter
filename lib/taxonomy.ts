// Browse taxonomy — the COMPANY / PERSON / TOPIC facets surfaced in the Filters
// panel (mirrors the Internal Tech Emails reference). Topics live in mock-data
// (they carry blurbs); companies and persons are defined here.

export interface Company {
  slug: string;
  name: string;
  /** Lowercase aliases matched against a post's authorsCompany string. */
  aliases?: string[];
}

export interface Person {
  slug: string;
  name: string;
  companies?: string[];
  era?: string;
  bio?: string;
}

export const COMPANIES: Company[] = [
  { slug: "apple", name: "Apple", aliases: ["apple"] },
  { slug: "microsoft", name: "Microsoft", aliases: ["microsoft"] },
  { slug: "meta", name: "Meta", aliases: ["meta", "facebook"] },
  { slug: "google", name: "Google", aliases: ["google", "alphabet"] },
  { slug: "openai", name: "OpenAI", aliases: ["openai"] },
  { slug: "twitter", name: "Twitter", aliases: ["twitter", "x corp", "x.com"] },
  { slug: "tesla", name: "Tesla", aliases: ["tesla"] },
  { slug: "instagram", name: "Instagram", aliases: ["instagram"] },
  { slug: "theranos", name: "Theranos", aliases: ["theranos"] },
  { slug: "ftx", name: "FTX", aliases: ["ftx", "alameda"] },
  { slug: "amazon", name: "Amazon", aliases: ["amazon"] },
  { slug: "youtube", name: "YouTube", aliases: ["youtube"] },
  { slug: "uber", name: "Uber", aliases: ["uber"] },
  { slug: "snap", name: "Snap", aliases: ["snap", "snapchat"] },
  { slug: "epic-games", name: "Epic Games", aliases: ["epic games", "epic"] },
  { slug: "sequoia", name: "Sequoia", aliases: ["sequoia"] },
  { slug: "whatsapp", name: "WhatsApp", aliases: ["whatsapp"] },
  { slug: "sony", name: "Sony", aliases: ["sony"] },
  { slug: "iac", name: "IAC", aliases: ["iac"] },
  { slug: "samsung", name: "Samsung", aliases: ["samsung"] },
  { slug: "oracle", name: "Oracle", aliases: ["oracle"] },
  { slug: "waymo", name: "Waymo", aliases: ["waymo"] },
  { slug: "netflix", name: "Netflix", aliases: ["netflix"] },
  { slug: "airbnb", name: "Airbnb", aliases: ["airbnb"] },
  { slug: "nvidia", name: "Nvidia", aliases: ["nvidia"] },
  { slug: "anthropic", name: "Anthropic", aliases: ["anthropic"] },
  { slug: "berkshire-hathaway", name: "Berkshire Hathaway", aliases: ["berkshire"] },
  { slug: "mozilla", name: "Mozilla", aliases: ["mozilla", "firefox"] },
  // Added 2026-06-25 alongside the new EDGAR marquee letter-writers.
  { slug: "block", name: "Block (Square)", aliases: ["block", "square"] },
  { slug: "doordash", name: "DoorDash", aliases: ["doordash"] },
  { slug: "roku", name: "Roku", aliases: ["roku"] },
  { slug: "pinterest", name: "Pinterest", aliases: ["pinterest"] },
  // Added 2026-07-02 — de-orphan the EDGAR shareholder-letter batch's facets.
  { slug: "hippo", name: "Hippo Holdings", aliases: ["hippo"] },
  { slug: "dsp-group", name: "DSP Group", aliases: ["dsp group"] },
];

export const PERSONS: Person[] = [
  { slug: "dario-amodei", name: "Dario Amodei", companies: ["Anthropic"], era: "2021–present", bio: "Co-founder and CEO of Anthropic. His correspondence with the U.S. Department of War over AI-use guardrails — barring fully autonomous weapons and domestic surveillance — surfaced as exhibits in Anthropic PBC v. U.S. Department of War, a rare public record of a frontier-AI CEO negotiating red lines with the government." },
  { slug: "elon-musk", name: "Elon Musk", companies: ["Tesla", "SpaceX", "X", "OpenAI"], era: "1999–present", bio: "CEO of Tesla and SpaceX and owner of X (formerly Twitter). Co-founded OpenAI in 2015 and later broke with and sued it — correspondence from that fight is among the richest primary-source records of how he negotiates and wields leverage." },
  { slug: "mark-zuckerberg", name: "Mark Zuckerberg", companies: ["Meta (Facebook)"], era: "2004–present", bio: "Founder and CEO of Facebook/Meta. His internal correspondence, surfaced through the FTC antitrust case, the House Antitrust report, and the Six4Three cache, is one of the most complete records of any modern executive's strategic thinking." },
  { slug: "phil-schiller", name: "Phil Schiller", companies: ["Apple"], era: "1987–present", bio: "Long-time Apple executive and former marketing chief, now an Apple Fellow overseeing the App Store. His emails feature heavily in Epic v. Apple, revealing how Apple reasoned about App Store rules and economics." },
  { slug: "steve-jobs", name: "Steve Jobs", companies: ["Apple", "Pixar", "NeXT"], era: "1976–2011", bio: "Co-founder and CEO of Apple, co-founder of Pixar, and founder of NeXT. His emails appear across antitrust and patent litigation, offering a rare look at his negotiating style and product convictions." },
  { slug: "sam-altman", name: "Sam Altman", companies: ["OpenAI", "Y Combinator"], era: "2014–present", bio: "CEO of OpenAI and former president of Y Combinator. The Musk v. Altman litigation and the 2023 board crisis exposed his correspondence on OpenAI's founding bargain, governance, and the Microsoft partnership." },
  { slug: "tim-cook", name: "Tim Cook", companies: ["Apple"], era: "2011–present", bio: "CEO of Apple since 2011. His communications surface in Epic v. Apple and other antitrust matters, modeling unusually disciplined executive writing built for a hostile reader." },
  { slug: "bill-gates", name: "Bill Gates", companies: ["Microsoft"], era: "1975–2008", bio: "Co-founder of Microsoft, which he led as CEO and chairman. His emails from U.S. v. Microsoft are foundational case studies in how internal candor becomes antitrust evidence." },
  { slug: "satya-nadella", name: "Satya Nadella", companies: ["Microsoft"], era: "2014–present", bio: "Chairman and CEO of Microsoft. Most of his surviving memos surface through press leaks and the FTC v. Microsoft/Activision proceedings; a model of institutional, dual-audience communication." },
  { slug: "sam-bankman-fried", name: "Sam Bankman-Fried", companies: ["FTX", "Alameda Research"], era: "2017–2022", bio: "Founder of the crypto exchange FTX and trading firm Alameda Research, convicted of fraud in 2023. The bankruptcy and criminal proceedings exposed extensive internal correspondence on governance failures." },
  { slug: "kevin-scott", name: "Kevin Scott", companies: ["Microsoft"], era: "2017–present", bio: "Chief Technology Officer of Microsoft, central to its AI strategy and the OpenAI partnership. His correspondence appears in the Musk v. Altman exhibits around the Microsoft–OpenAI deal." },
  { slug: "elizabeth-holmes", name: "Elizabeth Holmes", companies: ["Theranos"], era: "2003–2018", bio: "Founder and CEO of Theranos, convicted of fraud in 2022. Trial exhibits surfaced internal communications that became a defining case study in misleading stakeholders." },
  { slug: "eddy-cue", name: "Eddy Cue", companies: ["Apple"], era: "1989–present", bio: "Senior Vice President of Services at Apple, responsible for deals including the Google search default. His emails are central to U.S. v. Google and Epic v. Apple." },
  { slug: "scott-forstall", name: "Scott Forstall", companies: ["Apple"], era: "1997–2012", bio: "Former Apple executive who led iOS software development until 2012. His correspondence appears in Apple's patent and antitrust litigation from the early iPhone era." },
  { slug: "sheryl-sandberg", name: "Sheryl Sandberg", companies: ["Meta (Facebook)", "Google"], era: "2008–2022", bio: "Former COO of Facebook/Meta and earlier a Google ads executive. Her internal communications surface in the FTC v. Meta antitrust record." },
  { slug: "eric-schmidt", name: "Eric Schmidt", companies: ["Google"], era: "2001–2017", bio: "Former CEO and executive chairman of Google. His emails appear across Google's antitrust litigation, revealing how the company reasoned about search defaults and competition." },
  { slug: "jim-allchin", name: "Jim Allchin", companies: ["Microsoft"], era: "1990–2007", bio: "Former Microsoft executive who led Windows development. His blunt internal emails were prominent exhibits in U.S. v. Microsoft." },
  { slug: "greg-brockman", name: "Greg Brockman", companies: ["OpenAI", "Stripe"], era: "2015–present", bio: "Co-founder and president of OpenAI and former CTO of Stripe. The Musk v. Altman exhibits include his correspondence on OpenAI's founding, structure, and compute strategy." },
  { slug: "jack-dorsey", name: "Jack Dorsey", companies: ["Twitter", "Block (Square)"], era: "2006–present", bio: "Co-founder and former CEO of Twitter and founder of Block (Square). His communications appear in the Twitter acquisition saga and platform-governance debates." },
  { slug: "larry-page", name: "Larry Page", companies: ["Google", "Alphabet"], era: "1998–present", bio: "Co-founder of Google and former CEO of Google and Alphabet. His early strategic correspondence surfaces in Google's antitrust and trade-secret litigation." },
  { slug: "sundar-pichai", name: "Sundar Pichai", companies: ["Google", "Alphabet"], era: "2004–present", bio: "CEO of Google (since 2015) and Alphabet (since 2019). His emails are central to U.S. v. Google, covering search-default economics and product strategy." },
  { slug: "neal-mohan", name: "Neal Mohan", companies: ["Google", "YouTube"], era: "2008–present", bio: "CEO of YouTube since 2023. As Google's longtime display- and video-ads leader (ex-DoubleClick), his internal ad-tech emails are central exhibits in U.S. v. Google (Ad Tech), covering display strategy, header bidding, and platform pricing." },
  { slug: "barry-diller", name: "Barry Diller", companies: ["IAC", "Expedia Group"], era: "1966–present", bio: "Media executive and chairman of IAC and Expedia Group, with earlier leadership at Paramount and Fox. His correspondence offers a long view on dealmaking and media strategy." },
  { slug: "peter-thiel", name: "Peter Thiel", companies: ["PayPal", "Palantir", "Founders Fund"], era: "1998–present", bio: "Co-founder of PayPal and Palantir and a prominent venture capitalist (Founders Fund); an early Facebook investor and board member. His correspondence appears in startup and platform litigation." },
  { slug: "larry-ellison", name: "Larry Ellison", companies: ["Oracle"], era: "1977–present", bio: "Co-founder, chairman, and CTO of Oracle and its former long-time CEO. His correspondence surfaces in Oracle's high-profile litigation, including against Google." },
  { slug: "mira-murati", name: "Mira Murati", companies: ["OpenAI"], era: "2018–present", bio: "Former Chief Technology Officer of OpenAI, central to its product and research leadership during the period covered by the Musk v. Altman exhibits." },
  { slug: "jeff-bezos", name: "Jeff Bezos", companies: ["Amazon", "Blue Origin", "The Washington Post"], era: "1994–present", bio: "Founder of Amazon, who wrote 24 consecutive annual shareholder letters that became required reading for a generation of operators. Also founded Blue Origin and owns The Washington Post." },
  { slug: "jensen-huang", name: "Jensen Huang", companies: ["Nvidia"], era: "1993–present", bio: "Co-founder and CEO of Nvidia, which he has led since its founding. His communications offer a window into long-horizon bets on computing platforms." },
  { slug: "warren-buffett", name: "Warren Buffett", companies: ["Berkshire Hathaway"], era: "1965–present", bio: "Chairman and CEO of Berkshire Hathaway since 1965. His annual letters to shareholders are among the most widely studied documents in business — plain-spoken master classes in capital allocation, incentives, and long-term thinking." },
  { slug: "andy-jassy", name: "Andy Jassy", companies: ["Amazon", "AWS"], era: "1997–present", bio: "CEO of Amazon since 2021, having founded and built Amazon Web Services into the company's profit engine. His shareholder letters continue Amazon's tradition of explaining the operating philosophy behind the numbers." },
  { slug: "reed-hastings", name: "Reed Hastings", companies: ["Netflix"], era: "1997–present", bio: "Co-founder of Netflix and its CEO from 1997 to 2023, now executive chairman. The quarterly shareholder letters he co-authored are unusually candid about strategy, competition, and the company's own mistakes." },
  { slug: "ted-sarandos", name: "Ted Sarandos", companies: ["Netflix"], era: "2000–present", bio: "Co-CEO of Netflix and its long-time chief content officer, who built the content strategy that turned the company into a global studio. Co-authors its shareholder letters." },
  { slug: "greg-peters", name: "Greg Peters", companies: ["Netflix"], era: "2008–present", bio: "Co-CEO of Netflix, previously its chief operating and product officer, central to the ad-supported tier and pricing strategy. Co-authors its shareholder letters." },
];

export function getCompanyBySlug(slug: string): Company | undefined {
  return COMPANIES.find((c) => c.slug === slug);
}

export function getPersonBySlug(slug: string): Person | undefined {
  return PERSONS.find((p) => p.slug === slug);
}

/** Does a post's authorsCompany string belong to this company facet? */
export function companyMatches(company: Company, authorsCompany: string): boolean {
  const hay = authorsCompany.toLowerCase();
  return (company.aliases ?? [company.name.toLowerCase()]).some((a) => hay.includes(a));
}
