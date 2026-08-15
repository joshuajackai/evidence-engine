import { useEffect, useMemo, useState } from "react";
import type { Listing, SearchForm, SearchState } from "@/types";
import { S, activeJob, newJob, syncActive, useAppState } from "@/store/state";
import { save } from "@/store/storage";
import { appKey, relativeAge } from "@/lib/util";
import { useUi } from "@/ui/UiContext";
import { fetchJob } from "@/lib/jd/fetchJob";
import { kwFromText } from "@/lib/jd/keywords";
import { coverageFor } from "@/lib/jd/match";
import { parsePay, payLabel } from "@/lib/search/pay";
import { band, whyMatched, FAMILIES } from "@/lib/search/families";
import { emptySearchState, runSearch, toggleShowAll } from "@/lib/search/runSearch";
import { LEVEL_LABEL } from "@/lib/resume/profile";
import { Msg, Spinner } from "@/components/Toast";

const TYPE_CHIPS: [string, string][] = [
  ["remote", "Remote"],
  ["fulltime", "Full time"],
  ["parttime", "Part time"],
  ["contract", "Contract or freelance"],
  ["intern", "Internship"],
];

/* Every session opens with the widest possible filters so the first run pulls
   the biggest pool of listings. Restoring the last search verbatim meant a
   returning user with narrow filters saw one or two results and had no obvious
   way back to a broad state. */
function broadDefaults(): SearchForm {
  return { win: "0", depth: "full", loc: "", pay: "", level: "off", keywords: "", types: [] };
}

function isBroadest(f: SearchForm): boolean {
  return f.win === "0" && !f.loc.trim() && !f.pay.trim() && f.level === "off" && !f.types.length;
}

