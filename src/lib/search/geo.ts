/* =========================================================================
   GEOGRAPHY MATCHING

   The old filter was one line: (j.loc||"").toLowerCase().indexOf(loc)<0.
   A raw substring match. Type "Canada" and the only listings that survived
   were the ones whose location string literally contained the word "canada".
   "Toronto, ON" was dropped. "Vancouver, BC" was dropped. "Remote" was
   dropped. The United States mostly escaped this because "Remote" and
   "United States" are both common in US listing strings, so the bug looked
   like a Canada bug rather than what it was: country search never worked for
   anyone, and Canada was where it showed.

   What replaces it: a country resolver that knows names, demonyms, ISO codes,
   provinces and states, and the larger cities. Two rules that matter:

   1. Two-letter region codes are matched ONLY in the "City, ST" position, on
      the original-case string. Lowercasing them first is how you get Ontario
      matching the word "on", Oregon matching "or", and Indiana matching "in".
   2. A listing with no country signal at all, which is most rows that just
      say "Remote", is INCLUDED on a country search, and a listing explicitly
      bound to a different country is EXCLUDED. Dropping unqualified remote
      rows is what made the result list look empty.
   ========================================================================= */
import { escapeRe } from "@/lib/util";

interface Country {
  label: string;
  names: string[];
  iso: string[];
  /** [name, postal abbreviation]. Pairs, because two parallel arrays drifted. */
  regions: [string, string | null][];
  cities: string[];
}

