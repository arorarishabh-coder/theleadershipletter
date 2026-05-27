import Anthropic from "@anthropic-ai/sdk";

declare global {
  var anthropic: Anthropic | undefined;
}

export const claude =
  globalThis.anthropic ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.anthropic = claude;
}

// Model IDs (per Anthropic SDK conventions; see project memory for upgrade notes)
export const MODELS = {
  triage: "claude-haiku-4-5-20251001", // cheap classification
  enrich: "claude-sonnet-4-6",          // metadata extraction
  lesson: "claude-sonnet-4-6",          // standard lesson generation
  featured: "claude-opus-4-7",          // premium / featured pieces
} as const;
