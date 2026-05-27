/**
 * Seed script — creates the first Document + Analysis + Publication for
 * end-to-end render testing. Uses the Bezos 1997 Amazon shareholder letter,
 * which is self-published and freely quotable (Tier GREEN — self_published).
 *
 * Run: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BEZOS_1997_EXCERPT = `It's all about the long term.

We believe that a fundamental measure of our success will be the shareholder value we create over the long term. This value will be a direct result of our ability to extend and solidify our current market leadership position. The stronger our market leadership, the more powerful our economic model. Market leadership can translate directly to higher revenue, higher profitability, greater capital velocity, and correspondingly stronger returns on invested capital.

Our decisions have consistently reflected this focus. We first measure ourselves in terms of the metrics most indicative of our market leadership: customer and revenue growth, the degree to which our customers continue to purchase from us on a repeat basis, and the strength of our brand. We have invested and will continue to invest aggressively to expand and leverage our customer base, brand, and infrastructure as we move to establish an enduring franchise.

Because of our emphasis on the long term, we may make decisions and weigh tradeoffs differently than some companies.`;

async function main() {
  console.log("Seeding The Leadership Letter database...");

  // Source
  const source = await db.source.upsert({
    where: { name: "Amazon Shareholder Letters Archive" },
    create: {
      type: "self_published",
      name: "Amazon Shareholder Letters Archive",
      baseUrl: "https://www.aboutamazon.com/news/company-news/2021-letter-to-shareholders",
      description: "Annual letters from Jeff Bezos (1997-2020) and Andy Jassy (2021+), self-published by Amazon.",
      isActive: true,
    },
    update: {},
  });

  // Document
  const document = await db.document.upsert({
    where: { id: "seed-bezos-1997" },
    create: {
      id: "seed-bezos-1997",
      sourceId: source.id,
      sourceType: "self_published",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1018724/0000891020-98-000622.txt",
      sourceCase: "Amazon 1997 Annual Report (SEC 10-K filing)",
      sourceCitation: "Letter to Shareholders, 1997 (Jeff Bezos)",
      title: "1997 Letter to Shareholders — \"It's All About the Long Term\"",
      dateAuthored: new Date("1998-03-30"),
      authorsName: ["Jeff Bezos"],
      authorsCompany: "Amazon.com, Inc.",
      recipientNames: ["Shareholders"],
      topics: ["strategy", "compensation", "board"],
      leaderIds: [],
      fullTextPdfUrl: null,
      fullTextOcr: BEZOS_1997_EXCERPT,
      excerptForBlog: BEZOS_1997_EXCERPT,
      screenshotUrls: [],
      screenshotCaptions: [],
      licensingPath: "self_published",
      triageVerdict: "publish_candidate",
      triageReason: "Seed document — manually curated. Foundational example of long-term-thinking leadership communication.",
    },
    update: {},
  });

  console.log(`Created Source: ${source.name}`);
  console.log(`Created Document: ${document.title}`);
  console.log("Done. Run the lesson generator next: npm run generate -- " + document.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