export function TargetPanel() {
  const state = useAppState();
  const ui = useUi();
  const [tab, setTab] = useState<"find" | "add">("find");
  const [form, setForm] = useState<SearchForm>(() => {
    const f = broadDefaults();
    const p = S.profile;
    if (p.titles && p.titles.length) f.keywords = p.titles.slice(0, 2).join(", ");
    return f;
  });
  const [search, setSearch] = useState<SearchState>(emptySearchState);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [stat, setStat] = useState<React.ReactNode>(null);
  const [batchMsg, setBatchMsg] = useState<{ kind: "" | "good" | "bad" | "warn"; text: string } | null>(null);

  /* Manual entry form. */
  const [jUrl, setJUrl] = useState(state.jd.url || "");
  const [jTitle, setJTitle] = useState(state.jd.title || "");
  const [jCo, setJCo] = useState(state.jd.co || "");
  const [jText, setJText] = useState(state.jd.text || "");
  const [urlMsg, setUrlMsg] = useState<{ kind: "" | "good" | "bad"; text: string } | null>(null);
  const [fetching, setFetching] = useState(false);

  /* A search result handed over from elsewhere lands in the manual form. */
  useEffect(() => {
    if (!ui.jobDraft) return;
    setJUrl(ui.jobDraft.url);
    setJTitle(ui.jobDraft.title);
    setJCo(ui.jobDraft.co);
    setJText(ui.jobDraft.text);
    setTab("add");
    ui.setJobDraft(null);
  }, [ui.jobDraft, ui]);

  const activeKw = state.jd.kw || [];

  async function doSearch(override?: Partial<SearchForm>) {
    if (running) return;
    const f = { ...form, ...(override || {}) };
    if (override) setForm(f);
    setRunning(true);
    setProgress("Calling boards...");
    setStat(null);
    try {
      const out = await runSearch({ form: f, onProgress: setProgress });
      setSearch(out.state);
      const filtered: string[] = [];
      if (out.cutLevel) filtered.push(out.cutLevel + " at the wrong seniority");
      if (out.cutPay) filtered.push(out.cutPay + " under your pay floor");
      const s = out.state;
      setStat(
        <>
          {out.readCount.toLocaleString()} listings read
          {filtered.length ? ", " + filtered.join(" and ") + " set aside" : ""}.{" "}
          <b>
            {s.strong.length} strong fit{s.strong.length === 1 ? "" : "s"}
          </b>
          {s.possible.length ? ", " + s.possible.length + " possible" : ""}
          {s.freshCount ? (
            <>
              , <b style={{ color: "var(--audited)" }}>{s.freshCount} new since you last looked</b>
            </>
          ) : null}
          . Updated {new Date(s.lastRun || Date.now()).toLocaleTimeString()}
          {S.units.length ? null : (
            <b style={{ color: "var(--none)" }}> Add evidence first, nothing to score against.</b>
          )}
        </>,
      );
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  /** Pull the full posting text, then hand it to the manual form for saving. */
  async function tailorFor(j: Listing) {
    setBatchMsg({ kind: "", text: "Fetching the full posting for " + j.title + "..." });
    let text = "";
    try {
      const d = await fetchJob(j.url);
      text = d.text || "";
    } catch {
      /* Aggregator rows and unsupported boards still work: score on what we
         have and tell the user to paste the body for a sharper match. */
    }
    if (!text) {
      text = j.title + "\n" + j.co + "\n" + j.loc + "\n" + (j.hits || []).join(", ");
      setBatchMsg({
        kind: "bad",
        text:
          "Saved, but the full text could not be read from " + j.src +
          ". Open the posting, copy the description, and paste it into Add one myself for a sharper match.",
      });
    } else setBatchMsg(null);
    setJTitle(j.title);
    setJCo(j.co);
    setJUrl(j.url);
    setJText(text);
    setTab("add");
  }

  /** Fetching twenty postings one click at a time is the most tedious part of
      using this. Do the whole shortlist in one pass instead. */
  async function tailorAll() {
    const list = (search.strong || []).slice(0, 12);
    if (!list.length) {
      ui.toast("Run a search first");
      return;
    }
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < list.length; i++) {
      const j = list[i];
      setBatchMsg({ kind: "", text: "Preparing " + (i + 1) + " of " + list.length + ": " + j.title + "..." });
      if (S.jobs.some((x) => appKey(x.url) === appKey(j.url))) {
        skipped++;
        continue;
      }
      let text = "";
      try {
        const d = await fetchJob(j.url);
        text = d.text || "";
      } catch {
        /* fall back to the little we have */
      }
      if (!text) text = j.title + "\n" + j.co + "\n" + (j.loc || "") + "\n" + (j.hits || []).join(", ");
      const nj = newJob({ title: j.title, co: j.co, url: j.url, text });
      nj.kw = kwFromText(text, { co: j.co, title: j.title, url: j.url });
      nj.pay = parsePay(j.title + " " + text.slice(0, 4000)) || j.pay || null;
      S.jobs.push(nj);
      added++;
    }
    S.activeJob = S.jobs.length ? S.jobs[S.jobs.length - 1].id : null;
    syncActive();
    save();
    setBatchMsg({
      kind: "good",
      text:
        added + " job" + (added === 1 ? "" : "s") + " saved and keyworded" +
        (skipped ? ", " + skipped + " already on your list" : "") +
        ". Each one keeps its own tailored resume. Open step 3 to see what matches.",
    });
  }

  async function doFetch() {
    const u = jUrl.trim();
    if (!u) {
      setUrlMsg({ kind: "bad", text: "Paste the link to the posting first." });
      return;
    }
    setFetching(true);
    setUrlMsg(null);
    /* The batch line is about the last thing Tailor did. Once the user starts a
       new fetch it is stale, and two contradictory messages on screen is worse
       than none. */
    setBatchMsg(null);
    try {
      const d = await fetchJob(u);
      if (d.title) setJTitle(d.title);
      if (d.co) setJCo(d.co);
      setJText(d.text || "");
      setUrlMsg({
        kind: "good",
        text: "Fetched " + (d.title || "the posting") + ". Check it below, then save the job.",
      });
    } catch (e) {
      setUrlMsg({ kind: "bad", text: (e as Error).message });
    } finally {
      setFetching(false);
    }
  }

  function parseJD() {
    const raw = jText;
    if (!raw.trim()) {
      ui.toast("Add the posting text first");
      return;
    }
    const title = jTitle.trim();
    const co = jCo.trim();
    const url = jUrl.trim();
    /* Read the company and title FIRST. The employer's own name is not a skill,
       and it used to be scored and then reported as a gap, which docked the
       candidate for not having previously worked at the company. */
    const kw = kwFromText(raw, { co, title, url });

    /* Applying twice to the same posting is a real and embarrassing failure,
       and the tool is the only thing in a position to notice. */
    const prior = S.apps[appKey(url)];
    const cur = activeJob();
    if (url && prior && prior.applied && !(cur && cur.url === url)) {
      if (
        !confirm(
          "You already applied to this posting on " +
            new Date(prior.applied).toLocaleDateString() +
            ".\n\nSave it again anyway?",
        )
      )
        return;
    }
    /* Board APIs only publish a title and a location, so pay almost never shows
       up at search time. The full posting text is where it actually lives. */
    const pay = parsePay(title + " " + raw.slice(0, 4000));
    /* Editing the job that is already open updates it. Anything else is a new
       saved job, so two applications never overwrite each other. */
    if (cur && cur.text === raw) {
      cur.title = title;
      cur.co = co;
      cur.url = url;
      cur.kw = kw;
      cur.pay = pay;
    } else {
      const j = newJob({ title, co, url, text: raw, kw });
      j.pay = pay;
      S.jobs.push(j);
      S.activeJob = j.id;
    }
    syncActive();
    save();
    ui.toast("Saved. " + kw.length + " terms read from the posting.");
    ui.go(2);
  }

  /* ---------- thin-results suggestions ----------
     Every suggestion is a one-click loosener that re-runs the search with a
     specific filter widened. Fewer than 10 results OR fewer than 3 unique
     companies counts as thin. */
  const suggestions = useMemo(() => {
    if (!search.lastRun) return null;
    const results = search.strong.concat(search.possible);
    const uniqCo: Record<string, 1> = {};
    results.forEach((j) => {
      if (j.co) uniqCo[String(j.co).toLowerCase()] = 1;
    });
    const coCount = Object.keys(uniqCo).length;
    if (!(results.length < 10 || coCount < 3)) return null;

    const suggs: { label: string; apply: () => void }[] = [];
    if (form.loc)
      suggs.push({ label: 'Remove the location filter (currently "' + form.loc + '")', apply: () => doSearch({ loc: "" }) });
    if (form.types.length)
      suggs.push({ label: "Turn off the " + form.types.join(", ") + " filter", apply: () => doSearch({ types: [] }) });
    if (form.types.indexOf("remote") < 0)
      suggs.push({ label: "Also include remote roles", apply: () => doSearch({ types: [...form.types, "remote"] }) });
    if (form.level === "on")
      suggs.push({ label: "Show every seniority level, not only mine", apply: () => doSearch({ level: "off" }) });
    if (form.pay)
      suggs.push({
        label: "Drop the pay floor (currently " + Number(form.pay).toLocaleString() + ")",
        apply: () => doSearch({ pay: "" }),
      });
    if (form.win !== "0")
      suggs.push({ label: "Widen the time window to any time", apply: () => doSearch({ win: "0" }) });
    if (form.keywords && form.keywords.split(",").length > 1) {
      const first = form.keywords.split(",")[0].trim();
      suggs.push({ label: 'Search only the first keyword: "' + first + '"', apply: () => doSearch({ keywords: first }) });
    }
    if (form.keywords)
      suggs.push({ label: "Clear the extra keywords, use your profile only", apply: () => doSearch({ keywords: "" }) });

    /* Adjacent titles. Read the profile families and offer the ones that are
       not already in the profile. */
    const ptitles = (S.profile.titles || []).map((t) => t.toLowerCase());
    const adjacent: Record<string, 1> = {};
    ptitles.forEach((t) => {
      FAMILIES.forEach((fam) => {
        if (fam.some((m) => t.indexOf(m) > -1 || m.indexOf(t) > -1)) {
          fam.slice(0, 4).forEach((m) => {
            if (!ptitles.some((pt) => pt.indexOf(m) > -1)) adjacent[m] = 1;
          });
        }
      });
    });
    const adjs = Object.keys(adjacent).slice(0, 4);
    if (adjs.length)
      suggs.push({ label: "Try adjacent titles: " + adjs.join(", "), apply: () => doSearch({ keywords: adjs.join(", ") }) });

    const reasons: string[] = [];
    if (results.length < 10) reasons.push("only " + results.length + " total result" + (results.length === 1 ? "" : "s"));
    if (coCount < 3) reasons.push("only " + coCount + " unique compan" + (coCount === 1 ? "y" : "ies"));
    return { suggs, reasons };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, form]);

  const wide = search.showAll || search.autoWide;

  return (
    <section className="panel">
      <div className="head">
        <h1>The jobs you are going for</h1>
        <p>
          Search live boards for roles that match your evidence, or add a posting yourself. Each job
          keeps its own tailored resume.
        </p>
      </div>

      <div className="seg" role="group" aria-label="Job source" style={{ marginBottom: 16 }}>
        <button aria-pressed={tab === "find"} onClick={() => setTab("find")}>Find roles for me</button>
        <button aria-pressed={tab === "add"} onClick={() => setTab("add")}>Add one myself</button>
      </div>

      {/* Above the tabs on purpose. Tailor and Prepare-all both switch the user
          to the Add pane, and a message rendered inside the Find pane went with
          it, so "the full text could not be read from that board" was written
          and then immediately hidden. */}
      {batchMsg && <Msg kind={batchMsg.kind}>{batchMsg.text}</Msg>}

      {tab === "find" && (
        <div className="grid2">
          <div>
            <div className="callout" style={{ marginBottom: 14 }}>
              <b>Start broad.</b> Every filter here is set to the widest option so the first run reads
              the biggest possible pool. If the results are too many, narrow after. If they are too
              few, the panel below the results will point at the filter that is costing you volume.
              <span
                className="tag"
                style={{
                  marginLeft: 8, verticalAlign: 2,
                  background: isBroadest(form) ? "var(--audited-bg)" : "var(--estimated-bg)",
                  borderColor: isBroadest(form) ? "var(--audited)" : "var(--estimated)",
                  color: isBroadest(form) ? "var(--audited)" : "var(--estimated)",
                }}
              >
                {isBroadest(form) ? "Broadest defaults" : "Narrowed"}
              </span>
            </div>

            <div className="card" style={{ marginBottom: 18 }}>
              <div className="row">
                <div className="field">
                  <label htmlFor="sWindow">Posted within</label>
                  <select id="sWindow" value={form.win} onChange={(e) => setForm({ ...form, win: e.target.value })}>
                    <option value="1">Last hour</option>
                    <option value="6">Last 6 hours</option>
                    <option value="12">Last 12 hours</option>
                    <option value="24">Last 24 hours</option>
                    <option value="72">Last 3 days</option>
                    <option value="168">Last 7 days</option>
                    <option value="336">Last 14 days</option>
                    <option value="720">Last 30 days</option>
                    <option value="0">Any time</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sDepth">Search depth</label>
                  <select id="sDepth" value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })}>
                    <option value="quick">Quick, 40 biggest boards</option>
                    <option value="full">Everything, all boards and feeds</option>
                  </select>
                  <div className="hint">Full reads about 15,000 listings and takes under a minute.</div>
                </div>
                <div className="field">
                  <label htmlFor="sLoc">Location</label>
                  <input
                    id="sLoc" type="text" placeholder="Canada, United States, Ontario, Toronto, Remote"
                    value={form.loc} onChange={(e) => setForm({ ...form, loc: e.target.value })}
                  />
                  <div className="hint">
                    Leave blank for anywhere. A country name matches every city and province inside
                    it, so Canada finds Toronto and Vancouver. Listings that only say Remote are
                    always kept.
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Employment type</label>
                <div className="chips">
                  {TYPE_CHIPS.map(([k, label]) => (
                    <button
                      className="chip"
                      key={k}
                      aria-pressed={form.types.indexOf(k) >= 0}
                      onClick={() =>
                        setForm({
                          ...form,
                          types: form.types.indexOf(k) >= 0 ? form.types.filter((t) => t !== k) : [...form.types, k],
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="hint">
                  All off is the broadest setting. Pressing a chip narrows the list. Boards label
                  these inconsistently, so type is read from the posting's own field and its title.
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label htmlFor="sPay">Pay floor, optional</label>
                  <input
                    id="sPay" type="number" placeholder="120000" min={0} step={5000}
                    value={form.pay} onChange={(e) => setForm({ ...form, pay: e.target.value })}
                  />
                  <div className="hint">
                    Annual. Hourly and monthly postings are converted before comparing. Roles that
                    publish no pay are always kept. Leave blank for the broadest search.
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="sLevel">Seniority</label>
                  <select id="sLevel" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                    <option value="on">Only my level, give or take one step</option>
                    <option value="off">Show every level</option>
                  </select>
                  <div className="hint">
                    Every level is the broadest setting. Narrow to your level once you see too much.
                  </div>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="sKeywords">Extra keywords, optional</label>
                <input
                  id="sKeywords" type="text" placeholder="designer, marketing, sql"
                  value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
                <div className="hint">Blank uses the skills already in your evidence.</div>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
                {state.profile.titles && state.profile.titles.length ? (
                  <>
                    <b>Searching as:</b> {state.profile.titles.slice(0, 3).join(", ")}{" "}
                    {LEVEL_LABEL[state.profile.level] && (
                      <span className="tag">{LEVEL_LABEL[state.profile.level]}</span>
                    )}{" "}
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => {
                        const v = prompt("Job titles to search for, separated by commas:", state.profile.titles.join(", "));
                        if (v == null) return;
                        S.profile.titles = v.split(",").map((s) => s.trim()).filter(Boolean);
                        setForm({ ...form, keywords: S.profile.titles.slice(0, 3).join(", ") });
                        save();
                        ui.toast("Updated. Search again to use it.");
                      }}
                    >
                      change
                    </button>
                  </>
                ) : (
                  <span className="hint">Add your evidence first and this fills itself in.</span>
                )}
              </div>

              <div className="btnrow">
                <button className="btn" disabled={running} onClick={() => doSearch()}>
                  Search live boards
                </button>
                {search.strong.length > 0 && (
                  <button className="btn ghost" onClick={tailorAll}>
                    Prepare all {Math.min(search.strong.length, 12)} strong fits
                  </button>
                )}
                <button className="btn quiet sm" onClick={() => ui.open("sources")}>Sources</button>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{stat}</span>
              </div>
              {running && (
                <Msg>
                  <Spinner />
                  {progress}
                </Msg>
              )}
              {search.diag && <Diagnostics state={search} />}
            </div>

            {suggestions && (
              <div className="callout" style={{ borderLeftColor: "var(--estimated)", background: "#FDF3DC" }}>
                {suggestions.suggs.length ? (
                  <>
                    <b>Thin results ({suggestions.reasons.join(", ")}).</b> Each suggestion re-runs the
                    search with one filter widened. Try them in order.
                    <div className="btnrow" style={{ marginTop: 10, flexWrap: "wrap" }}>
                      {suggestions.suggs.map((s, i) => (
                        <button className="btn quiet sm" key={i} onClick={s.apply}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    Results are thin and every filter is already at its widest. The pool for this
                    search is small, or the free-tier keyed sources returned nothing this minute. Try
                    again in a minute, or open Sources to add a key for deeper coverage.
                  </>
                )}
              </div>
            )}

            <Results
              state={search}
              wide={wide}
              onToggle={() => setSearch(toggleShowAll(search))}
              onTailor={tailorFor}
              onGen={(j) => handOffToGen(j, ui, setBatchMsg)}
            />
          </div>

          <aside>
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 4 }}>How the search works</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                Your browser calls the public job APIs directly. Nothing about you is sent to any
                server, including your evidence, which is why matching happens on this device after
                the listings arrive.
              </p>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 0 }}>
                Dates are the board's own published timestamps, not a search engine's guess at
                freshness.
              </p>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 9 }}>Match score</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 0 }}>
                How much of what the posting asks for already appears in your graded evidence. Open
                any role to see exactly which terms hit and which are missing.
              </p>
            </div>
          </aside>
        </div>
      )}

      {tab === "add" && (
        <div className="grid2">
          <div>
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="field" style={{ marginBottom: 9 }}>
                <label htmlFor="jUrl">Link to the job posting</label>
                <div className="urlrow">
                  <input
                    id="jUrl" type="text" autoComplete="off" spellCheck={false}
                    placeholder="https://job-boards.greenhouse.io/acme/jobs/12345"
                    value={jUrl} onChange={(e) => setJUrl(e.target.value)}
                  />
                  <button className="btn" disabled={fetching} onClick={doFetch}>Fetch</button>
                </div>
                <div className="hint">
                  Works directly with Greenhouse, Lever, Ashby and SmartRecruiters postings. Sites
                  that block automated reads, such as LinkedIn and Indeed, will need the text pasted
                  instead.
                </div>
              </div>
              {fetching && (
                <Msg>
                  <Spinner />
                  Fetching the posting...
                </Msg>
              )}
              {urlMsg && <Msg kind={urlMsg.kind}>{urlMsg.text}</Msg>}

              <div className="or"><span>or enter it yourself</span></div>

              <div className="row">
                <div className="field">
                  <label htmlFor="jTitle">Role title</label>
                  <input id="jTitle" type="text" placeholder="Senior Operations Analyst" value={jTitle} onChange={(e) => setJTitle(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="jCo">Company</label>
                  <input id="jCo" type="text" placeholder="Acme" value={jCo} onChange={(e) => setJCo(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="jText">Full job description</label>
                <textarea
                  id="jText" style={{ minHeight: 190 }}
                  placeholder="Paste the whole posting, requirements and responsibilities included."
                  value={jText} onChange={(e) => setJText(e.target.value)}
                />
              </div>
              <div className="btnrow">
                <button className="btn" onClick={parseJD}>Save this job</button>
                <button
                  className="btn quiet"
                  onClick={() => { setJUrl(""); setJTitle(""); setJCo(""); setJText(""); setUrlMsg(null); }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <aside>
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 4 }}>What this posting asks for</h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {activeKw.length
                  ? activeKw.length +
                    " terms, most important first. The employer's own name is excluded, because it is not a skill."
                  : "Nothing read yet."}
              </p>
              <div className="tags" style={{ marginTop: 10 }}>
                {activeKw.map((o) => (
                  <span className="tag" key={o.k}>{o.k}</span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      <h3 style={{ fontSize: 14, margin: "24px 0 10px" }}>Saved jobs</h3>
      <SavedJobs
        onOpen={(id) => {
          S.activeJob = id;
          syncActive();
          save();
          setJTitle(S.jd.title || "");
          setJCo(S.jd.co || "");
          setJText(S.jd.text || "");
          setJUrl(S.jd.url || "");
          ui.toast("Now tailoring for " + (S.jd.title || "this job"));
        }}
      />
    </section>
  );
}

function handOffToGen(
  j: Listing,
  ui: ReturnType<typeof useUi>,
  setMsg: (m: { kind: "" | "good" | "bad" | "warn"; text: string } | null) => void,
) {
  /* A search result has less data than a saved job. If the user has never saved
     this one, save it first so the coverage maths has a full posting to work
     with and the tailored draft is retrievable without re-running the AI. */
  const existing = S.jobs.filter((x) => appKey(x.url) === appKey(j.url))[0];
  if (existing) {
    ui.openGen(existing);
    return;
  }
  setMsg({ kind: "", text: "Fetching the full posting for " + j.title + "..." });
  fetchJob(j.url)
    .then((d) => {
      const text = (d && d.text) || j.title + "\n" + j.co + "\n" + (j.loc || "") + "\n" + (j.hits || []).join(", ");
      const nj = newJob({ title: j.title, co: j.co, url: j.url, text });
      nj.kw = kwFromText(text, { co: j.co, title: j.title, url: j.url });
      nj.pay = parsePay(j.title + " " + text.slice(0, 4000)) || j.pay || null;
      S.jobs.push(nj);
      S.activeJob = nj.id;
      syncActive();
      save();
      setMsg(null);
      ui.openGen(nj);
    })
    .catch(() => {
      const text = j.title + "\n" + j.co + "\n" + (j.loc || "") + "\n" + (j.hits || []).join(", ");
      const nj = newJob({ title: j.title, co: j.co, url: j.url, text });
      nj.kw = kwFromText(text, { co: j.co, title: j.title, url: j.url });
      S.jobs.push(nj);
      S.activeJob = nj.id;
      syncActive();
      save();
      setMsg({
        kind: "warn",
        text:
          "Saved, but the full posting text could not be read from " + j.src +
          ". Paste the description into the modal for a sharper tailor.",
      });
      ui.openGen(nj);
    });
}

/* Surface which sources returned nothing, which returned data, and which failed
   outright. Before this existed a search that hit six 429s and thirty CORS
   preflight failures looked the same as one that ran clean and found no jobs. */
function Diagnostics({ state }: { state: SearchState }) {
  const d = state.diag;
  if (!d || !d.total) return null;
  const grouped: Record<string, number> = {};
  (d.errors || []).forEach((e) => {
    const key = (e.src || "unknown") + "::" + (e.code || "err");
    grouped[key] = (grouped[key] || 0) + 1;
  });
  const summary = Object.keys(grouped)
    .sort((a, b) => grouped[b] - grouped[a])
    .slice(0, 4)
    .map((k) => {
      const g = k.split("::");
      return g[0] + " (" + g[1] + ")";
    })
    .join(", ");
  const more = Object.keys(grouped).length - 4;
  const names = Object.keys(state.bySource).sort((a, b) => state.bySource[b] - state.bySource[a]);

  return (
    <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
      <span
        className="tag"
        style={{ background: "var(--audited-bg)", borderColor: "var(--audited)", color: "var(--audited)" }}
      >
        {d.ok} returned data
      </span>{" "}
      {d.empty ? <span className="tag">{d.empty} returned zero</span> : null}{" "}
      {d.failed ? (
        <>
          <span
            className="tag"
            style={{ background: "var(--none-bg)", borderColor: "var(--none)", color: "var(--none)" }}
          >
            {d.failed} failed
          </span>{" "}
          <span style={{ color: "var(--muted)" }}>
            Most common: {summary}
            {more > 0 ? ", plus " + more + " more" : ""}.
          </span>
        </>
      ) : null}
      {names.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: "pointer" }}>Where the listings came from</summary>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
            {names.map((nm) => {
              const c = state.bySource[nm];
              const thin = c < 5;
              return (
                <span
                  className="tag"
                  key={nm}
                  style={thin ? { color: "var(--none)", borderColor: "var(--none)" } : undefined}
                >
                  {nm} {c.toLocaleString()}
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)" }}>
            Anything in red returned almost nothing. That is either a small board or a source that
            has quietly stopped working.
          </div>
        </details>
      )}
    </div>
  );
}

function Results({
  state, wide, onToggle, onTailor, onGen,
}: {
  state: SearchState;
  wide: boolean;
  onToggle(): void;
  onTailor(j: Listing): void;
  onGen(j: Listing): void;
}) {
  const rows = state.results;
  const toggle =
    state.possible && state.possible.length ? (
      <>
        {state.autoWide && !state.showAll && (
          <div className="msg warn on" style={{ marginBottom: 12 }}>
            Only {state.strong.length} role{state.strong.length === 1 ? "" : "s"} cleared the strong
            bar this time, so the {state.possible.length} near misses are shown too. Widen the time
            window, or add more evidence so there is more to match against.
          </div>
        )}
        <div className="btnrow" style={{ marginBottom: 12 }}>
          <button className="btn quiet sm" onClick={onToggle}>
            {wide ? "Show strong fits only" : "Also show " + state.possible.length + " possible fits"}
          </button>
        </div>
      </>
    ) : null;

  if (!rows.length)
    return (
      <div>
        {toggle}
        <div className="empty">
          <h3>{state.lastRun ? "No strong fits in that window" : "No search run yet"}</h3>
          <p>
            {state.lastRun
              ? "Strong means the role is genuinely close to what you have done, including roles that use different words for it. Widen the time window, clear the location, or add more evidence so there is more to match against."
              : "Pick a time window and press Search. Add evidence first so roles can be scored against it."}
          </p>
        </div>
      </div>
    );

  return (
    <div>
      {toggle}
      {rows.map((j, i) => {
        const bd = band(j.pct || 0);
        const already = appliedTo(j.url);
        return (
          <div className="job" key={j.id + i} style={{ cursor: "default" }}>
            <span
              className={"job-cov" + (bd[1] ? " " + bd[1] : "")}
              title="Title-level pre-screen. The precise score is calculated once Tailor fetches the full posting."
            >
              {bd[0]}
            </span>
            <div className="job-main">
              <b>{j.title}</b>
              {j.isNew && <span className="tag hit" style={{ verticalAlign: 2 }}> new</span>}
              {already && <span className="tag" style={{ verticalAlign: 2 }}> applied {already}</span>}
              <span>
                {j.co}
                {j.loc ? " · " + j.loc : ""} · {relativeAge(j.ts)} · {j.src}
                {j.pay ? (
                  <>
                    {" "}· <b style={{ color: "var(--audited)" }}>{payLabel(j.pay)}</b>
                  </>
                ) : null}
              </span>
              <span style={{ color: "var(--ink-2)" }}>{whyMatched(j)}</span>
              <div className="tags" style={{ marginTop: 5 }}>
                {(j.hits || []).length ? (
                  (j.hits || []).slice(0, 7).map((h) => (
                    <span className="tag hit" key={h}>{h}</span>
                  ))
                ) : (
                  <span className="tag">no overlap with your evidence</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flex: "none", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <a className="btn quiet sm" href={j.url} target="_blank" rel="noopener">Open</a>
              <button className="btn sm" onClick={() => onTailor(j)}>Tailor</button>
              <button className="btn ghost sm" title="Generate an AI-tailored resume and CV" onClick={() => onGen(j)}>
                Resume + CV
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function appliedTo(url: string): string {
  const a = S.apps[appKey(url)];
  if (!a || !a.applied) return "";
  const days = Math.round((Date.now() - a.applied) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days + "d ago";
}

function SavedJobs({ onOpen }: { onOpen(id: string): void }) {
  const state = useAppState();
  const ui = useUi();
  if (!state.jobs.length)
    return (
      <div className="empty" style={{ padding: 24 }}>
        <h3>No jobs saved yet</h3>
        <p>Add one above and your entries get ranked against it.</p>
      </div>
    );
  return (
    <div>
      {state.jobs.map((j) => {
        const cov = coverageFor(j);
        const hasGen = !!(state.gen && state.gen[j.id]);
        return (
          <div
            className={"job" + (j.id === state.activeJob ? " active" : "")}
            key={j.id}
            onClick={() => onOpen(j.id)}
          >
            <div className="job-main">
              <b>{j.title || "Untitled role"}</b>
              <span>
                {j.co || ""}
                {j.co && j.url ? " · " : ""}
                {j.url ? j.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) : ""}
                {j.pay ? (
                  <>
                    {" "}· <b style={{ color: "var(--audited)" }}>{payLabel(j.pay)}</b>
                  </>
                ) : null}
                {hasGen ? <span style={{ color: "var(--audited)" }}> · tailored draft ready</span> : null}
              </span>
            </div>
            <span className={"job-cov" + (cov >= 60 ? " hi" : "")}>{cov}%</span>
            <button
              className="btn ghost sm"
              title="Generate an AI-tailored resume and CV"
              onClick={(e) => { e.stopPropagation(); ui.openGen(j); }}
            >
              {hasGen ? "Open tailored" : "Resume + CV"}
            </button>
            <button
              className="iconbtn"
              title="Remove"
              aria-label="Remove job"
              onClick={(e) => {
                e.stopPropagation();
                if (!confirm("Remove " + (j.title || "this job") + "?\n\nYour evidence entries are not affected."))
                  return;
                S.jobs = S.jobs.filter((x) => x.id !== j.id);
                if (S.activeJob === j.id) S.activeJob = S.jobs.length ? S.jobs[0].id : null;
                syncActive();
                save();
                ui.toast("Job removed");
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
