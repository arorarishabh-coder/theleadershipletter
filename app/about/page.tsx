import Link from "next/link";
import { Dateline } from "@/components/dateline";
import { SectionRule } from "@/components/section-rule";

export const metadata = {
  title: "About",
  description: "What The Leadership Letter is, and what it isn't.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="border-b border-ink pb-10">
        <Dateline strong>About the project</Dateline>
        <h1
          className="mt-4 font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.025em] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 500, "SOFT" 30' }}
        >
          What this is, and what it isn't.
        </h1>
      </header>

      <section className="prose-archive pt-14">
        <p>
          <strong>The Leadership Letter</strong> is a daily reading of real internal corporate correspondence — executive emails, board memos, strategy letters, court exhibits, shareholder letters — paired with a single, specific lesson. The audience is founders, operators, and curious business professionals who would rather study a primary document than a paraphrase of one.
        </p>
        <p>
          Most leadership content is sanitized after the fact: autobiographies, polished case studies, edited keynotes. The leader has had a chance to revise. What we publish here is what leaders wrote when they did not expect the writing to be read by us. The difference is the entire point.
        </p>

        <h2 id="charter">Editorial charter</h2>
        <p>
          Every post on this site must clear the same bar:
        </p>
        <ul>
          <li><strong>Grounded.</strong> Every meaningful claim traces to a specific line of the document. If we cite a fact, you can find it.</li>
          <li><strong>Transformative.</strong> The document is the exhibit; the lesson is the product. Excerpts are limited to the lesser of 300 words or 10% of the source.</li>
          <li><strong>Provenance noted.</strong> Every post links to the primary public source and includes a "How this surfaced" footer naming the case, citation, and date.</li>
          <li><strong>Screenshots included.</strong> Visual proof of the document. Personally identifying information is redacted before publish.</li>
          <li><strong>Analytical neutrality.</strong> Both wins and failures are valid. No hagiography. No hit pieces.</li>
          <li><strong>Honest about uncertainty.</strong> When the surrounding context is unclear, we say so. We do not fabricate background facts to tighten a narrative.</li>
        </ul>

        <h2 id="sources">Where the letters come from</h2>
        <p>
          We work only from sources where republication is on safe legal ground. In practice, that means:
        </p>
        <ul>
          <li><strong>SEC EDGAR filings</strong> — public-domain corporate disclosures.</li>
          <li><strong>Federal court exhibits</strong> — letters and emails filed as evidence in litigation, accessed via PACER and CourtListener.</li>
          <li><strong>Congressional and foreign-government records</strong> — hearing exhibits and committee publications.</li>
          <li><strong>Self-published correspondence</strong> — shareholder letters, CEO blog posts, public memos.</li>
          <li><strong>Journalist-quoted memos</strong> — quoted under fair use, linked to the original article, never republished in full.</li>
        </ul>
        <p>
          We do not publish from hacked archives (Sony, Hacking Team, etc.) regardless of how interesting the material is. We do not republish from sources whose licenses prohibit derivative works. The full source registry lives in the project's <code>SOURCES.md</code>.
        </p>

        <h2 id="removals">If you are the rights-holder</h2>
        <p>
          If you are an affected party and you believe a post should be removed, write to us. We will acknowledge within 48 hours, review the fair-use posture in good faith, and either take the post down or respond with our reasoning and an offer to add your context as a labeled addendum. We maintain a public removals log so the policy is visible.
        </p>

        <SectionRule />

        <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">
          An independent editorial project. No advertisers, no sponsors, no affiliate links. The daily edition is free.
        </p>
        <p>
          <Link href="/subscribe">Subscribe to the daily edition →</Link>
        </p>
      </section>
    </div>
  );
}
