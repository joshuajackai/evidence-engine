/* =========================================================================
   WHERE THE ROLES COME FROM
   Every source below was CORS-tested from the deployed origin. A browser can
   call the public JSON APIs that applicant tracking systems publish for their
   own embedded boards, and a few remote-job aggregators that allow it too.
   It cannot call LinkedIn, Indeed, Glassdoor or Himalayas: those either send no
   CORS header or require a key, and no amount of client code changes that.
   ========================================================================= */
import { readJson, writeJson } from "@/store/storage";
import type { Aggregator, BlockedSource, CompanyBoard, RapidSource } from "@/types";

export const BOARDS_KEY = "ee.boards";
export const KEYED_KEY = "ee.keysrc";
export const RAPID_KEY = "ee.rapidsrc";
export const AGG_OFF_KEY = "ee.aggoff";

/* Which aggregators the user has switched OFF. Stored as a list of ids so the
   default (nothing stored) means every aggregator is on, which is the behaviour
   before this toggle existed. */
export function aggOff(): string[] {
  const v = readJson<string[]>(AGG_OFF_KEY, []);
  return Array.isArray(v) ? v : [];
}
export function saveAggOff(ids: string[]): void {
  writeJson(AGG_OFF_KEY, ids);
}
export function isAggOn(id: string): boolean {
  return aggOff().indexOf(id) === -1;
}
export function setAggOn(id: string, on: boolean): void {
  const cur = aggOff().filter((x) => x !== id);
  if (!on) cur.push(id);
  saveAggOff(cur);
}

/* EVERY token below was probed against its ATS and returned jobs. None are
   guesses. The sweep tested 317 companies and 185 had no reachable board at
   all, which is the honest reason this list is not the Fortune 500: of 117
   large caps tested, only 15 responded. The rest run Workday, Taleo or
   SuccessFactors, none of which publish an open board API. Ordered by job count
   so a quick search hits the biggest boards first. */
