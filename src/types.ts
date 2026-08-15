/* =========================================================================
   Domain types.

   The original was one mutable global with no shape written down anywhere,
   which is why the grade strings, the picked map and the two different
   "job" objects all drifted apart over time. Writing them once here is most
   of what the TypeScript port is for.
   ========================================================================= */

/** The four grades. Deterministic, never assigned by a model. */
export type MetricType = "audited" | "estimated" | "activity" | "none";

/** One thing the user did. The atom of the whole product. */
export interface Unit {
  id: number;
  org: string;
  role: string;
  dates: string;
  action: string;
  metricType: MetricType;
  metric: string;
  constraint: string;
  evidence: string;
  /** Quarantined industry statistic. Stored for interview prep, never printed. */
  benchmark: string;
  tags: string[];
}

/** A weighted term read out of a posting. */
export interface Keyword {
  k: string;
  n: number;
  /** Weight. Old saved files carry no `w`, so readers fall back to `n`. */
  w?: number;
  req?: boolean;
}

export interface Pay {
  lo: number;
  hi: number;
  per: "hour" | "day" | "month" | "year";
  annual: number;
  cur: string;
}

/** A bullet inside a model-written document. `from` points at a source entry. */
export interface DocBullet {
  text: string;
  from?: number;
}

export interface DocRole {
  org: string;
  role: string;
  dates: string;
  bullets: DocBullet[];
}

export interface MissingTerm {
  term: string;
  why?: string;
  earn?: string;
}

/** The structured document the writer returns. */
export interface WrittenDoc {
  summary?: string;
  skills?: string[];
  roles: DocRole[];
  missing?: MissingTerm[];
  kind?: "resume" | "cv";
  ideal?: boolean;
  partial?: boolean;
}

/** One saved posting. Each carries its own keywords and its own picks. */
export interface Job {
  id: string;
  title: string;
  co: string;
  url: string;
  text: string;
  kw: Keyword[];
  picked: Record<string, boolean>;
  pay?: Pay | null;
  aiDoc?: WrittenDoc | null;
  idealDoc?: WrittenDoc | null;
  aiScore?: number;
}

export interface Header {
  name: string;
  title: string;
  loc: string;
  email: string;
  phone: string;
  link: string;
  summary: string;
}

export interface Typography {
  font: string;
  size: string;
  lead: string;
  accent: string;
}

export type LevelKey = "intern" | "junior" | "mid" | "senior" | "exec" | "";

export interface Profile {
  titles: string[];
  level: LevelKey;
  loc: string;
  remote: boolean;
  minPay: number;
  ready: boolean;
}

export type AppStatus = "saved" | "applied" | "replied" | "interview" | "offer" | "closed";

export interface Application {
  status: AppStatus;
  applied: number;
  followed: number;
  title: string;
  co: string;
  url: string;
}

export interface SavedSearch {
  win: string;
  depth: string;
  loc: string;
  kw: string;
  pay: number;
  guard: string;
  types: string[];
  at: number;
}

/** A generated resume-and-CV pair plus every score computed about it. */
export interface GenResult {
  resume: string;
  cv: string;
  summaryLine: string;
  matchAfter: number;
  kwHit: string[];
  kwMiss: string[];
  addressed: string[];
  declined: { term: string; reason: string }[];
  positioning: string;
  atsScore: number;
  atsIssues: string[];
  lintScore: number;
  lintIssues: { sev: "high" | "med" | "low"; msg: string }[];
  model: string;
  when: number;
}

/** Everything persisted to localStorage under `ee.v1`. */
export interface AppState {
  units: Unit[];
  jobs: Job[];
  activeJob: string | null;
  /** Live pointer at the active job, so the rest of the code reads one shape. */
  jd: Job;
  picked: Record<string, boolean>;
  hdr: Header;
  type: Typography;
  customText: string;
  pro: boolean;
  editing: number | null;
  profile: Profile;
  answers: Record<string, string>;
  apps: Record<string, Application>;
  seen: Record<string, number>;
  lastSearch: SavedSearch | null;
  /** Verbatim text of every resume imported, so the tailor can trace claims. */
  rawResume: string;
  gen: Record<string, GenResult>;
}

/* ---------- job search ---------- */

export interface Listing {
  id: string;
  title: string;
  co: string;
  loc: string;
  /** The board's own published timestamp, never a guess at freshness. */
  ts: number;
  url: string;
  src: string;
  types: string[];
  raw?: string;
  pay?: Pay | null;
  pct?: number;
  hits?: string[];
  isNew?: boolean;
}

export interface SourceError {
  code: string | number;
  src: string;
  msg: string;
}

export interface PullResult {
  items: Listing[];
  error?: SourceError;
  errors?: SourceError[];
  shape?: { rows: number; mapped: number };
}

export interface SearchDiag {
  ok: number;
  empty: number;
  failed: number;
  errors: SourceError[];
  total: number;
}

export interface SearchState {
  results: Listing[];
  all: Listing[];
  strong: Listing[];
  possible: Listing[];
  lastRun: number | null;
  running: boolean;
  showAll: boolean;
  autoWide: boolean;
  freshCount: number;
  bySource: Record<string, number>;
  diag: SearchDiag | null;
}

export interface SearchForm {
  win: string;
  depth: string;
  loc: string;
  pay: string;
  level: string;
  keywords: string;
  types: string[];
}

/* ---------- sources ---------- */

export type AtsKind = "greenhouse" | "lever" | "ashby";

export interface CompanyBoard {
  ats: AtsKind;
  t: string;
}

export interface Aggregator {
  id: string;
  label: string;
  url: string;
}

export interface BlockedSource {
  name: string;
  kind: "cors" | "wall";
  why: string;
}

export interface RapidSource {
  id: string;
  label: string;
  note: string;
  /** Where a visitor gets their own free key. Rendered as a "Get a free key"
      link, because the public tool never ships anyone's key. */
  signup?: string;
  host: string;
  path: string;
  key: string;
  headers: Record<string, string> | null;
  method: string;
  body: string;
  off: boolean;
  unofficial: boolean;
  custom: boolean;
}

/* ---------- AI ---------- */

export type ProviderId =
  | "openrouter" | "anthropic" | "openai" | "google" | "groq"
  | "deepseek" | "mistral" | "xai" | "together" | "custom";

export interface AiConfig {
  provider: ProviderId;
  key: string;
  model: string;
  baseUrl: string;
}

export type ModelOption = [id: string, label: string];

export interface ProviderDef {
  label: string;
  url: string;
  modelsUrl?: string;
  modelsNoKey?: boolean;
  keys: string;
  colour: string;
  initials: string;
  note: string;
  models: ModelOption[];
  /** Filled in once the provider's own catalogue has been read. */
  live?: ModelOption[];
  model?: string;
}

export interface AiLogEntry {
  at?: string;
  provider: string;
  model: string;
  url: string;
  headers: Record<string, string>;
  requestBodyPreview: string;
  responseBodyPreview?: string;
  attempt: number;
  status?: number;
  ok?: boolean;
  elapsedMs?: number;
  textLen?: number;
  stopReason?: string;
  truncatedFinal?: boolean;
  error?: string;
}

/* ---------- semantic gap re-check ---------- */

export interface SemItem {
  term: string;
  verdict: "covered" | "implied" | "missing";
  entry_id: number | string | null;
  reason?: string;
  rewrite?: string | null;
  question?: string | null;
  __i?: number;
}

/* ---------- readability ---------- */

export interface Suggestion {
  kind: "ats" | "verb" | "long" | "nonum" | "summary";
  label: string;
  id?: number;
  detail?: string;
  fix?: string;
}
