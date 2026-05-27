// Central site config — single source of truth for canonical URL, name, and
// description used across metadata, sitemap, robots, JSON-LD, and OG images.

const RAW = process.env.SITE_URL || "https://corporate-letters.vercel.app";

export const SITE = {
  /** Canonical origin, no trailing slash. */
  url: RAW.replace(/\/+$/, ""),
  name: "The Leadership Letter",
  tagline: "Real corporate correspondence, paired with the lesson it teaches.",
  description:
    "Real internal corporate correspondence from public records — court exhibits, SEC filings, and shareholder letters — each paired with a practical leadership lesson for founders and operators.",
  locale: "en_US",
} as const;

/** Brand palette (mirrors globals.css / tailwind) for OG image generation. */
export const BRAND = {
  parchment: "#F4EFE6",
  parchmentDeep: "#EBE3D2",
  ink: "#1A1A1F",
  inkFaded: "#5E5A52",
  brick: "#8E2A1F",
  rule: "#C9C1AE",
} as const;
