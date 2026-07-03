/**
 * Live RECAP monitoring via CourtListener Search Alerts.
 *
 * The watchlist (discovery.ts) is a *static* per-docket sweep: it only finds
 * exec correspondence in dockets we already listed. Search Alerts flip that to
 * *live, company-wide* monitoring — a saved full-text RECAP query (an exec-email
 * fingerprint) that fires on ANY new PACER filing matching it, across all
 * dockets, and POSTs the hits to our webhook (app/api/webhooks/courtlistener).
 * This is how ITE-grade coverage scales without hand-adding every new case.
 *
 * Setup (one-time, by the user):
 *   1. COURTLISTENER_API_TOKEN — free from courtlistener.com/profile/api/
 *   2. Configure the account webhook (courtlistener.com/profile/webhooks/) to
 *      POST "Search Alert" events to https://theleadershipletter.com/api/webhooks/
 *      courtlistener?secret=$CL_WEBHOOK_SECRET
 *   3. `npm run alerts` to register the fingerprint alerts.
 */

import type { AlertRate } from "./courtlistener";
import { createSearchAlert, listSearchAlerts, storageUrl, siteUrl } from "./courtlistener";
import { WATCHED_CASES } from "./watchlist";
import type { SourceDocument } from "./types";

export interface Fingerprint {
  name: string;
  /** Companies whose signals compose this query (for logging). */
  companies: string[];
  /** The RECAP search querystring stored on the alert. */
  query: string;
}

/**
 * Build company-wide exec-email fingerprints from the watchlist's internalSignals,
 * grouped by company. Each becomes: `"From:" ("@domain" OR "Person" …)` over RECAP
 * (type=r), so it catches that company's internal emails in ANY new docket — not
 * only the ones we pre-listed.
 */
export function buildFingerprints(): Fingerprint[] {
  const byCompany = new Map<string, { domains: Set<string>; people: Set<string> }>();
  for (const c of WATCHED_CASES) {
    if (c.system !== "recap" || !c.internalSignals) continue;
    const key = c.knownCompany;
    if (!byCompany.has(key)) byCompany.set(key, { domains: new Set(), people: new Set() });
    const bucket = byCompany.get(key)!;
    (c.internalSignals.domains ?? []).forEach((d) => bucket.domains.add(d));
    (c.internalSignals.people ?? []).forEach((p) => bucket.people.add(p));
  }

  const fingerprints: Fingerprint[] = [];
  for (const [company, { domains }] of byCompany) {
    // Use email DOMAINS only (precise, low-volume) and require BOTH the From and
    // Subject headers — this targets actual email exhibits, not any filing that
    // merely says "from". Bare surnames (Cox, Page, Bond…) are far too common for
    // a global RECAP alert and blow past CourtListener's per-alert volume cap;
    // they stay in discovery's scoreSignal, which is docket-scoped.
    const domTerms = [...domains].map((d) => `"@${d}"`);
    if (!domTerms.length) continue;
    const q = `"From:" "Subject:" (${domTerms.join(" OR ")})`;
    const query = new URLSearchParams({ q, type: "r", order_by: "score desc" }).toString();
    fingerprints.push({ name: `TLL · ${company}`, companies: [company], query });
  }
  return fingerprints;
}

/** Register (idempotently) all company fingerprints as CourtListener alerts.
 *  Per-alert failures (e.g. a still-too-broad query CourtListener rejects) are
 *  captured, not thrown, so one company can't abort the batch. */
export async function registerAlerts(rate: AlertRate = "dly"): Promise<
  Array<{ name: string; created: boolean; id: number; ok: boolean; error?: string }>
> {
  const out: Array<{ name: string; created: boolean; id: number; ok: boolean; error?: string }> = [];
  const existing = await listSearchAlerts(); // fetch once, dedup against it
  for (const fp of buildFingerprints()) {
    try {
      const { alert, created } = await createSearchAlert({ name: fp.name, query: fp.query, rate, existing });
      if (created) existing.push(alert);
      out.push({ name: fp.name, created, id: alert.id, ok: true });
    } catch (e) {
      out.push({ name: fp.name, created: false, id: 0, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** Minimal shape of a RECAP result inside a Search-Alert webhook payload. */
export interface AlertHit {
  id: number;
  docket_id: number;
  document_number?: number | string | null;
  short_description?: string;
  description?: string;
  entry_date_filed?: string | null;
  filepath_local?: string | null;
  absolute_url?: string;
  is_available?: boolean;
}

/**
 * Convert a webhook RECAP hit into a pipeline SourceDocument. Authors/company are
 * left blank — the pipeline's enrich stage extracts them from the fetched PDF.
 * Returns null when the document isn't fetchable (no stored PDF).
 */
export function alertHitToSource(hit: AlertHit): SourceDocument | null {
  if (!hit.filepath_local) return null; // not downloadable → nothing to fetch/publish
  const docNo = hit.document_number != null ? String(hit.document_number) : "doc";
  return {
    id: `cl-${hit.docket_id}-${hit.id}`,
    url: hit.absolute_url ? siteUrl(hit.absolute_url) : storageUrl(hit.filepath_local),
    fetchUrl: storageUrl(hit.filepath_local),
    documentTitle: hit.short_description || hit.description?.slice(0, 120) || `RECAP filing ${docNo}`,
    knownAuthors: [],
    knownLeaderSlugs: [],
    knownCompany: "",
    recipientNames: [],
    dateAuthored: hit.entry_date_filed || "",
    sourceType: "court_exhibit",
    sourceCase: "RECAP (CourtListener search alert)",
    sourceCitation: `RECAP · docket ${hit.docket_id} · doc ${docNo} (CourtListener alert)`,
    licensingPath: "public_domain",
  };
}