export const COMPANY_BOARDS_DEFAULT: CompanyBoard[] = [
  { ats: "lever", t: "gopuff" }, { ats: "greenhouse", t: "databricks" }, { ats: "ashby", t: "openai" },
  { ats: "greenhouse", t: "stripe" }, { ats: "lever", t: "shieldai" }, { ats: "greenhouse", t: "datadog" },
  { ats: "ashby", t: "snowflake" }, { ats: "greenhouse", t: "anthropic" }, { ats: "greenhouse", t: "waymo" },
  { ats: "greenhouse", t: "mongodb" }, { ats: "greenhouse", t: "okta" }, { ats: "ashby", t: "harvey" },
  { ats: "greenhouse", t: "zscaler" }, { ats: "greenhouse", t: "brex" }, { ats: "lever", t: "palantir" },
  { ats: "greenhouse", t: "cloudflare" }, { ats: "ashby", t: "saronic" }, { ats: "greenhouse", t: "elastic" },
  { ats: "lever", t: "zoox" }, { ats: "ashby", t: "elevenlabs" }, { ats: "greenhouse", t: "roblox" },
  { ats: "greenhouse", t: "block" }, { ats: "greenhouse", t: "pinterest" }, { ats: "greenhouse", t: "scaleai" },
  { ats: "greenhouse", t: "twilio" }, { ats: "greenhouse", t: "airbnb" }, { ats: "greenhouse", t: "gitlab" },
  { ats: "greenhouse", t: "fivetran" }, { ats: "greenhouse", t: "reddit" }, { ats: "greenhouse", t: "affirm" },
  { ats: "greenhouse", t: "figma" }, { ats: "ashby", t: "sierra" }, { ats: "greenhouse", t: "coinbase" },
  { ats: "greenhouse", t: "workato" }, { ats: "greenhouse", t: "flexport" }, { ats: "greenhouse", t: "asana" },
  { ats: "greenhouse", t: "epicgames" }, { ats: "ashby", t: "cohere" }, { ats: "greenhouse", t: "robinhood" },
  { ats: "ashby", t: "ramp" }, { ats: "greenhouse", t: "instacart" }, { ats: "ashby", t: "cursor" },
  { ats: "ashby", t: "plaid" }, { ats: "ashby", t: "decagon" }, { ats: "ashby", t: "notion" },
  { ats: "ashby", t: "vanta" }, { ats: "greenhouse", t: "nuro" }, { ats: "greenhouse", t: "cresta" },
  { ats: "greenhouse", t: "smartsheet" }, { ats: "ashby", t: "socure" }, { ats: "ashby", t: "replit" },
  { ats: "ashby", t: "perplexity" }, { ats: "greenhouse", t: "gusto" }, { ats: "greenhouse", t: "vercel" },
  { ats: "ashby", t: "synthesia" }, { ats: "greenhouse", t: "faire" }, { ats: "greenhouse", t: "chime" },
  { ats: "greenhouse", t: "hightouch" }, { ats: "greenhouse", t: "chainguard" }, { ats: "greenhouse", t: "twitch" },
  { ats: "ashby", t: "clickup" }, { ats: "ashby", t: "lovable" }, { ats: "greenhouse", t: "carta" },
  { ats: "ashby", t: "drata" }, { ats: "ashby", t: "temporal" }, { ats: "greenhouse", t: "mercury" },
  { ats: "greenhouse", t: "zocdoc" }, { ats: "greenhouse", t: "checkr" }, { ats: "greenhouse", t: "fastly" },
  { ats: "ashby", t: "benchling" }, { ats: "greenhouse", t: "tailscale" }, { ats: "greenhouse", t: "mixpanel" },
  { ats: "greenhouse", t: "discord" }, { ats: "ashby", t: "abridge" }, { ats: "ashby", t: "sentilink" },
  { ats: "ashby", t: "miro" }, { ats: "greenhouse", t: "amplitude" }, { ats: "greenhouse", t: "airtable" },
  { ats: "greenhouse", t: "marqeta" }, { ats: "ashby", t: "sardine" }, { ats: "lever", t: "metlife" },
  { ats: "ashby", t: "render" }, { ats: "greenhouse", t: "launchdarkly" }, { ats: "lever", t: "outreach" },
  { ats: "ashby", t: "confluent" }, { ats: "greenhouse", t: "everlaw" }, { ats: "ashby", t: "vapi" },
  { ats: "ashby", t: "modal" }, { ats: "ashby", t: "astronomer" }, { ats: "greenhouse", t: "webflow" },
  { ats: "ashby", t: "socket" }, { ats: "ashby", t: "linear" }, { ats: "ashby", t: "column" },
  { ats: "greenhouse", t: "greenhouse" }, { ats: "lever", t: "angellist" }, { ats: "ashby", t: "numeral" },
  { ats: "ashby", t: "middesk" }, { ats: "ashby", t: "midjourney" }, { ats: "greenhouse", t: "alloy" },
  { ats: "ashby", t: "leapsome" }, { ats: "ashby", t: "persona" }, { ats: "ashby", t: "warp" },
  { ats: "ashby", t: "parafin" }, { ats: "ashby", t: "semgrep" }, { ats: "ashby", t: "zapier" },
  { ats: "ashby", t: "bland" }, { ats: "ashby", t: "substack" }, { ats: "ashby", t: "bubble" },
  { ats: "ashby", t: "airbyte" }, { ats: "ashby", t: "openevidence" }, { ats: "greenhouse", t: "typeform" },
  { ats: "greenhouse", t: "descript" }, { ats: "ashby", t: "patreon" }, { ats: "ashby", t: "posthog" },
  { ats: "greenhouse", t: "lithic" }, { ats: "ashby", t: "railway" }, { ats: "ashby", t: "moderntreasury" },
  { ats: "greenhouse", t: "highnote" }, { ats: "ashby", t: "infisical" }, { ats: "ashby", t: "prefect" },
  { ats: "greenhouse", t: "netlify" }, { ats: "greenhouse", t: "instabase" }, { ats: "greenhouse", t: "ghost" },
  { ats: "greenhouse", t: "lattice" }, { ats: "ashby", t: "capchase" }, { ats: "ashby", t: "doppler" },
  { ats: "greenhouse", t: "cameo" }, { ats: "ashby", t: "charthop" }, { ats: "ashby", t: "fullstory" },
  { ats: "greenhouse", t: "orca" }, { ats: "greenhouse", t: "calm" }, { ats: "greenhouse", t: "metalab" },
  { ats: "greenhouse", t: "klaviyo" }, { ats: "greenhouse", t: "underdogfantasy" },
  { ats: "lever", t: "superside" }, { ats: "lever", t: "ro" }, { ats: "lever", t: "cloudinary" },
  { ats: "lever", t: "instrument" }, { ats: "lever", t: "fantasy" }, { ats: "lever", t: "rightsideup" },
  { ats: "ashby", t: "atticus" }, { ats: "ashby", t: "revenuecat" },
];

