import { claude, MODELS } from "@/lib/anthropic";
import { EDITORIAL_SYSTEM_PROMPT } from "@/lib/prompts/system";
import { LESSON_PROMPT } from "@/lib/prompts/lesson";
import { ARTIFACT_PROMPT } from "@/lib/prompts/artifact";
import { RELEVANCE_PROMPT } from "@/lib/prompts/relevance";
import { representativeExcerpt, fetchDocument, meaningfulTextLength } from "./fetch";
import { transcribePdf } from "./ocr";
import { captureSourceScreenshots } from "./screenshot";
import { savePost, listSavedPosts, loadAllSavedPosts } from "./save";
import { findContentDuplicate } from "./dedup";
import { PERSONS } from "@/lib/taxonomy";
import type {
  ArtifactResult,
  EnrichResult,
  LessonResult,
  PipelineOptions,
  PipelineResult,
  RelevanceResult,
  SourceDocument,
} from "./types";
import type { Post, PostScreenshot, PostTopic } from "@/lib/types";

function logStage(id: string, stage: string, msg: string) {
  console.log(`[${id}] ${stage} :: ${msg}`);
}

function safeJSON<T>(raw: string): T | null {
  // Strip code fences if Claude wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // try to find first { ... } block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callClaude(opts: {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: any }> {
  const res = await claude.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  const block = res.content[0];
  const text = block?.type === "text" ? block.text : "";
  return { text, usage: res.usage };
}