export const GEO_COUNTRIES: Record<string, Country> = {
  ca: {
    label: "Canada",
    names: ["canada", "canadian"],
    iso: ["can"] /* not "ca": CA is California */,
    regions: [
      ["alberta", "AB"], ["british columbia", "BC"], ["manitoba", "MB"], ["new brunswick", "NB"],
      ["newfoundland and labrador", "NL"], ["newfoundland", "NL"], ["nova scotia", "NS"],
      ["northwest territories", "NT"], ["nunavut", "NU"], ["ontario", "ON"],
      ["prince edward island", "PE"], ["quebec", "QC"], ["saskatchewan", "SK"], ["yukon", "YT"],
    ],
    cities: [
      "toronto", "vancouver", "montreal", "calgary", "edmonton", "ottawa", "winnipeg", "hamilton",
      "kitchener", "waterloo", "victoria", "halifax", "oshawa", "windsor", "saskatoon", "regina",
      "kelowna", "barrie", "guelph", "kingston", "burnaby", "surrey", "mississauga", "brampton",
      "markham", "vaughan", "laval", "gatineau", "longueuil", "burlington", "oakville", "richmond hill",
      "st catharines", "sherbrooke", "moncton", "fredericton", "charlottetown", "whitehorse", "yellowknife",
    ],
  },
  us: {
    label: "United States",
    names: ["united states", "united states of america", "america", "american", "usa", "u.s.a", "u.s."],
    iso: ["us", "usa"],
    regions: [
      ["alabama", "AL"], ["alaska", "AK"], ["arizona", "AZ"], ["arkansas", "AR"], ["california", "CA"],
      ["colorado", "CO"], ["connecticut", "CT"], ["delaware", "DE"], ["florida", "FL"], ["georgia", "GA"],
      ["hawaii", "HI"], ["idaho", "ID"], ["illinois", "IL"], ["indiana", "IN"], ["iowa", "IA"],
      ["kansas", "KS"], ["kentucky", "KY"], ["louisiana", "LA"], ["maine", "ME"], ["maryland", "MD"],
      ["massachusetts", "MA"], ["michigan", "MI"], ["minnesota", "MN"], ["mississippi", "MS"],
      ["missouri", "MO"], ["montana", "MT"], ["nebraska", "NE"], ["nevada", "NV"],
      ["new hampshire", "NH"], ["new jersey", "NJ"], ["new mexico", "NM"], ["new york", "NY"],
      ["north carolina", "NC"], ["north dakota", "ND"], ["ohio", "OH"], ["oklahoma", "OK"],
      ["oregon", "OR"], ["pennsylvania", "PA"], ["rhode island", "RI"], ["south carolina", "SC"],
      ["south dakota", "SD"], ["tennessee", "TN"], ["texas", "TX"], ["utah", "UT"], ["vermont", "VT"],
      ["virginia", "VA"], ["washington", "WA"], ["west virginia", "WV"], ["wisconsin", "WI"],
      ["wyoming", "WY"], ["district of columbia", "DC"],
    ],
    cities: [
      "new york", "brooklyn", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
      "san antonio", "san diego", "dallas", "austin", "san jose", "san francisco", "seattle", "denver",
      "boston", "atlanta", "miami", "portland", "las vegas", "detroit", "minneapolis", "nashville",
      "charlotte", "raleigh", "salt lake city", "kansas city", "columbus", "indianapolis", "st louis",
      "pittsburgh", "cincinnati", "cleveland", "tampa", "orlando", "sacramento", "oakland",
      "palo alto", "mountain view", "menlo park", "santa monica", "hayward", "milwaukee",
    ],
  },
  gb: {
    label: "United Kingdom",
    /* "british" is deliberately absent. As a bare token it matches "British
       Columbia" and hands a Vancouver search to the United Kingdom. */
    names: ["united kingdom", "great britain", "britain", "england", "scotland", "wales", "northern ireland", "u.k."],
    iso: ["uk", "gb", "gbr"],
    regions: [["greater london", null], ["yorkshire", null], ["merseyside", null], ["lancashire", null]],
    cities: [
      "london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "liverpool", "bristol",
      "sheffield", "newcastle", "nottingham", "cardiff", "belfast", "brighton", "cambridge", "oxford",
      "reading", "leicester", "coventry", "southampton", "aberdeen", "dundee", "york", "bath",
    ],
  },
  au: {
    label: "Australia",
    names: ["australia", "australian"],
    iso: ["au", "aus"],
    regions: [
      ["new south wales", "NSW"], ["victoria state", "VIC"], ["queensland", "QLD"],
      ["western australia", "WA"], ["south australia", "SA"], ["tasmania", "TAS"],
      ["australian capital territory", "ACT"],
    ],
    cities: ["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra", "hobart", "darwin", "gold coast"],
  },
  de: {
    label: "Germany",
    names: ["germany", "german", "deutschland"],
    iso: ["deu", "ger"] /* not "de": DE is Delaware */,
    regions: [["bavaria", null], ["bayern", null], ["hesse", null], ["saxony", null], ["north rhine-westphalia", null]],
    cities: ["berlin", "munich", "muenchen", "hamburg", "frankfurt", "cologne", "koeln", "stuttgart", "dusseldorf", "duesseldorf", "leipzig"],
  },
  fr: {
    label: "France",
    names: ["france", "french"],
    iso: ["fr", "fra"],
    regions: [["ile-de-france", null], ["occitanie", null], ["normandy", null], ["brittany", null]],
    cities: ["paris", "lyon", "marseille", "toulouse", "lille", "bordeaux", "nantes", "nice", "strasbourg"],
  },
  ie: {
    label: "Ireland",
    names: ["ireland", "irish", "republic of ireland"],
    iso: ["ie", "irl"],
    regions: [["leinster", null], ["munster", null], ["connacht", null]],
    cities: ["dublin", "cork", "galway", "limerick", "waterford"],
  },
  nl: {
    label: "Netherlands",
    names: ["netherlands", "dutch", "holland"],
    iso: ["nld"] /* not "nl": NL is Newfoundland and Labrador */,
    regions: [["north holland", null], ["south holland", null], ["utrecht province", null]],
    cities: ["amsterdam", "rotterdam", "the hague", "utrecht", "eindhoven"],
  },
  in: {
    label: "India",
    names: ["india", "indian"],
    iso: ["ind"] /* not "in": IN is Indiana and "in" is a preposition */,
    regions: [["maharashtra", null], ["karnataka", null], ["tamil nadu", null], ["telangana", null], ["haryana", null], ["uttar pradesh", null]],
    cities: ["bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "hyderabad", "chennai", "pune", "gurugram", "gurgaon", "noida", "kolkata", "ahmedabad"],
  },
  nz: {
    label: "New Zealand",
    names: ["new zealand"],
    iso: ["nz", "nzl"],
    regions: [["auckland region", null], ["canterbury", null], ["otago", null]],
    cities: ["auckland", "wellington", "christchurch", "dunedin"],
  },
  sg: { label: "Singapore", names: ["singapore"], iso: ["sg", "sgp"], regions: [], cities: ["singapore"] },
  es: {
    label: "Spain",
    names: ["spain", "spanish", "espana"],
    iso: ["esp"] /* not "es": too common in ordinary text */,
    regions: [["catalonia", null], ["andalusia", null], ["basque country", null]],
    cities: ["madrid", "barcelona", "valencia", "seville", "malaga", "bilbao"],
  },
};

/** Words that mean "no particular country" rather than a country. */
const GEO_GLOBAL =
  /\b(remote|anywhere|worldwide|world ?wide|global|distributed|work from home|wfh|flexible|any location|unspecified|n\/?a)\b/i;

/**
 * Does this text carry a signal for country key `ck`?
 * `raw` must be the ORIGINAL-CASE string, because the two-letter region codes
 * are only safe to match with case and a comma in front of them.
 */
function geoTextHas(raw: string, ck: string): boolean {
  const c = GEO_COUNTRIES[ck];
  if (!c) return false;
  const s = String(raw || "");
  const low = s.toLowerCase();
  const list = c.names.concat(c.cities, c.regions.map((r) => r[0]));
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    if (new RegExp("(^|[^a-z])" + escapeRe(list[i]) + "([^a-z]|$)", "i").test(low)) return true;
  }
  /* ISO codes need a hard word boundary: "uk" unbounded matched Milwaukee,
     which is how a Wisconsin search was returning British listings. */
  for (let i = 0; i < c.iso.length; i++) {
    if (new RegExp("(^|[^a-z0-9])" + escapeRe(c.iso[i]) + "([^a-z0-9]|$)", "i").test(low)) return true;
  }
  /* "City, ST" only, original case. Lowercasing these first is how Ontario
     starts matching the word "on" and Oregon matches "or". */
  for (let i = 0; i < c.regions.length; i++) {
    const ab = c.regions[i][1];
    if (!ab) continue;
    if (new RegExp("(^|,)\\s*" + escapeRe(ab) + "\\s*(,|$|\\s)").test(s)) return true;
  }
  return false;
}

