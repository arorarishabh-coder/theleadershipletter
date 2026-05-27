import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import {
  getAllPosts,
  getBrowseCompanies,
  getBrowsePersons,
  getAllTopics,
} from "@/lib/queries";

// Dynamic sitemap covering every public URL: static pages, posts, and the
// company / person / topic facets. Regenerated on each deploy, so new posts and
// taxonomy entries are listed automatically. (Next serves this at /sitemap.xml.)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/browse`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/topics`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/leaders`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${base}/post/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const companies: MetadataRoute.Sitemap = getBrowseCompanies().map((c) => ({
    url: `${base}/company/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const persons: MetadataRoute.Sitemap = getBrowsePersons().map((p) => ({
    url: `${base}/leader/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const topics: MetadataRoute.Sitemap = getAllTopics().map((t) => ({
    url: `${base}/topic/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...posts, ...companies, ...persons, ...topics];
}
