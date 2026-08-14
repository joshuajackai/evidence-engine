import { useRef, useState } from "react";
import type { MetricType, Unit } from "@/types";
import { FREE_LIMIT, S, isPro, useAppState } from "@/store/state";
import { save } from "@/store/storage";
import { GRADE, GRADE_COLOUR, GRADE_ORDER, bullet, downloadBlob } from "@/lib/util";
import { useUi } from "@/ui/UiContext";
import { AiPanel } from "@/components/AiPanel";

const BLANK = {
  org: "", role: "", dates: "", action: "", metricType: "none" as MetricType,
  metric: "", constraint: "", evidence: "", benchmark: "", tags: "",
};

export function EvidencePanel({ aiOn }: { aiOn: boolean }) {
  const state = useAppState();
  const ui = useUi();
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function openEditor(id: number | null) {
    if (id == null && !isPro() && S.units.length >= FREE_LIMIT) {
      ui.open("paywall");
      return;
    }
    const u = id != null ? S.units.find((x) => x.id === id) : null;
    setEditing(id);
    setForm(
      u
        ? {
            org: u.org, role: u.role, dates: u.dates, action: u.action,
            metricType: u.metricType, metric: u.metric, constraint: u.constraint,
            evidence: u.evidence, benchmark: u.benchmark || "", tags: (u.tags || []).join(", "),
          }
        : { ...BLANK },
    );
    setErr("");
    setOpen(true);
  }

  function saveEntry() {
    const t = form.metricType;
    const u: Unit = {
      id: editing != null ? editing : Date.now(),
      org: form.org.trim(),
      role: form.role.trim(),
      dates: form.dates.trim(),
      action: form.action.trim(),
      metricType: t,
      metric: t === "none" ? "" : form.metric.trim(),
      constraint: t === "none" ? "" : form.constraint.trim(),
      evidence: t === "none" ? "" : form.evidence.trim(),
      benchmark: form.benchmark.trim(),
      tags: form.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    };
    if (!u.org) return setErr("Add the company or client.");
    if (!u.action) return setErr("Describe what you did.");
    if (t !== "none" && !u.metric)
      return setErr("You chose a graded type, so the number is required. Switch to No number if none exists.");
    if (t === "audited" && !u.evidence)
      return setErr("Audited means you can name the source. Add it, or downgrade to Estimated.");
    if (t === "estimated" && !u.evidence)
      return setErr("Estimated needs your reasoning, so you can defend it out loud.");

    if (editing != null) S.units = S.units.map((x) => (x.id === u.id ? u : x));
    else S.units.push(u);
    save();
    setOpen(false);
    setEditing(null);
    ui.toast("Entry saved");
  }

  function removeEntry(id: number) {
    const gone = S.units.find((x) => x.id === id);
    if (
      !confirm(
        "Delete this entry?\n\n" +
          (gone ? gone.org + ": " + (gone.action || "").slice(0, 80) : "") +
          "\n\nThis cannot be undone.",
      )
    )
      return;
    S.units = S.units.filter((x) => x.id !== id);
    delete S.picked[id];
    save();
    ui.toast("Entry deleted");
  }

  function loadDemo() {
    S.units = DEMO_UNITS();
    S.hdr = {
      name: "Alex Moreno", title: "Operations Analyst", loc: "Denver, CO",
      email: "alex@example.com", phone: "+1-555-0142", link: "linkedin.com/in/example",
      summary:
        "Operations analyst who traces a problem to its cause before proposing a fix. Four years " +
        "across logistics and retail, with the numbers to walk through.",
    };
    S.picked = {};
    save();
    ui.toast("Example loaded. Note entry four: no number, and that is fine.");
  }

  function importFile(f: File) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (Array.isArray(d.units)) S.units = d.units;
        if (d.hdr) S.hdr = d.hdr;
        save();
        ui.toast("Imported " + S.units.length + " entries");
      } catch {
        ui.toast("That file could not be read");
      }
    };
    r.readAsText(f);
  }

  /* ---------- score ---------- */
  const n = state.units.length;
  const counts: Record<MetricType, number> = { audited: 0, estimated: 0, activity: 0, none: 0 };
  state.units.forEach((u) => counts[u.metricType]++);
  const pts = counts.audited * 100 + counts.estimated * 70 + counts.activity * 45 + counts.none * 10;
  const score = n ? Math.round(pts / n) : 0;

  /* Tell the user what to do next. An empty screen with a score on it is not
     guidance, and this was the single biggest gap in the first usability pass. */
  let nextStep: React.ReactNode;
  if (!n)
    nextStep = <><b>Start here.</b> Paste your existing resume and it will be split into entries you can grade.</>;
  else if (counts.none === n)
    nextStep = <><b>Next.</b> Open any entry and answer the number question. Even one <b>Proven</b> line changes how the page reads.</>;
  else if (counts.none > 0)
    nextStep = <><b>{counts.none} still ungraded.</b> Work through them, then paste the job you are going for in step 2.</>;
  else if (!state.jd.kw || !state.jd.kw.length)
    nextStep = <><b>All graded.</b> Now paste the job description in step 2 so the right entries get picked.</>;
  else nextStep = <><b>Ready.</b> Step 4 has your resume.</>;

  return (
    <section className="panel">
      <div className="head">
        <h2>Everything you have done, one thing at a time</h2>
        <p>
          Add each thing separately. Beside every one you will see the grade a hiring manager is
          already assigning in their head. Seeing it first is the advantage.
        </p>
      </div>

      <div className="grid2">
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="btnrow" style={{ marginBottom: 14 }}>
              <button className="btn" onClick={() => ui.open("paste")}>Paste my resume</button>
              <button className="btn ghost" onClick={() => ui.open("prep")}>Clean up my resume first</button>
              <button className="btn ghost" onClick={() => openEditor(null)}>Add one by hand</button>
              <button className="btn quiet sm" onClick={loadDemo}>See an example</button>
              <button className="btn quiet sm" onClick={() => fileRef.current?.click()}>Open saved file</button>
              <button
                className="btn quiet sm"
                onClick={() => {
                  downloadBlob(
                    "evidence-inventory.json",
                    "application/json",
                    JSON.stringify({ units: S.units, hdr: S.hdr }, null, 2),
                  );
                  ui.toast("Inventory exported");
                }}
              >
                Save to file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {open && (
              <div>
                <div className="row">
                  <div className="field">
                    <label htmlFor="fOrg">Company or client</label>
                    <input
                      id="fOrg" type="text" placeholder="Northwind Logistics" autoFocus
                      value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="fRole">Your role</label>
                    <input
                      id="fRole" type="text" placeholder="Operations Analyst"
                      value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="fDates">Dates</label>
                  <input
                    id="fDates" type="text" placeholder="March 2024 to Present"
                    value={form.dates} onChange={(e) => setForm({ ...form, dates: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fAction">
                    What you did
                    <span className="hint">
                      Start with a verb you can defend. Rebuilt, migrated, coded, diagnosed,
                      negotiated. Avoid words that hide your hands, such as optimized or leveraged.
                    </span>
                  </label>
                  <textarea
                    id="fAction"
                    placeholder="Rebuilt the returns workflow after tracing 60% of support tickets to one unlabelled form field"
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fType">
                    Is there a number attached to this
                    <span className="hint">
                      Be honest. This grade is the whole point, and it is the question an interviewer
                      will ask.
                    </span>
                  </label>
                  <select
                    id="fType"
                    value={form.metricType}
                    onChange={(e) => setForm({ ...form, metricType: e.target.value as MetricType })}
                  >
                    <option value="none">Not yet, or there is no number</option>
                    <option value="audited">Yes, and I can show where it came from</option>
                    <option value="estimated">Yes, but it is my own estimate</option>
                    <option value="activity">Only a volume count, such as how many I did</option>
                  </select>
                </div>

                {form.metricType !== "none" && (
                  <div>
                    <div className="row">
                      <div className="field">
                        <label htmlFor="fMetric">The number</label>
                        <input
                          id="fMetric" type="text" placeholder="Support tickets down 41%"
                          value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="fConstraint">
                          What stayed the same
                          <span className="hint">This turns a claim into evidence.</span>
                        </label>
                        <input
                          id="fConstraint" type="text" placeholder="Same headcount, same season"
                          value={form.constraint} onChange={(e) => setForm({ ...form, constraint: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="fEvidence">Where the number came from</label>
                      <input
                        id="fEvidence" type="text" placeholder="Zendesk monthly export, Q2 against Q1"
                        value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fTags">
                    Skills and tools
                    <span className="hint">
                      Comma separated. These are what get matched against a job description.
                    </span>
                  </label>
                  <input
                    id="fTags" type="text" placeholder="process design, zendesk, sql, workflow automation"
                    value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>

                <div className="quarantine">
                  <div className="qh">
                    <span className="dot" />
                    Quarantine: industry statistics
                  </div>
                  <input
                    type="text"
                    placeholder="Industry average handling time is 6 minutes (Forrester, 2025)"
                    value={form.benchmark}
                    onChange={(e) => setForm({ ...form, benchmark: e.target.value })}
                  />
                  <p>
                    Anything typed here is stored for interview preparation and is{" "}
                    <b>locked out of your resume permanently</b>. A statistic sitting next to your
                    name gets read as your result. That is the mistake this tool exists to prevent.
                  </p>
                </div>

                <div className="btnrow" style={{ marginTop: 14 }}>
                  <button className="btn" onClick={saveEntry}>Save entry</button>
                  <button className="btn quiet" onClick={() => { setOpen(false); setEditing(null); }}>
                    Cancel
                  </button>
                  {err && <span className="msg bad on">{err}</span>}
                </div>
              </div>
            )}
          </div>

          {aiOn && <AiPanel />}

          <div>
            {!state.units.length ? (
              <div className="empty">
                <h3>No entries yet</h3>
                <p>Add your first, or load the example to see how grading works.</p>
              </div>
            ) : (
              state.units.map((u) => {
                const g = GRADE[u.metricType];
                return (
                  <div className={"unit " + g[0]} key={u.id}>
                    <div className="unit-top">
                      <div>
                        <div className="unit-org">{u.org}</div>
                        <div className="unit-meta">
                          {u.role || ""}
                          {u.dates ? " · " + u.dates : ""}
                        </div>
                      </div>
                      <div className="unit-actions">
                        <span className={"grade " + g[1]}>
                          <span className="dot" />
                          {g[2]}
                        </span>
                        <button className="iconbtn" title="Edit" aria-label="Edit entry" onClick={() => openEditor(u.id)}>
                          ✎
                        </button>
                        <button className="iconbtn" title="Delete" aria-label="Delete entry" onClick={() => removeEntry(u.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="unit-body">{bullet(u)}</div>
                    {u.evidence && <div className="unit-meta" style={{ marginBottom: 7 }}>Source: {u.evidence}</div>}
                    {u.benchmark && (
                      <div className="unit-meta" style={{ marginBottom: 7, color: "var(--estimated)" }}>
                        Quarantined statistic, interview use only
                      </div>
                    )}
                    <div className="tags">
                      {(u.tags || []).map((t) => (
                        <span className="tag" key={t}>{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="score-n">{score}</div>
            <div className="score-l">Resume strength</div>
            <div className="bar">
              {n ? (
                GRADE_ORDER.map((k) => (
                  <i key={k} style={{ width: (counts[k] / n) * 100 + "%", background: GRADE_COLOUR[k] }} />
                ))
              ) : (
                <i style={{ width: "100%", background: "var(--band)" }} />
              )}
            </div>
            <div className="legend">
              {GRADE_ORDER.map((k) => (
                <div key={k}>
                  <span className={"grade g-" + k}>
                    <span className="dot" />
                    {GRADE[k][2]}
                  </span>
                  <b>{counts[k]}</b>
                </div>
              ))}
            </div>
            <div className="nextstep">{nextStep}</div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 9 }}>How the grades work</h3>
            <p style={{ fontSize: 13, color: "var(--ink-2)" }}>Aim as high as the truth allows, then stop.</p>
            <ul className="ladder">
              <li>
                <span className="k"><span className="grade g-audited"><span className="dot" />Proven</span></span>
                <span>Your number, and you can say where it came from.</span>
              </li>
              <li>
                <span className="k"><span className="grade g-estimated"><span className="dot" />Estimate</span></span>
                <span>Your number, worked out by you. Say so out loud in the interview.</span>
              </li>
              <li>
                <span className="k"><span className="grade g-activity"><span className="dot" />Volume</span></span>
                <span>How much you did. Weaker than a result, better than nothing.</span>
              </li>
              <li>
                <span className="k"><span className="grade g-none"><span className="dot" />No number</span></span>
                <span>Perfectly fine. Leave it unquantified rather than inventing something.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* The example. Entry four deliberately carries no number, because "no number"
   being an acceptable answer is the whole argument this product is making. */
function DEMO_UNITS(): Unit[] {
  return [
    {
      id: 1, org: "Northwind Logistics", role: "Operations Analyst", dates: "March 2024 to Present",
      action: "Rebuilt the returns workflow after tracing 60% of support tickets to one unlabelled form field",
      metricType: "audited", metric: "Support tickets down 41%", constraint: "Same headcount, same season",
      evidence: "Zendesk monthly export, Q2 against Q1", benchmark: "",
      tags: ["process design", "zendesk", "workflow automation", "sql"],
    },
    {
      id: 2, org: "Northwind Logistics", role: "Operations Analyst", dates: "March 2024 to Present",
      action: "Wrote the SQL models behind the weekly operations review, replacing a spreadsheet three people maintained by hand",
      metricType: "estimated", metric: "Roughly 6 hours a week returned to the team",
      constraint: "Same reporting cadence",
      evidence: "Three people at about two hours each, measured against their own time logs",
      benchmark: "", tags: ["sql", "data analysis", "reporting", "automation"],
    },
    {
      id: 3, org: "Brightside Retail", role: "Coordinator", dates: "2022 to 2024",
      action: "Ran the vendor onboarding queue and rewrote the intake checklist after two shipments cleared with missing paperwork",
      metricType: "activity", metric: "94 vendors onboarded", constraint: "",
      evidence: "Internal vendor register",
      benchmark: "Industry onboarding error rates run near 8% (trade body figure, 2024)",
      tags: ["vendor management", "process improvement", "stakeholder management"],
    },
    {
      id: 4, org: "Brightside Retail", role: "Coordinator", dates: "2022 to 2024",
      action: "Trained six seasonal hires on the intake system each autumn and wrote the handbook they still use",
      metricType: "none", metric: "", constraint: "", evidence: "", benchmark: "",
      tags: ["training", "documentation", "onboarding"],
    },
  ];
}
