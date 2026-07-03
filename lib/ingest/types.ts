import type { LicensingPath, PostTopic, SourceType } from "@/lib/types";

export interface SourceDocument {
  id: string;                  // unique stable identifier (becomes slug base)
  url: string;                 // canonical public URL
  fetchUrl?: string;           // optional alternate URL if canonical is bot-blocked
  documentTitle: string;
  knownAuthors: string[];      // ["Jeff Bezos"]
  knownLeaderSlugs: string[];  // ["jeff-bezos"]
  knownCompany: string;
  recipientNames: string[];
  dateAuthored: string;        // ISO date
  sourceType: SourceType;
  sourceCase: string;
  sourceCitation: string;
  licensingPath: LicensingPath;
  // Hints — pipeline will verify/refine but these speed triage
  hintedTopics?: PostTopic[];
  // Optional CSS selector or text marker for the relevant excerpt within the page
  excerptMarker?: string;
  // For multi-exhibit PDFs (e.g. House Antitrust Report): extract only these pages.
  // [startPage, endPage] inclusive, 1-indexed against PDF physical pages.
  pdfPageRange?: [number, number];
}

export interface FetchResult {
  url: string;
  status: "ok" | "fail";
  httpCode?: number;
  text?: string;
  rawHtml?: string;
  bytes?: number;
  error?: string;
}

export type RejectCategory =
  | "procedural_or_legal"
  | "logistics_or_scheduling"
  | "boilerplate_or_press_release"
  | "not_correspondence"
  | "off_theme"
  | "no_transferable_lesson"
  | "too_thin";

export interface RelevanceResult {
  isInternalCorrespondence: boolean;
  onTheme: boolean;
  themeFitScore: number; // 0-10
  lessonClarity: number; // 0-10
  leadershipSignal: number; // 0-10
  candidateLesson: string; // one sentence, or "" if none
  rejectCategory: RejectCategory | null;
  topics: PostTopic[];
  estimatedAuthors: string[];
  estimatedDate: string;
  estimatedCompany: string;
  reason: string;
}

export interface EnrichResult {
  authors: string[];
  recipients: string[];
  dateAuthored: string;
  topics: PostTopic[];
  excerptForBlog: string;
  documentTitleCleaned: string;
  fairUseCompliant: boolean;
  excerptWordCount: number;
  /** "thread" when the document is a chat/message exchange (WhatsApp/SMS/Slack). */
  docKind?: "email" | "letter" | "thread";
  /** For docKind==="thread": the excerpt as ordered sender-labeled turns. */
  messageThread?: { sender: string; text: string }[];
}

export interface LessonResult {
  lessonTitle: string;
  pullQuote: string;
  situation: string;
  insight: string;
  application: string;
  leadershipTraits: string[];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

export interface PipelineResult {
  sourceId: string;
  ok: boolean;
  outputPath?: string;
  postSlug?: string;
  failureStage?: "fetch" | "relevance" | "enrich" | "lesson" | "render" | "save";
  error?: string;
  /** When rejected at the relevance gate, the category + the lesson the gate looked for. */
  rejectCategory?: RejectCategory | null;
  /** Set when the document was skipped without processing — currently only
   *  "exists" (a post with this slug is already on disk; dedup guard). */
  skipped?: "exists";
}

export interface PipelineOptions {
  dryRun?: boolean;
  forceRefresh?: boolean;
  limit?: number;
  onlyIds?: string[];
  /** Explicit documents to process. When set, the static registry is bypassed
   *  (used by the RECAP discovery layer to feed candidates straight in). */
  sources?: SourceDocument[];
  /** Run only through the relevance gate (fetch → OCR → gate) and report the
   *  decision, without spending on enrich/lesson. Cheap screening of a big batch. */
  gateOnly?: boolean;
  /** Relevance-gate thresholds (0-10). Default 6 each. Raise for a stricter feed. */
  minThemeFit?: number;
  minLessonClarity?: number;
}