/* Country-level signals only. No regions, no cities, because those narrow
   rather than expand. */
export function geoResolveCountry(q: string): string | null {
  const s = String(q || "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  for (const k in GEO_COUNTRIES) {
    const c = GEO_COUNTRIES[k];
    for (let i = 0; i < c.names.length; i++)
      if (new RegExp("(^|[^a-z])" + escapeRe(c.names[i]) + "([^a-z]|$)", "i").test(low)) return k;
  }
  for (const k in GEO_COUNTRIES) {
    const c = GEO_COUNTRIES[k];
    for (let i = 0; i < c.iso.length; i++)
      if (new RegExp("(^|[^a-z0-9])" + escapeRe(c.iso[i]) + "([^a-z0-9]|$)", "i").test(low)) return k;
  }
  return null;
}

/** A province or state. */
export function geoResolveRegion(q: string): { country: string; name: string; abbr: string | null } | null {
  const s = String(q || "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  for (const k in GEO_COUNTRIES) {
    const c = GEO_COUNTRIES[k];
    for (let i = 0; i < c.regions.length; i++) {
      if (new RegExp("(^|[^a-z])" + escapeRe(c.regions[i][0]) + "([^a-z]|$)", "i").test(low))
        return { country: k, name: c.regions[i][0], abbr: c.regions[i][1] };
    }
  }
  for (const k in GEO_COUNTRIES) {
    const c = GEO_COUNTRIES[k];
    for (let i = 0; i < c.regions.length; i++) {
      const ab = c.regions[i][1];
      if (!ab) continue;
      if (new RegExp("(^|,)\\s*" + escapeRe(ab) + "\\s*(,|$)").test(s))
        return { country: k, name: c.regions[i][0], abbr: ab };
    }
  }
  return null;
}

/**
 * Should this listing survive the user's location filter?
 * rawLoc is the listing string in ORIGINAL case. query is what the user typed.
 *
 * THREE TIERS, and the order is the whole design.
 * Tier 1, a COUNTRY query: expand to the whole country.
 * Tier 2, a REGION query: match that region only. A state must NOT expand to
 *   its country, because "new york" meaning every US listing including Austin
 *   is worse than useless.
 * Tier 3, anything else: substring, with comma-separated fragments as OR.
 *
 * Tier 1 deliberately does NOT fall back to a substring test. That fallback is
 * what kept the original bug alive through the first fix: "uk" is a substring
 * of "Milwaukee", so a Wisconsin listing passed a United Kingdom filter.
 */
export function locMatches(rawLoc: string, query: string): boolean {
  const q = String(query || "").trim();
  if (!q) return true;
  const loc = String(rawLoc || "");
  const low = loc.toLowerCase();
  const qlow = q.toLowerCase();

  const want = geoResolveCountry(q);
  if (want) {
    if (geoTextHas(loc, want)) return true;
    for (const k in GEO_COUNTRIES) {
      if (k !== want && geoTextHas(loc, k)) return false; /* claimed by elsewhere */
    }
    if (!loc.trim()) return true; /* no location at all */
    if (GEO_GLOBAL.test(loc)) return true; /* unqualified remote */
    return true; /* unknown place, keep */
  }

  const reg = geoResolveRegion(q);
  if (reg) {
    if (reg.name && new RegExp("(^|[^a-z])" + escapeRe(reg.name) + "([^a-z]|$)", "i").test(low)) return true;
    if (reg.abbr && new RegExp("(^|,)\\s*" + escapeRe(reg.abbr) + "\\s*(,|$|\\s)").test(loc)) return true;
    if (!loc.trim() || GEO_GLOBAL.test(loc)) return true;
    return false;
  }

  if (low.indexOf(qlow) >= 0) return true;
  const parts = qlow.split(/\s*,\s*/).filter(Boolean);
  if (parts.length > 1) {
    for (let pi = 0; pi < parts.length; pi++) if (parts[pi] && low.indexOf(parts[pi]) >= 0) return true;
  }
  return false;
}
