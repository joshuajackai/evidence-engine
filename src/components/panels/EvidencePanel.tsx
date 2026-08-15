import { useRef, useState } from "react";
import type { MetricType, Unit } from "@/types";
import { FREE_LIMIT, S, isPro, useAppState } from "@/store/state";
import { save } from "@/store/storage";
import { GRADE, GRADE_COLOUR, GRADE_ORDER, bullet, downloadBlob } from "@/lib/util";
import { useUi } from "@/ui/UiContext";
import { AiPanel } from "@/components/AiPanel";
import { useT } from "@/i18n";
import type { Strings } from "@/i18n/strings";

const BLANK = {
  org: "", role: "", dates: "", action: "", metricType: "none" as MetricType,
  metric: "", constraint: "", evidence: "", benchmark: "", tags: "",
};

export function EvidencePanel({ aiOn }: { aiOn: boolean }) {
  const state = useAppState();
  const ui = useUi();
  const t = useT();
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [err, setErr] = useState("");
  /* Which field the error belongs to, so it can be described and focused. */
  const [errField, setErrField] = useState<string>("");
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
    setErrField("");
    setOpen(true);
  }

  function saveEntry() {
    const mt = form.metricType;
    const u: Unit = {
      id: editing != null ? editing : Date.now(),
      org: form.org.trim(),
      role: form.role.trim(),
      dates: form.dates.trim(),
      action: form.action.trim(),
      metricType: mt,
      metric: mt === "none" ? "" : form.metric.trim(),
      constraint: mt === "none" ? "" : form.constraint.trim(),
      evidence: mt === "none" ? "" : form.evidence.trim(),
      benchmark: form.benchmark.trim(),
      tags: form.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    };
    /* Report the failure, mark the field, and put the cursor in it. Association
       makes it correct for a screen reader; moving focus makes it useful for
       everybody, which is why the audit chose both rather than either. */
    const fail = (msg: string, field: string) => {
      setErr(msg);
      setErrField(field);
      setTimeout(() => document.getElementById(field)?.focus(), 0);
      return;
    };
    if (!u.org) return fail(t.errOrg, "fOrg");
    if (!u.action) return fail(t.errAction, "fAction");
    if (mt !== "none" && !u.metric) return fail(t.errMetric, "fMetric");
    if (mt === "audited" && !u.evidence) return fail(t.errEvidenceAudited, "fEvidence");
    if (mt === "estimated" && !u.evidence) return fail(t.errEvidenceEstimated, "fEvidence");
    setErrField("");

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
        <h1>{t.evidenceTitle}</h1>
        <p>{t.evidenceBlurb}</p>
      </div>

      <div className="grid2">
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="btnrow" style={{ marginBottom: 14 }}>
              <button className="btn" onClick={() => ui.open("paste")}>{t.pasteMyResume}</button>
              <button className="btn ghost" onClick={() => ui.open("prep")}>{t.cleanUpFirst}</button>
              <button className="btn ghost" onClick={() => openEditor(null)}>{t.addByHand}</button>
              <button className="btn quiet sm" onClick={loadDemo}>{t.seeExample}</button>
              <button className="btn quiet sm" onClick={() => fileRef.current?.click()}>{t.openSavedFile}</button>
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
                {t.saveToFile}
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
                    <label htmlFor="fOrg">{t.fieldOrg}</label>
                    <input
                      id="fOrg" type="text" placeholder="Northwind Logistics" autoFocus
                      autoComplete="organization"
                      aria-invalid={errField === "fOrg" || undefined}
                      aria-describedby={errField === "fOrg" ? "entryErr" : undefined}
                      value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="fRole">{t.fieldRole}</label>
                    <input
                      id="fRole" type="text" placeholder="Operations Analyst"
                      value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="fDates">{t.fieldDates}</label>
                  <input
                    id="fDates" type="text" placeholder="March 2024 to Present"
                    value={form.dates} onChange={(e) => setForm({ ...form, dates: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fAction">
                    {t.fieldAction}
                    <span className="hint">{t.fieldActionHint}</span>
                  </label>
                  <textarea
                    id="fAction"
                    aria-invalid={errField === "fAction" || undefined}
                    aria-describedby={errField === "fAction" ? "entryErr" : undefined}
                    placeholder="Rebuilt the returns workflow after tracing 60% of support tickets to one unlabelled form field"
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fType">
                    {t.fieldType}
                    <span className="hint">{t.fieldTypeHint}</span>
                  </label>
                  <select
                    id="fType"
                    value={form.metricType}
                    onChange={(e) => setForm({ ...form, metricType: e.target.value as MetricType })}
                  >
                    <option value="none">{t.typeNone}</option>
                    <option value="audited">{t.typeAudited}</option>
                    <option value="estimated">{t.typeEstimated}</option>
                    <option value="activity">{t.typeActivity}</option>
                  </select>
                </div>

                {form.metricType !== "none" && (
                  <div>
                    <div className="row">
                      <div className="field">
                        <label htmlFor="fMetric">{t.fieldMetric}</label>
                        <input
                          id="fMetric" type="text" placeholder="Support tickets down 41%"
                          aria-invalid={errField === "fMetric" || undefined}
                          aria-describedby={errField === "fMetric" ? "entryErr" : undefined}
                          value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="fConstraint">
                          {t.fieldConstraint}
                          <span className="hint">{t.fieldConstraintHint}</span>
                        </label>
                        <input
                          id="fConstraint" type="text" placeholder="Same headcount, same season"
                          value={form.constraint} onChange={(e) => setForm({ ...form, constraint: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="fEvidence">{t.fieldEvidence}</label>
                      <input
                        id="fEvidence" type="text" placeholder="Zendesk monthly export, Q2 against Q1"
                        aria-invalid={errField === "fEvidence" || undefined}
                        aria-describedby={errField === "fEvidence" ? "entryErr" : undefined}
                        value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fTags">
                    {t.fieldTags}
                    <span className="hint">{t.fieldTagsHint}</span>
                  </label>
                  <input
                    id="fTags" type="text" placeholder="process design, zendesk, sql, workflow automation"
                    value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>

                <div className="quarantine">
                  <div className="qh">
                    <span className="dot" />
                    {t.quarantineTitle}
                  </div>
                  <input
                    type="text"
                    placeholder="Industry average handling time is 6 minutes (Forrester, 2025)"
                    value={form.benchmark}
                    onChange={(e) => setForm({ ...form, benchmark: e.target.value })}
                  />
                  <p>{t.quarantineBody}</p>
                </div>

                <div className="btnrow" style={{ marginTop: 14 }}>
                  <button className="btn" onClick={saveEntry}>{t.saveEntry}</button>
                  <button className="btn quiet" onClick={() => { setOpen(false); setEditing(null); }}>
                    {t.cancel}
                  </button>
                  {err && (
                    <span className="msg bad on" id="entryErr" role="alert">
                      {err}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {aiOn && <AiPanel />}

          <div>
            {!state.units.length ? (
              <div className="empty">
                <h3>{t.noEntriesYet}</h3>
                <p>{t.noEntriesBlurb}</p>
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
                          {gradeLabel(u.metricType, t)}
                        </span>
                        <button
                          className="iconbtn"
                          title={t.editEntry + ": " + u.org}
                          aria-label={t.editEntry + ": " + u.org + ", " + (u.action || "").split(/\s+/).slice(0, 5).join(" ")}
                          onClick={() => openEditor(u.id)}
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                        <button
                          className="iconbtn"
                          title={t.deleteEntry + ": " + u.org}
                          aria-label={t.deleteEntry + ": " + u.org + ", " + (u.action || "").split(/\s+/).slice(0, 5).join(" ")}
                          onClick={() => removeEntry(u.id)}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    </div>
                    <div className="unit-body">{bullet(u)}</div>
                    {u.evidence && <div className="unit-meta" style={{ marginBottom: 7 }}>{t.entrySource}: {u.evidence}</div>}
                    {u.benchmark && (
                      <div className="unit-meta" style={{ marginBottom: 7, color: "var(--estimated)" }}>
                        {t.quarantinedNote}
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
            <div className="score-l">{t.resumeStrength}</div>
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
                    {gradeLabel(k, t)}
                  </span>
                  <b>{counts[k]}</b>
                </div>
              ))}
            </div>
            <div className="nextstep">{nextStep}</div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 9 }}>{t.gradesTitle}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{t.gradesRule}</p>
            <ul className="ladder">
              <li>
                <span className="k"><span className="grade g-audited"><span className="dot" />{t.gradeProven}</span></span>
                <span>{t.gradeProvenHelp}</span>
              </li>
              <li>
                <span className="k"><span className="grade g-estimated"><span className="dot" />{t.gradeEstimate}</span></span>
                <span>{t.gradeEstimateHelp}</span>
              </li>
              <li>
                <span className="k"><span className="grade g-activity"><span className="dot" />{t.gradeVolume}</span></span>
                <span>{t.gradeVolumeHelp}</span>
              </li>
              <li>
                <span className="k"><span className="grade g-none"><span className="dot" />{t.gradeNoNumber}</span></span>
                <span>{t.gradeNoNumberHelp}</span>
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


/** The four grade labels, through the catalogue rather than the constant. */
function gradeLabel(k: MetricType, t: Strings): string {
  return k === "audited" ? t.gradeProven
    : k === "estimated" ? t.gradeEstimate
    : k === "activity" ? t.gradeVolume
    : t.gradeNoNumber;
}