export const QUICK_BOARD_COUNT = 40;

/* Every entry below returned data from the live origin. The blocked list
   underneath is not an opinion, it is the same test failing. */
export const AGGREGATORS: Aggregator[] = [
  { id: "remotive", label: "Remotive", url: "https://remotive.com/api/remote-jobs?limit=200" },
  { id: "arbeitnow", label: "Arbeitnow", url: "https://www.arbeitnow.com/api/job-board-api" },
  { id: "jobicy", label: "Jobicy", url: "https://jobicy.com/api/v2/remote-jobs?count=50" },
  { id: "wwr", label: "We Work Remotely", url: "https://weworkremotely.com/remote-jobs.rss" },
  { id: "remoteok", label: "RemoteOK", url: "https://remoteok.com/api" },
  { id: "themuse", label: "The Muse", url: "https://www.themuse.com/api/public/jobs?page=1" },
  /* search_by_date, not search. The relevance-ranked endpoint returned a thread
     from 2020 and every "job" came back six years old. */
  { id: "hn", label: "HN Who Is Hiring", url: "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=1" },
];

/* Sites that cannot be reached from a browser, with the actual reason, because
   "add LinkedIn" is a reasonable request and deserves a real answer.
   cors = public data, no CORS header. A server-side proxy would fix it.
   wall = login, paid, bot defence or no public listing endpoint. A proxy does
          NOT fix it, and for several of these scraping breaches their terms. */
export const BLOCKED_SOURCES: BlockedSource[] = [
  { name: "LinkedIn", kind: "wall", why: "No public jobs API. Requires login and blocks automated reads. Scraping it breaches their terms and they have litigated it." },
  { name: "Indeed", kind: "wall", why: "Publisher API closed to new registrations. The site blocks automated reads." },
  { name: "ZipRecruiter", kind: "wall", why: "Partner API only, requires an approved commercial agreement." },
  { name: "Wellfound", kind: "wall", why: "GraphQL endpoint requires authentication and blocks anonymous reads." },
  { name: "Built In", kind: "wall", why: "No public API. Server-rendered behind bot protection." },
  { name: "FlexJobs", kind: "wall", why: "Paid subscription. Listings sit behind a login you cannot share with users." },
  { name: "Dribbble", kind: "wall", why: "Jobs board requires an authenticated OAuth token." },
  { name: "Google Jobs", kind: "wall", why: "Not a product you can query. Google for Jobs is a search results feature, not an API. Cloud Talent Solution is for posting your own roles, not reading Google's index." },
  { name: "Contra", kind: "wall", why: "Job feed is authenticated GraphQL, tied to a signed-in freelancer account." },
  { name: "Adzuna", kind: "cors", why: "Free developer tier and good inventory, but measured from this origin: Failed to fetch, which is a CORS block rather than an auth failure. A key will not help. It works fine from a server." },
  { name: "Jooble", kind: "cors", why: "Free API key, broad international coverage, and the same problem. Failed to fetch from a browser. Server-side only." },
  { name: "SAM.gov, official API", kind: "cors", why: "api.sam.gov is free and authoritative, and a registered entity gets 1,000 requests a day, but it sends no CORS header. Blocked before a response is readable. The RapidAPI wrapper in the keyed sources reaches the same data from a browser, which is the only reason federal contracts are available here at all." },
  { name: "Craigslist", kind: "cors", why: "RSS feeds are public but send no CORS header. A proxy would work." },
  { name: "Reddit", kind: "cors", why: "The .json endpoints are public but send no CORS header. A proxy would work." },
];

