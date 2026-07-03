// Shared types for the UI layer. Mirrors prisma schema until we wire DB.

export type SourceType =
  | "sec_edgar"
  | "court_exhibit"
  | "congress"
  | "foreign_gov"
  | "self_published"
  | "press_quoted";

export type LicensingPath = "public_domain" | "self_published" | "fair_use_excerpt";

export type PostTopic =
  | "competition"
  | "product"
  | "acquisitions"
  | "app-stores"
  | "ai"
  | "strategy"
  | "partnerships"
  | "crisis-management"
  | "fundraising"
  | "comms"
  | "technology"
  | "board-governance"
  | "leadership-transitions"
  | "recruiting"
  | "founding-moments"
  | "finance"
  | "policy";

export interface PostScreenshot {
  url: string;
  caption: string;
  alt: string;
}

/** One turn in a chat/message-thread exhibit (WhatsApp/SMS/Slack). */
export interface MessageTurn {
  sender: string; // display name or masked handle as shown, e.g. "Mark Zuckerberg" / "[redacted]@s.whatsapp.net"
  text: string;
}

export interface Post {
  slug: string;
  publishedAt: string;
  isFeatured: boolean;

  // From Document
  title: string;
  documentTitle: string;
  dateAuthored: string;
  authorsName: string[];
  authorsCompany: string;
  recipientNames: string[];
  topics: PostTopic[];
  leaderSlugs: string[];
  excerptForBlog: string;
  // When the source is a chat/message thread (WhatsApp, SMS/iMessage, Slack),
  // the excerpt is ALSO captured as ordered turns so we can render it as a clean
  // sender-labeled card (see lib/social/carousel-pdf.ts) instead of a screenshot.
  messageThread?: MessageTurn[];
  screenshots: PostScreenshot[];
  sourceType: SourceType;
  sourceUrl: string;
  sourceCase: string;
  sourceCitation: string;
  licensingPath: LicensingPath;
  // Provenance: how the body text was obtained. "ocr_transcribed" = the document
  // was a scanned image and the text is a Claude transcription of the public-record
  // PDF (may contain transcription errors; flag for editorial review).
  textSource?: "extracted" | "ocr_transcribed";
  // Newsletter publishing state. beehiivPostId is legacy (Beehiiv); resendBroadcastId
  // is the current delivery path (Resend Broadcasts). newsletterSentAt = last send.
  beehiivPostId?: string;
  resendBroadcastId?: string;
  newsletterSentAt?: string;

  // From Analysis
  // "artifact" = the Notable Artifact lane: a historically iconic exchange that
  // doesn't yield a transferable lesson but is worth publishing for the moment it
  // captures. Renders a short "Why this matters" note instead of situation/
  // insight/application. Undefined/"lesson" = the standard lesson-driven post.
  postKind?: "lesson" | "artifact";
  /** For postKind==="artifact": 2-4 sentences on why this exchange is notable. */
  artifactNote?: string;
  lessonTitle: string;
  // Lean, scannable analysis — three labeled sections that replace the old dense
  // markdown body. Rendered under "The situation" / "The lesson" / "Put it to work".
  // Optional only so legacy seed posts (lib/mock-data) still type-check; the
  // content-QA gate requires all three on every generated post, and the renderer
  // falls back to lessonBody when they're absent.
  situation?: string; // what's happening, in plain English (2–3 sentences)
  insight?: string; // the lesson — what the document reveals (1–2 short paragraphs)
  application?: string; // how to apply it — a short, practical paragraph
  /**
   * @deprecated Legacy dense markdown analysis. Superseded by situation/insight/
   * application. Kept for any not-yet-migrated post.
   */
  lessonBody?: string;
  pullQuote: string;
  leadershipTraits: string[];
}

export interface Leader {
  slug: string;
  name: string;
  companies: string[];
  era: string;
  bio: string;
  portraitUrl?: string;
}

export interface Topic {
  slug: PostTopic;
  label: string;
  blurb: string;
}
