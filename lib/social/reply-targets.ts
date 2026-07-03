// Curated daily reply targets for The Leadership Letter's reply game.
//
// The reply game is the #1 way a cold account gets discovered: you show up in
// the replies of accounts whose audience is already exactly yours. These are
// grouped by cadence — hit Tier 1 every day; rotate through the rest. For each,
// `fit` names the kind of exhibit in our archive that makes a natural, value-add
// reply (paste one of our card images when it lands).
//
// NOTE: X handles change. Verify a handle resolves before relying on it; update
// here when one moves.

export interface ReplyTarget {
  handle: string; // without the leading @
  name: string;
  why: string; // what they post / why their audience is ours
  fit: string; // which archive angle to reply with
}

export interface TargetGroup {
  title: string;
  cadence: string;
  blurb: string;
  targets: ReplyTarget[];
}

export const REPLY_ROUTINE = {
  goal: "20–30 replies a day",
  how: [
    "Work top-down: reply to every Tier 1 account that posted today, then rotate through Tiers 2–3 until you hit the count.",
    "Add value first — a fact, a receipt, a sharp take. Never 'great post 🙌'. You're a peer, not a fan.",
    "When a real exhibit fits, name it in the reply and attach the card image. Drop the article link only in a follow-up if asked (links suppress reach).",
    "Reply within the first ~30 min of a target's tweet — early replies get seen most.",
  ],
};

export const REPLY_TARGETS: TargetGroup[] = [
  {
    title: "Tier 1 — your exact niche",
    cadence: "every day",
    blurb: "Highest audience overlap. Reply to anything relevant they post, daily.",
    targets: [
      { handle: "TechEmails", name: "Internal Tech Emails", why: "The direct peer (~58k). Their audience IS yours.", fit: "Add context or a related exhibit you have; never repost their image — cite the case and show your own card." },
      { handle: "matthewstoller", name: "Matt Stoller", why: "Big Tech antitrust newsletter; huge, engaged policy audience.", fit: "Your Google / Meta / Amazon / Epic court-exhibit posts — the internal email behind the case he's discussing." },
      { handle: "LeahNylen", name: "Leah Nylen", why: "Antitrust reporter (Bloomberg) covering the exact dockets you source.", fit: "DOJ/FTC trial-exhibit posts — the receipt for the case she's live-tweeting." },
      { handle: "TrungTPhan", name: "Trung Phan", why: "Viral business storytelling; loves a dramatic corporate backstory.", fit: "Any jaw-dropping exec email — the 'holy sh*t they actually wrote this' artifact." },
    ],
  },
  {
    title: "Tier 2 — founders & VCs (leadership audience)",
    cadence: "rotate — 4–6 a day",
    blurb: "Their followers are founders/operators — your subscriber profile.",
    targets: [
      { handle: "paulg", name: "Paul Graham", why: "Founders/leadership; enormous reach.", fit: "Founding-moment / early-strategy emails (the scrappy decision behind a now-giant company)." },
      { handle: "bhorowitz", name: "Ben Horowitz", why: "Writes the book on hard leadership calls.", fit: "Crisis-management / hard-decision correspondence." },
      { handle: "jason", name: "Jason Calacanis", why: "Founder audience, high engagement.", fit: "Fundraising / founder-conflict emails." },
      { handle: "garrytan", name: "Garry Tan", why: "YC president; startup audience.", fit: "Founding-moments, recruiting, early bets." },
      { handle: "davidsacks", name: "David Sacks", why: "Operator/VC; opinionated, high-velocity threads.", fit: "Strategy / competition emails." },
      { handle: "reidhoffman", name: "Reid Hoffman", why: "Scale/strategy thought leadership.", fit: "Partnerships, network-effect, scaling decisions." },
    ],
  },
  {
    title: "Tier 3 — business & tech commentators",
    cadence: "rotate — 4–6 a day",
    blurb: "Broad business/tech timelines — good for reach beyond the VC bubble.",
    targets: [
      { handle: "levie", name: "Aaron Levie", why: "Box CEO; funny, viral tech takes, massive engagement.", fit: "Competition / product-strategy emails with a wry angle." },
      { handle: "dhh", name: "David Heinemeier Hansson", why: "Contrarian on business/management; sparks debate.", fit: "Board-governance, comp, contrarian-strategy correspondence." },
      { handle: "morganhousel", name: "Morgan Housel", why: "Behavior + business wisdom; screenshot-friendly audience.", fit: "Timeless leadership-judgment emails — the lesson layer lands here." },
      { handle: "packyM", name: "Packy McCormick", why: "Tech strategy (Not Boring); analytical audience.", fit: "Strategy / moats / acquisitions emails." },
      { handle: "patrick_oshag", name: "Patrick O'Shaughnessy", why: "Investing/business (Invest Like the Best).", fit: "Capital-allocation, board, finance correspondence." },
    ],
  },
  {
    title: "Tier 4 — subjects & reporters (newsjack)",
    cadence: "opportunistic",
    blurb: "Reply when they're trending or a case is in the news — post the receipt that day.",
    targets: [
      { handle: "CeciliaKang", name: "Cecilia Kang", why: "NYT tech-policy reporter; antitrust coverage.", fit: "The exhibit behind whatever case she's reporting." },
      { handle: "bobbyallyn", name: "Bobby Allyn", why: "NPR tech reporter; big-tech legal stories.", fit: "Court-exhibit posts matching the day's story." },
      { handle: "elonmusk", name: "Elon Musk", why: "Subject + massive reach; risky but high-ceiling.", fit: "Musk v. Altman / Tesla / X emails — the receipt when he's mid-argument." },
      { handle: "satyanadella", name: "Satya Nadella", why: "Subject; measured audience.", fit: "Microsoft / OpenAI correspondence when relevant news breaks." },
    ],
  },
];