/* Providers with their own separate credentials. Everything on RapidAPI lives
   in RAPID_DEFAULTS instead, because RapidAPI is one key for all of them and
   listing each one separately made users paste it twice. */
export const KEYED_SOURCES: Record<string, { label: string; note: string; signup: string; fields: string[] }> = {
  usajobs: {
    label: "USAJOBS, official federal jobs",
    note:
      "Free, self-service, no approval. Every US federal government posting. Different from the " +
      "SAM.gov source: this is JOBS, that is CONTRACTS. Reaches the browser, verified. One caveat, " +
      "press Test to settle it: USAJOBS documents a User-Agent header set to your registered email, " +
      "and browsers control that header themselves, so it may or may not be accepted from a page.",
    signup: "https://developer.usajobs.gov/apirequest",
    fields: ["authorization_key", "registered_email"],
  },
};

/* Built-in RapidAPI sources. host and path are editable by the user, because
   which listing they subscribed to is their choice, not ours.

   RapidAPI issues ONE KEY PER APP, not one per API, so the key field is shared
   and a per-source key only overrides it. RapidAPI sends CORS headers, so these
   work from the browser with no backend. And the listings are not
   interchangeable, so the adapter is generic: give it a host and a path and it
   finds the results array and maps the fields by trying the names these APIs
   actually use. Any listing works, including ones bought later. */
export const RAPID_DEFAULTS: Omit<RapidSource, "key" | "headers" | "method" | "body" | "off" | "custom">[] = [
  {
    id: "jsearch", label: "JSearch", host: "jsearch.p.rapidapi.com",
    path: "/search?query={q}&num_pages=3&page=1",
    note: "Aggregates Google for Jobs, which surfaces LinkedIn and Indeed postings.",
    unofficial: false,
  },
  {
    id: "jobsapi28", label: "Jobs API 28", host: "jobs-api28.p.rapidapi.com",
    path: "/active-ats-7d?limit=100&offset=0&title_filter={q}&location_filter={loc}",
    note: "Active ATS postings across many boards at once.",
    unofficial: false,
  },
  /* Lesson worth keeping: read the host from the code snippet, never infer it
     from the marketplace URL. The first version of this row pointed at a PEOPLE
     scraper whose endpoint returns a person's profile. */
  {
    id: "linkedin", label: "LinkedIn Jobs (third party)", host: "linkedin-jobs-api8.p.rapidapi.com",
    path: "/jobs?timeframe=7d&offset=0&limit=100",
    note:
      "LinkedIn has no official jobs API, so this is a third-party scraper. This endpoint returns " +
      "the last 7 days rather than taking a search term, so the tool filters the results locally. " +
      "That API lists 24 params, so if it has a keyword or location one, add " +
      "&keyword={q}&location={loc} and press Test.",
    unofficial: true,
  },
  {
    id: "indeed", label: "Indeed (third party)", host: "indeed-api5.p.rapidapi.com",
    path: "/search?query={q}&location={loc}",
    note: "Indeed shut its own Publisher API down in 2023, so this is a third-party scraper. Host confirmed. Press Test to confirm the path.",
    unofficial: true,
  },
  {
    id: "samgov", label: "Federal Contract Intelligence (SAM.gov)", host: "federal-contract-intelligence.p.rapidapi.com",
    path: "/search?keyword={q}",
    note:
      "Federal contract opportunities, not job listings. SAM.gov's own API is free but sends no " +
      "CORS header, so a browser cannot call it directly. This RapidAPI wrapper can, which is the " +
      "only reason it works here.",
    unofficial: false,
  },
  /* bluedoor is NOT on RapidAPI. It is its own API with its own key, added here
     because this list is the tool's keyed-source registry, not a RapidAPI-only
     one. It sends CORS headers (access-control-allow-origin: *) and takes a
     Bearer key, so the browser can call it directly. pull.ts sends the key as
     Authorization: Bearer because the host is not *.rapidapi.com. Paste the
     bluedoor key in this source's own key field, not the shared RapidAPI one.
     status=active and the source_posted_at field give live, company-dated rows. */
  {
    id: "bluedoor", label: "bluedoor Job Postings", host: "api.bluedoor.sh",
    path: "/job-postings/v1/jobs/search?q={q}&country=United%20States&status=active&limit=100",
    note:
      "Monitors company ATS providers directly (Greenhouse, Lever, Workday, ADP and more) and " +
      "carries source_posted_at, the company's own post date. Free key by email code: click " +
      "Get a free key, request a code, and paste the key this source hands back into the key " +
      "field on this row. Your key stays in your browser.",
    signup: "https://bluedoor.sh/apis/job-postings/docs/",
    unofficial: false,
  },
];

