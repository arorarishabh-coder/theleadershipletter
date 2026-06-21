/** @type {import('next').NextConfig} */

// Content Security Policy. 'unsafe-inline' is required for Next's hydration
// bootstrap, next/font's injected <style>, our inline style={{}} attributes, and
// the inline JSON-LD blocks; everything else is locked to same-origin. Images
// allow https/data so source-document screenshots and OG cards resolve.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  // Stripe Checkout (/api/stripe/checkout) and the billing portal
  // (/api/stripe/portal) submit a same-origin form that 303-redirects to Stripe.
  // CSP form-action validates the redirect target too, so Stripe's hosted
  // domains must be allowed or the browser silently blocks the navigation.
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The content store is read from disk; the /search route reads it at runtime.
  // Bundle the JSON into serverless functions (Vercel's file tracing doesn't
  // follow runtime fs reads of computed paths). In Next 14.2 this lives under
  // `experimental`.
  experimental: {
    outputFileTracingIncludes: {
      "/": ["./content/posts/**"],
      "/search": ["./content/posts/**"],
      "/api/cron/daily": ["./content/posts/**"],
      "/post/[slug]/opengraph-image": ["./content/posts/**"],
    },
  },
};

export default nextConfig;
