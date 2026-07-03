/**
 * CourtListener RECAP API client.
 *
 * CourtListener (Free Law Project) mirrors PACER as the "RECAP Archive" — the
 * largest open collection of federal court documents. We use it the way
 * Internal Tech Emails does: as a *discovery index* over litigation dockets.
 *
 * Licensing discipline (see CHARTER.md / SOURCES.md):
 *   - CourtListener's value-added extracted text/metadata is CC BY-ND — we may
 *     NOT republish it or build derivatives from it. So we treat the `snippet`
 *     field as a relevance SIGNAL only, never as publishable content.
 *   - The underlying court PDFs (filepath_local → storage.courtlistener.com) are
 *     public-record government works. We fetch those and re-extract the text
 *     OURSELVES (lib/ingest/fetch.ts) for any republication.
 *
 * Auth: anonymous works at a low rate limit. Set COURTLISTENER_API_TOKEN (free,
 * from courtlistener.com/profile/api/) to raise it. Token is sent as
 * `Authorization: Token <token>`.
 */

const API_BASE = "https://www.courtlistener.com/api/rest/v4";
const STORAGE_BASE = "https://storage.courtlistener.com";
const SITE_BASE = "https://www.courtlistener.com";

const USER_AGENT =
  "CorporateLettersResearchBot/0.1 (+research@corporateletters.example.com) editorial-discovery";

/** A single RECAP document as returned by the search API (type=rd). */
export interface RecapDocResult {
  id: number;
  docket_id: number;
  docket_entry_id: number;
  pacer_doc_id: string | null;
  document_number: number | string | null;
  attachment_number: number | null;
  entry_number: number | null;
  description: string; // full docket-entry description (e.g. "MOTION ... (Attachments: # 1 Exhibit A)")
  short_description: string; // e.g. "Exhibit 21"
  document_type: string;
  page_count: number | null;
  is_available: boolean;
  filepath_local: string | null; // path under storage.courtlistener.com
  absolute_url: string; // path under courtlistener.com
  entry_date_filed: string | null; // ISO date
  snippet: string; // CC BY-ND — relevance signal ONLY, never republish
}

export interface RecapSearchParams {
  /** CourtListener court id, e.g. "dcd", "cand", "nysd". */
  court?: string;
  /** Docket number string, e.g. "1:20-cv-03590". */
  docketNumber?: string;
  /** Full-text query (matches OCR'd document text + metadata). */
  query?: string;
  /** Only entries filed on/after this ISO date. */
  filedAfter?: string;
  /** Result ordering. Default relevance. */
  orderBy?: "score desc" | "entry_date_filed desc" | "entry_date_filed asc";
  /** Max results to return (caps pagination). Default 20. */
  limit?: number;
}

