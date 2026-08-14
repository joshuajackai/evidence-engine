/* =========================================================================
   THE GENERIC RAPIDAPI ADAPTER
   There are dozens of competing LinkedIn and Indeed APIs on RapidAPI, each with
   its own host, its own path and its own response shape. Hardcoding an adapter
   per listing means a code change every time somebody subscribes to a different
   one. So this one is generic: give it a host and a path, and it finds the
   results array and maps the fields by trying the names these APIs actually
   use. Any listing works, including ones bought later, with no code change.
   ========================================================================= */
import type { Listing, PullResult, RapidSource } from "@/types";
import { netFetch, type CodedError } from "./net";
import { typeOf } from "./pay";

/**
 * Find the results array in a response whose shape we were never told.
 * Checks the usual envelope names, then falls back to the largest array of
 * objects anywhere in the top two levels.
 */
export function pickRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const named = ["data", "jobs", "results", "hits", "items", "postings", "docs", "response", "records", "content"];
  for (let i = 0; i < named.length; i++) {
    const v = obj[named[i]];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v as Record<string, unknown>[];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = v as Record<string, unknown>;
      for (let j = 0; j < named.length; j++) {
        const w = inner[named[j]];
        if (Array.isArray(w) && w.length && typeof w[0] === "object") return w as Record<string, unknown>[];
      }
    }
  }
  let best: Record<string, unknown>[] = [];
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && v.length > best.length)
      best = v as Record<string, unknown>[];
  });
  return best;
}

/** Read the first field that exists, walking dotted paths where needed. */
export function firstOf(x: Record<string, unknown>, names: string[]): string {
  for (let i = 0; i < names.length; i++) {
    const parts = names[i].split(".");
    let v: unknown = x;
    let ok = true;
    for (let j = 0; j < parts.length; j++) {
      if (v && typeof v === "object" && (v as Record<string, unknown>)[parts[j]] != null)
        v = (v as Record<string, unknown>)[parts[j]];
      else {
        ok = false;
        break;
      }
    }
    if (ok && v != null && v !== "" && typeof v !== "object") return String(v);
    if (ok && Array.isArray(v) && v.length && typeof v[0] === "string") return v.join(", ");
  }
  return "";
}

const RAPID_FIELDS = {
  title: ["title", "job_title", "jobTitle", "name", "position", "role"],
  co: ["company", "company_name", "companyName", "employer_name", "employerName", "organization", "org",
       "employer", "hiringOrganization.name", "company.name", "organization_name"],
  url: ["url", "job_url", "jobUrl", "apply_link", "job_apply_link", "applyUrl", "apply_url", "link",
        "redirect_url", "detailUrl", "job_link", "jobProviders.0.url", "source_url"],
  loc: ["location", "job_location", "jobLocation", "locations_derived", "job_city", "city", "place", "area",
        "formattedLocation", "locationName", "job_country", "address"],
  date: ["date_posted", "datePosted", "posted_at", "postedAt", "publication_date", "published_at", "created",
         "createdAt", "created_at", "job_posted_at_timestamp", "job_posted_at_datetime_utc", "postedDate",
         "date", "posted", "listed_at", "postingDate", "publishedDate", "updated"],
};

export function mapRapidRow(
  x: Record<string, unknown>,
  src: { id: string; label: string },
): Listing | null {
  const title = String(firstOf(x, RAPID_FIELDS.title) || "").trim();
  const url = String(firstOf(x, RAPID_FIELDS.url) || "").trim();
  if (!title || !url) return null;
  /* Prefer the composite when the API splits location into parts. Reading the
     first field alone returned "Toronto" for a row that knew it was
     "Toronto, ON, CA", and the country is what the geography filter needs. */
  let loc = "";
  if (x.job_city || x.job_state || x.job_country) {
    loc = [x.job_city, x.job_state, x.job_country].filter(Boolean).join(", ");
  }
  if (!loc) loc = String(firstOf(x, RAPID_FIELDS.loc) || "").trim();
  if (!loc && x.job_is_remote) loc = "Remote";
  const raw = firstOf(x, RAPID_FIELDS.date);
  let ts = 0;
  if (raw) {
    const asNum = Number(raw);
    if (/^\d+$/.test(raw) && !isNaN(asNum)) ts = asNum > 1e12 ? asNum : asNum * 1000;
    else ts = Date.parse(raw) || 0;
  }
  return {
    id: src.id + (x.id || x.job_id || url),
    title,
    co: String(firstOf(x, RAPID_FIELDS.co) || "").trim(),
    loc: loc || "",
    ts,
    url,
    src: src.label,
    types: typeOf(
      title,
      loc + " " + (firstOf(x, ["employment_type", "job_employment_type", "type", "contract_type"]) || ""),
    ),
  };
}

export async function pullRapidSource(
  src: RapidSource,
  sharedKey: string,
  q: string,
  where: string,
): Promise<PullResult> {
  if (!src.host || !src.path || src.off) return { items: [] };
  const path = src.path
    .replace(/\{q\}/g, encodeURIComponent(q || ""))
    .replace(/\{loc\}/g, encodeURIComponent(where || ""));
  const u =
    "https://" +
    src.host.replace(/^https?:\/\//, "").replace(/\/$/, "") +
    (path.charAt(0) === "/" ? path : "/" + path);
  /* A per-source key wins. RapidAPI issues one key per APP and a person can
     have several apps, so assuming one key for everything was wrong. Blank
     falls back to the shared key, which keeps the common case a single paste. */
  const key = src.key || sharedKey || "";
  const hdrs: Record<string, string> = {};
  if (src.headers)
    Object.keys(src.headers).forEach((k) => {
      hdrs[k] = (src.headers as Record<string, string>)[k];
    });
  /* Only send the RapidAPI headers to a RapidAPI host. This is not a
     RapidAPI-only tool any more. */
  if (/\.rapidapi\.com$/i.test(src.host)) {
    if (key) hdrs["x-rapidapi-key"] = key;
    hdrs["x-rapidapi-host"] = src.host;
  } else if (key && !Object.keys(hdrs).some((k) => /authorization|api-?key|token/i.test(k))) {
    hdrs["Authorization"] = "Bearer " + key;
  }
  const init: RequestInit = { headers: hdrs };
  if (src.method && src.method !== "GET") {
    init.method = src.method;
    if (src.body) init.body = src.body;
  }
  try {
    const body = await netFetch(u, { init });
    const rows = pickRows(body);
    const out: Listing[] = [];
    rows.forEach((x) => {
      const r = mapRapidRow(x, src);
      if (r) out.push(r);
    });
    return { items: out, shape: { rows: rows.length, mapped: out.length } };
  } catch (e) {
    const err = e as CodedError;
    return {
      items: [],
      errors: [{ code: err.code || err.name || "err", src: src.label, msg: String(err.message || err) }],
    };
  }
}