export async function processDocument(
  source: SourceDocument,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  // 0. Dedup guard. Discovery has no idea what's already published, and post slugs
  // are deterministic (post.slug === source.id). Without this, a re-run silently
  // re-fetches + regenerates an existing post — burning Claude budget AND
  // overwriting it with a fresh lesson + today's date (which also breaks the
  // broadcast dedup keyed on slug). Skip anything already on disk unless forced.
  // (--dry-run is pure inspection and makes no Claude calls, so let it through.)
  if (!opts.forceRefresh && !opts.dryRun) {
    const existing = await listSavedPosts();
    if (existing.includes(`${source.id}.json`)) {
      logStage(source.id, "skip", "post already exists — skipping (use --force to regenerate)");
      return { sourceId: source.id, ok: true, postSlug: source.id, skipped: "exists" };
    }
  }

  // 1. Fetch
  const rangeNote = source.pdfPageRange ? ` (pp. ${source.pdfPageRange[0]}-${source.pdfPageRange[1]})` : "";
  logStage(source.id, "fetch", `${source.url}${rangeNote}`);
  const fetched = await fetchDocument(source.fetchUrl ?? source.url, {
    pdfPageRange: source.pdfPageRange,
  });
  if (fetched.status !== "ok" || !fetched.text) {
    return {
      sourceId: source.id,
      ok: false,
      failureStage: "fetch",
      error: fetched.error ?? `HTTP ${fetched.httpCode}`,
    };
  }
  let workingText = fetched.text;
  let bodyChars = meaningfulTextLength(workingText);
  let textSource: "extracted" | "ocr_transcribed" = "extracted";
  logStage(source.id, "fetch", `ok — ${fetched.bytes} bytes, ${bodyChars} body chars`);

  // Scanned-image PDFs yield only court/exhibit boilerplate via text extraction.
  // Transcribe them with a Claude vision model rather than fabricate a lesson
  // from nothing. (Not possible in --dry-run, which makes no Claude calls.)
  const MIN_BODY_CHARS = 250;
  if (bodyChars < MIN_BODY_CHARS) {
    if (opts.dryRun) {
      return {
        sourceId: source.id,
        ok: false,
        failureStage: "fetch",
        error: `Likely scanned-image PDF — only ${bodyChars} body chars after boilerplate (${fetched.text.length} raw). OCR (Claude transcription) needed; not run in --dry-run.`,
      };
    }
    logStage(source.id, "ocr", `low text yield (${bodyChars} body chars) — transcribing PDF via Claude`);
    const ocr = await transcribePdf(source.fetchUrl ?? source.url, { pageRange: source.pdfPageRange });
    const ocrBody = ocr.text ? meaningfulTextLength(ocr.text) : 0;
    if (!ocr.ok || ocrBody < MIN_BODY_CHARS) {
      return {
        sourceId: source.id,
        ok: false,
        failureStage: "fetch",
        error: `OCR transcription failed or insufficient (${ocr.error ?? `${ocrBody} body chars`}).`,
      };
    }
    workingText = ocr.text!;
    bodyChars = ocrBody;
    textSource = "ocr_transcribed";
    logStage(source.id, "ocr", `transcribed ${bodyChars} body chars via ${ocr.model} (in ${ocr.inputTokens}t / out ${ocr.outputTokens}t)`);
  }

  // Representative window: jumps past front-matter to the letter body for long
  // filings, so the gate judges substance, not a table of contents.
  const excerptCandidate = representativeExcerpt(workingText, source.excerptMarker);

  if (opts.dryRun) {
    return dryRunResult(source, excerptCandidate);
  }

  // 2. Relevance gate — the editorial bouncer. Cheap (Haiku), runs before we
  // spend on enrich/lesson. Discovery is a firehose; most documents do NOT yield
  // a meaningful learning. Pass only material that fits the theme AND yields a
  // nameable transferable lesson.
  logStage(source.id, "relevance", "calling Haiku");
  const relevancePrompt = RELEVANCE_PROMPT(
    excerptCandidate,
    `${source.documentTitle} · ${source.knownAuthors.join(", ")} · ${source.knownCompany} · ${source.dateAuthored}`,
  );
  const relevanceRaw = await callClaude({
    model: MODELS.triage,
    prompt: relevancePrompt,
    maxTokens: 700,
  });
  const rel = safeJSON<RelevanceResult>(relevanceRaw.text);
  if (!rel) {
    return { sourceId: source.id, ok: false, failureStage: "relevance", error: "Failed to parse relevance JSON" };
  }

  const minThemeFit = opts.minThemeFit ?? 6;
  const minLessonClarity = opts.minLessonClarity ?? 6;
  const passes =
    rel.isInternalCorrespondence &&
    rel.onTheme &&
    rel.rejectCategory === null &&
    rel.themeFitScore >= minThemeFit &&
    rel.lessonClarity >= minLessonClarity &&
    rel.candidateLesson.trim().length > 0;

  // Notable Artifact lane: a doc that isn't lesson-worthy but IS historically
  // notable (recognizable leaders / pivotal moment) still earns a lighter post —
  // unless the caller opts out. Only for the "thin, no lesson" rejections; never
  // rescues procedural/boilerplate/off-theme/non-correspondence material.
  const ARTIFACT_REJECTS = new Set(["no_transferable_lesson", "too_thin"]);
  const isArtifact =
    !passes &&
    opts.artifactLane !== false &&
    !!rel.notableArtifact &&
    rel.isInternalCorrespondence &&
    rel.onTheme &&
    rel.rejectCategory !== null &&
    ARTIFACT_REJECTS.has(rel.rejectCategory);

  const verdict = passes ? "PASS" : isArtifact ? "ARTIFACT" : "REJECT";
  logStage(
    source.id,
    "relevance",
    `${verdict} themeFit=${rel.themeFitScore} lessonClarity=${rel.lessonClarity} signal=${rel.leadershipSignal}` +
      (passes ? ` :: ${rel.candidateLesson}` : ` [${rel.rejectCategory ?? "below_bar"}] ${rel.reason}`),
  );

  if (opts.gateOnly) {
    const ok = passes || isArtifact;
    return {
      sourceId: source.id,
      ok,
      postSlug: ok ? source.id : undefined,
      failureStage: ok ? undefined : "relevance",
      rejectCategory: rel.rejectCategory,
      error: ok ? undefined : `[${rel.rejectCategory ?? "below_bar"}] themeFit=${rel.themeFitScore} lessonClarity=${rel.lessonClarity}: ${rel.reason}`,
    };
  }

  if (!passes && !isArtifact) {
    return {
      sourceId: source.id,
      ok: false,
      failureStage: "relevance",
      rejectCategory: rel.rejectCategory,
      error: `[${rel.rejectCategory ?? "below_bar"}] themeFit=${rel.themeFitScore} lessonClarity=${rel.lessonClarity}: ${rel.reason}`,
    };
  }

  // 3. Enrich (extract excerpt + clean metadata)
  logStage(source.id, "enrich", "calling Sonnet");
  const enrichPrompt = `You are preparing a document for the The Leadership Letter editorial pipeline. Given this raw text and known metadata, extract a fair-use excerpt (≤300 words, ≤10% of source) that captures the most editorially significant passage. Output JSON:

{
  "authors": ["names"],
  "recipients": ["names"],
  "dateAuthored": "YYYY-MM-DD",
  "topics": ["topic1","topic2"],
  "excerptForBlog": "<the actual excerpt text, ≤300 words>",
  "documentTitleCleaned": "<clean title>",
  "fairUseCompliant": true,
  "excerptWordCount": <number>,
  "docKind": "<'email' | 'letter' | 'thread'>",
  "messageThread": [{ "sender": "<name or masked handle>", "text": "<message text>" }]
}

docKind + messageThread:
- Set "docKind" to "thread" when the document is a CHAT/MESSAGE exchange (WhatsApp, SMS/iMessage, Slack, Signal) — alternating sender turns, chat handles like "…@s.whatsapp.net", often no From/To/Subject headers. Otherwise "email" for an email, or "letter" for a shareholder/leadership letter.
- ONLY when docKind==="thread", populate "messageThread" as the excerpt broken into ordered turns: each { sender, text } is one message. Use the sender's name if shown, else the masked handle exactly as it appears (e.g. "[redacted]@s.whatsapp.net"); represent redacted content as "[redacted]". The turns together must stay within the same ≤300-word / ≤10% cap as excerptForBlog (they are the SAME content, just structured). "excerptForBlog" should still contain the flat text.
- For "email" or "letter", omit "messageThread" (empty array) — do NOT invent turns.

Known metadata: ${JSON.stringify({
    title: source.documentTitle,
    authors: source.knownAuthors,
    company: source.knownCompany,
    dateAuthored: source.dateAuthored,
    recipients: source.recipientNames,
    hintedTopics: source.hintedTopics,
  })}

Raw text (representative window from the document):
${excerptCandidate}

Valid topics: competition | product | acquisitions | app-stores | ai | strategy | partnerships | crisis-management | fundraising | comms | technology | board-governance | leadership-transitions | recruiting | founding-moments | finance | policy

Output the JSON only.`;
  const enrichRaw = await callClaude({
    model: MODELS.enrich,
    prompt: enrichPrompt,
    maxTokens: 1200,
  });
  const enrich = safeJSON<EnrichResult>(enrichRaw.text);
  if (!enrich || !enrich.excerptForBlog) {
    return { sourceId: source.id, ok: false, failureStage: "enrich", error: "Failed to parse enrich JSON" };
  }
  logStage(source.id, "enrich", `excerpt=${enrich.excerptWordCount}w, topics=${enrich.topics.join(",")}`);

  // 3b. Content dedup. The same email is often filed under multiple exhibit numbers
  // (e.g. docket 1014-2 AND 1247-1) → distinct slugs the step-0 slug guard misses.
  // Now that enrich has given us date + participants + excerpt, check whether this
  // document is already published under another slug BEFORE we pay for the lesson.
  if (!opts.forceRefresh && opts.contentDedup !== false) {
    const existingPosts = await loadAllSavedPosts();
    const dup = findContentDuplicate(
      {
        slug: source.id,
        dateAuthored: enrich.dateAuthored || source.dateAuthored,
        authorsName: enrich.authors.length ? enrich.authors : source.knownAuthors,
        recipientNames: enrich.recipients.length ? enrich.recipients : source.recipientNames,
        excerptForBlog: enrich.excerptForBlog,
      },
      existingPosts,
    );
    if (dup) {
      logStage(source.id, "dedup", `content duplicate of ${dup.slug} (${dup.reason}) — skipping before lesson`);
      return { sourceId: source.id, ok: true, postSlug: source.id, skipped: "duplicate", duplicateOf: dup.slug };
    }
  }

  // 4. Analysis — the standard three-part LESSON, or (Notable Artifact lane) a
  // lighter "why this matters" note. Unified into a common set of post fields.
  const analysisTitle = enrich.documentTitleCleaned || source.documentTitle;
  const analysisDate = enrich.dateAuthored || source.dateAuthored;
  const analysisAuthors = enrich.authors.join(" & ") || source.knownAuthors.join(" & ");
  const provenance = `${source.sourceCase} · ${source.sourceCitation}`;

  let postKind: "lesson" | "artifact" = "lesson";
  let title: string;
  let pullQuote: string;
  let traits: string[];
  let situation: string | undefined;
  let insight: string | undefined;
  let application: string | undefined;
  let artifactNote: string | undefined;

  if (isArtifact) {
    logStage(source.id, "artifact", "calling Sonnet (notable-artifact lane)");
    const artifactRaw = await callClaude({
      model: MODELS.lesson,
      prompt: ARTIFACT_PROMPT(analysisTitle, analysisDate, analysisAuthors, source.knownCompany, enrich.excerptForBlog, provenance),
      maxTokens: 1500,
    });
    const art = safeJSON<ArtifactResult>(artifactRaw.text);
    if (!art || !art.title || !art.artifactNote) {
      return { sourceId: source.id, ok: false, failureStage: "lesson", error: "Failed to parse artifact JSON (missing title/artifactNote)" };
    }
    postKind = "artifact";
    title = art.title;
    pullQuote = art.pullQuote;
    traits = art.significance?.length ? art.significance : ["notable artifact"];
    artifactNote = art.artifactNote;
    logStage(source.id, "artifact", `title="${art.title}" (${art.artifactNote.length} chars)`);
  } else {
    const useOpus = (rel.leadershipSignal ?? 0) >= 8;
    const lessonModel = useOpus ? MODELS.featured : MODELS.lesson;
    logStage(source.id, "lesson", `calling ${useOpus ? "Opus" : "Sonnet"}`);
    const lessonRaw = await callClaude({
      model: lessonModel,
      system: EDITORIAL_SYSTEM_PROMPT,
      prompt: LESSON_PROMPT(analysisTitle, analysisDate, analysisAuthors, source.knownCompany, enrich.excerptForBlog, provenance),
      maxTokens: 8192,
    });
    const lesson = safeJSON<LessonResult>(lessonRaw.text);
    if (!lesson || !lesson.situation || !lesson.insight || !lesson.application) {
      return { sourceId: source.id, ok: false, failureStage: "lesson", error: "Failed to parse lesson JSON (missing situation/insight/application)" };
    }
    title = lesson.lessonTitle;
    pullQuote = lesson.pullQuote;
    traits = lesson.leadershipTraits;
    situation = lesson.situation;
    insight = lesson.insight;
    application = lesson.application;
    logStage(source.id, "lesson", `title="${lesson.lessonTitle}" (${lesson.situation.length + lesson.insight.length + lesson.application.length} chars)`);
  }

  // 5. Screenshot — render the actual source document (PDF page(s) or web page).
  const cleanTitle = enrich.documentTitleCleaned || source.documentTitle;
  logStage(source.id, "screenshot", "capturing source document");
  let screenshots = await captureSourceScreenshots(
    source.fetchUrl ?? source.url,
    source.id,
    {
      documentTitle: cleanTitle,
      sourceCitation: `${source.sourceCase} · ${source.sourceCitation}`,
    },
    source.pdfPageRange,
  );
  if (screenshots.length === 0) {
    // Capture failed — publish anyway with a placeholder (enhancement, not blocker).
    logStage(source.id, "screenshot", "capture failed — using placeholder");
    screenshots = [
      {
        url: `/screenshots/_pending/${source.id}.png`,
        caption: `Source document for "${cleanTitle}" — capture unavailable; view original at the linked source.`,
        alt: `${cleanTitle} (capture unavailable)`,
      },
    ];
  } else {
    logStage(source.id, "screenshot", `captured ${screenshots.length} page(s)`);
  }

  // Attribute the post to the people ACTUALLY in the document (authors, recipients,
  // or named in the excerpt), matched against the browse taxonomy — not the case's
  // default leader. A cross-company exhibit (e.g. a Mozilla email in the Google
  // case) must not be filed under the case's executive.
  const peopleHay = [...enrich.authors, ...enrich.recipients, source.knownAuthors.join(" "), enrich.excerptForBlog].join(" | ");
  const matchedLeaders = PERSONS.filter((p) =>
    new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(peopleHay),
  ).map((p) => p.slug);
  const leaderSlugs = matchedLeaders.length ? matchedLeaders : [];

  // Company: prefer the company the gate read from the document over the case's
  // default — a cross-company exhibit (Epic email in the Apple case, a Microsoft
  // email in the Musk case) must be bylined to its real sender, not the docket.
  const estCo = (rel.estimatedCompany || "").trim();
  const authorsCompany = estCo && !/^unknown$/i.test(estCo) && estCo.length <= 40 ? estCo : source.knownCompany;

  // 6. Save as Post JSON.
  // Firehose-discovered letters (EDGAR blind full-text sweep of every 8-K filer) are
  // quarantined from the daily auto-send: they still publish to the blog, but an editor
  // must set reviewStatus:"approved" before they reach the newsletter — this is what
  // stops obscure small-cap filers from going out to the audience unreviewed.
  const discoveryLane = source.discoveryLane;
  const reviewStatus = discoveryLane === "firehose" ? "quarantined" : undefined;
  if (reviewStatus === "quarantined") {
    logStage(source.id, "quarantine", `firehose lane — held from auto-send (signal=${rel.leadershipSignal}); review to approve`);
  }
  const post: Post = {
    slug: source.id,
    publishedAt: new Date().toISOString().slice(0, 10),
    isFeatured: false,
    title,
    documentTitle: enrich.documentTitleCleaned || source.documentTitle,
    dateAuthored: enrich.dateAuthored || source.dateAuthored,
    authorsName: enrich.authors.length ? enrich.authors : source.knownAuthors,
    authorsCompany,
    recipientNames: enrich.recipients.length ? enrich.recipients : source.recipientNames,
    topics: (enrich.topics.length ? enrich.topics : rel.topics) as PostTopic[],
    leaderSlugs,
    excerptForBlog: enrich.excerptForBlog,
    messageThread:
      enrich.docKind === "thread" && enrich.messageThread?.length ? enrich.messageThread : undefined,
    screenshots,
    sourceType: source.sourceType,
    sourceUrl: source.url,
    sourceCase: source.sourceCase,
    sourceCitation: source.sourceCitation,
    licensingPath: source.licensingPath,
    textSource,
    leadershipSignal: rel.leadershipSignal,
    discoveryLane,
    reviewStatus,
    postKind,
    artifactNote,
    lessonTitle: title,
    situation,
    insight,
    application,
    pullQuote,
    leadershipTraits: traits,
  };

  const outputPath = await savePost(post);
  logStage(source.id, "save", outputPath);
  return { sourceId: source.id, ok: true, outputPath, postSlug: source.id };
}