function authHeaders(): Record<string, string> {
  const token = process.env.COURTLISTENER_API_TOKEN || process.env.COURTLISTENER_TOKEN;
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Token ${token}`;
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Build the public URL of the court PDF we re-host/extract from. */
export function storageUrl(filepathLocal: string): string {
  return `${STORAGE_BASE}/${filepathLocal.replace(/^\/+/, "")}`;
}

/** Build the canonical CourtListener docket page URL (citation target). */
export function siteUrl(absoluteUrl: string): string {
  return `${SITE_BASE}${absoluteUrl}`;
}

/**
 * Search RECAP documents (type=rd). Returns individual documents, ranked by the
 * requested ordering. Handles a single page by default; paginates up to `limit`.
 */
export async function searchRecapDocuments(
  params: RecapSearchParams,
): Promise<RecapDocResult[]> {
  const limit = params.limit ?? 20;
  const qs = new URLSearchParams({ type: "rd" });
  if (params.query) qs.set("q", params.query);
  if (params.court) qs.set("court", params.court);
  if (params.docketNumber) qs.set("docket_number", params.docketNumber);
  if (params.filedAfter) qs.set("filed_after", params.filedAfter);
  qs.set("order_by", params.orderBy ?? "score desc");

  const results: RecapDocResult[] = [];
  let url: string | null = `${API_BASE}/search/?${qs.toString()}`;
  let pages = 0;

  while (url && results.length < limit && pages < 5) {
    const res: Response = await fetchWithRetry(url);
    if (!res.ok) {
      throw new Error(`CourtListener ${res.status} ${res.statusText} for ${url}`);
    }
    const json = (await res.json()) as { results?: RecapDocResult[]; next?: string | null };
    for (const r of json.results ?? []) results.push(r);
    url = json.next ?? null;
    pages += 1;
    if (url) await sleep(400); // be polite between pages
  }

  return results.slice(0, limit);
}

/** Fetch with one retry on 429/5xx using the Retry-After hint or a backoff. */
async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: authHeaders(), redirect: "follow" });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1);
    await sleep(waitMs);
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

// ── Search Alerts ──────────────────────────────────────────────────────────
// A saved RECAP full-text query that CourtListener re-runs on a schedule and
// POSTs new hits to the account's configured webhook — turning discovery from a
// static per-docket sweep into live, company-wide monitoring of ANY new PACER
// filing matching an exec-email fingerprint. Requires COURTLISTENER_API_TOKEN.

/** Alert cadence (CourtListener codes): rt=real-time (paid), dly=daily, wly=weekly, mly=monthly. */
export type AlertRate = "rt" | "dly" | "wly" | "mly";

export interface SearchAlert {
  id: number;
  name: string;
  query: string; // the stored search querystring, e.g. `q=...&type=r`
  rate: string;
}

function hasToken(): boolean {
  return !!(process.env.COURTLISTENER_API_TOKEN || process.env.COURTLISTENER_TOKEN);
}

/** List the account's existing search alerts (paginates). */
export async function listSearchAlerts(): Promise<SearchAlert[]> {
  if (!hasToken()) throw new Error("COURTLISTENER_API_TOKEN required to manage alerts.");
  const out: SearchAlert[] = [];
  let url: string | null = `${API_BASE}/alerts/`;
  let pages = 0;
  while (url && pages < 10) {
    const res: Response = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`CourtListener alerts ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { results?: SearchAlert[]; next?: string | null };
    for (const a of json.results ?? []) out.push(a);
    url = json.next ?? null;
    pages += 1;
    if (url) await sleep(400);
  }
  return out;
}

/** Delete a search alert by id. Returns true on success. */
export async function deleteSearchAlert(id: number): Promise<boolean> {
  if (!hasToken()) throw new Error("COURTLISTENER_API_TOKEN required to manage alerts.");
  const res = await fetch(`${API_BASE}/alerts/${id}/`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok && res.status !== 204) throw new Error(`CourtListener delete alert ${res.status}`);
  return true;
}

/**
 * Create a RECAP search alert. `query` is the search querystring (no leading `?`),
 * e.g. `q="From:" ("@google.com")&type=r`. Idempotent by name: if an alert with
 * the same name exists it is returned unchanged.
 */
export async function createSearchAlert(input: {
  name: string;
  query: string;
  rate?: AlertRate;
  /** Pre-fetched alert list to dedup against (avoids re-listing per call in a batch). */
  existing?: SearchAlert[];
}): Promise<{ alert: SearchAlert; created: boolean }> {
  if (!hasToken()) throw new Error("COURTLISTENER_API_TOKEN required to manage alerts.");
  const existing = input.existing ?? (await listSearchAlerts());
  const match = existing.find((a) => a.name === input.name);
  if (match) return { alert: match, created: false };

  const res = await fetch(`${API_BASE}/alerts/`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    // alert_type "r" = notify on new cases AND filings (documents), which is what
    // our exec-email fingerprints target; "d" would be dockets only.
    body: JSON.stringify({ name: input.name, query: input.query, rate: input.rate ?? "dly", alert_type: "r" }),
  });
  if (!res.ok) {
    throw new Error(`CourtListener create alert ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return { alert: (await res.json()) as SearchAlert, created: true };
}