/* ---------- stored configuration ---------- */

export function boardList(): CompanyBoard[] {
  const c = readJson<CompanyBoard[] | null>(BOARDS_KEY, null);
  if (Array.isArray(c) && c.length) return c;
  return COMPANY_BOARDS_DEFAULT;
}

export function saveBoardList(list: CompanyBoard[]): void {
  writeJson(BOARDS_KEY, list);
}

export type KeyedCfg = Record<string, Record<string, string>>;

export function keyedCfg(): KeyedCfg {
  return readJson<KeyedCfg>(KEYED_KEY, {});
}

export function saveKeyedCfg(cfg: KeyedCfg): void {
  writeJson(KEYED_KEY, cfg);
}

export interface RapidSaved {
  _custom?: Partial<RapidSource>[];
  [id: string]: unknown;
}

export function rapidSaved(): RapidSaved {
  return readJson<RapidSaved>(RAPID_KEY, {});
}

export function saveRapid(v: RapidSaved): void {
  writeJson(RAPID_KEY, v);
}

/**
 * One key for every RapidAPI-backed source. Reads the new location first, then
 * migrates a key saved under the old per-source shape so nobody has to re-paste.
 */
export function rapidKey(): string {
  const cfg = keyedCfg();
  if (cfg._rapidapi && cfg._rapidapi.key) return cfg._rapidapi.key;
  const legacy =
    (cfg.jsearch && cfg.jsearch.rapidapi_key) || (cfg.jobsapi28 && cfg.jobsapi28.rapidapi_key) || "";
  return legacy || "";
}

/**
 * The presets, plus anything the user adds. Custom entries live under the
 * reserved "_custom" key so they never collide with a preset id: a preset can
 * be edited but not deleted, while a custom one can be deleted.
 */
export function rapidSources(): RapidSource[] {
  const saved = rapidSaved();
  const list: RapidSource[] = RAPID_DEFAULTS.map((d) => {
    const o = (saved[d.id] as Partial<RapidSource>) || {};
    return {
      id: d.id,
      label: d.label,
      note: d.note,
      signup: (d as { signup?: string }).signup,
      unofficial: !!d.unofficial,
      custom: false,
      host: o.host != null && o.host !== "" ? o.host : d.host,
      path: o.path != null && o.path !== "" ? o.path : d.path,
      key: o.key || "",
      headers: o.headers || null,
      method: o.method || "",
      body: o.body || "",
      off: !!o.off,
    };
  });
  (saved._custom || []).forEach((c) => {
    if (!c || !c.id) return;
    list.push({
      id: c.id,
      label: c.label || c.id,
      note: c.note || "Added by you. Paste a curl command or fill the fields, then press Test.",
      host: c.host || "",
      path: c.path || "",
      key: c.key || "",
      headers: c.headers || null,
      method: c.method || "",
      body: c.body || "",
      off: !!c.off,
      unofficial: true,
      custom: true,
    });
  });
  return list;
}
