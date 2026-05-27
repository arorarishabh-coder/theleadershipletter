import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Crawl policy: open the whole site to search engines, keep API routes out, and
// point crawlers at the sitemap. (Next serves this at /robots.txt.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