function dryRunResult(source: SourceDocument, excerpt: string): PipelineResult {
  console.log(`\n  ── DRY RUN: ${source.id} ──`);
  console.log(`  URL: ${source.url}`);
  console.log(`  Fetched ${excerpt.length} chars`);
  console.log(`  First 400 chars: ${excerpt.slice(0, 400).replace(/\s+/g, " ")}`);
  console.log(`  Would call: Haiku (relevance gate) → Sonnet (enrich) → Sonnet/Opus (lesson)`);
  console.log(`  Estimated cost: ~$0.05–0.20 per document (with prompt caching)\n`);
  return { sourceId: source.id, ok: true };
}

export async function runPipeline(opts: PipelineOptions = {}): Promise<PipelineResult[]> {
  // Discovery feeds documents in via opts.sources; otherwise use the static registry.
  let docs: SourceDocument[];
  if (opts.sources?.length) {
    docs = opts.sources;
  } else {
    const { SOURCE_DOCUMENTS } = await import("./registry");
    docs = SOURCE_DOCUMENTS;
  }
  if (opts.onlyIds?.length) {
    docs = docs.filter((d) => opts.onlyIds!.includes(d.id));
  }
  if (opts.limit) docs = docs.slice(0, opts.limit);

  console.log(`\n=== The Leadership Letter Ingestion Pipeline ===`);
  console.log(`Mode: ${opts.dryRun ? "DRY RUN (no Claude calls)" : "LIVE"}`);
  console.log(`Documents to process: ${docs.length}\n`);

  const results: PipelineResult[] = [];
  for (const doc of docs) {
    try {
      const result = await processDocument(doc, opts);
      results.push(result);
    } catch (e) {
      console.error(`[${doc.id}] CRASHED:`, e);
      results.push({
        sourceId: doc.id,
        ok: false,
        failureStage: "lesson",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped === "exists").length;
  const deduped = results.filter((r) => r.skipped === "duplicate").length;
  const fail = results.length - ok;
  console.log(`\n=== Complete ===`);
  console.log(`Succeeded: ${ok - skipped - deduped} (new)`);
  console.log(`Skipped:   ${skipped} (already exist — use --force to regenerate)`);
  if (deduped > 0) {
    console.log(`Deduped:   ${deduped} (same document, different exhibit number)`);
    results.filter((r) => r.skipped === "duplicate").forEach((r) => {
      console.log(`  ${r.sourceId} → duplicate of ${r.duplicateOf}`);
    });
  }
  console.log(`Failed:    ${fail}`);
  if (fail > 0) {
    console.log(`\nFailures:`);
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  ${r.sourceId} [${r.failureStage}]: ${r.error}`);
    });
  }
  return results;
}
