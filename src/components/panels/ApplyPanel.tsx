/* =========================================================================
   STEP 5, APPLY
   Everything here exists because the work does not end when the resume looks
   right. The form still wants twelve answers, the letter still has to be
   written, and the follow-up a week later is the part that actually produces
   replies and the part everybody forgets.
   ========================================================================= */
import { useEffect, useState } from "react";
import type { AppStatus, Job } from "@/types";
import { S, activeJob, syncActive, useAppState } from "@/store/state";
import { backups, restoreSnapshot, save } from "@/store/storage";
import { appKey, copyText, downloadBlob } from "@/lib/util";
import { ANSWER_FIELDS, STATUSES } from "@/lib/answers";
import { WRITER_TABS, writerText, type WriterKind } from "@/lib/writers";
import { coverageFor } from "@/lib/jd/match";
import { aiCall, aiReady } from "@/lib/ai/client";
import { useUi } from "@/ui/UiContext";
import { Msg, Spinner } from "@/components/Toast";

export function appFor(j: Job) {
  const k = appKey(j.url || j.id);
  if (!S.apps[k])
    S.apps[k] = { status: "saved", applied: 0, followed: 0, title: j.title, co: j.co, url: j.url };
  S.apps[k].title = j.title;
  S.apps[k].co = j.co;
  S.apps[k].url = j.url;
  return S.apps[k];
}

export function needsFollowUp(): { j: Job; days: number }[] {
  const out: { j: Job; days: number }[] = [];
  const now = Date.now();
  S.jobs.forEach((j) => {
    const a = S.apps[appKey(j.url || j.id)];
    if (!a || a.status !== "applied" || !a.applied) return;
    const days = Math.floor((now - a.applied) / 86400000);
    if (days >= 6 && !a.followed) out.push({ j, days });
  });
  return out;
}

export function ApplyPanel({ atsScore }: { atsScore: number }) {
  const state = useAppState();
  const ui = useUi();
  const [writer, setWriter] = useState<WriterKind>("fit");
  const [writeBox, setWriteBox] = useState("");
  const [writeMsg, setWriteMsg] = useState("");
  const [tighten, setTighten] = useState<{ busy: boolean; out: string; err: boolean } | null>(null);
  const job = activeJob();

  useEffect(() => {
    setWriteBox(writerText(writer));
    setWriteMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writer, state.activeJob, ui.writerJump]);

  const due = needsFollowUp();

  return (
    <section className="panel">
      <div className="head">
        <h2>Send it, and keep track of what you sent</h2>
        <p>
          Everything an application form asks for, written once and reused. The tracker is here
          because the follow-up is where most interviews actually come from, and it is the part
          everybody drops.
        </p>
      </div>

      {due.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--accent)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>
            {due.length} application{due.length === 1 ? "" : "s"} worth a nudge
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
            A short follow-up after a week is the cheapest thing in a job search and almost nobody
            sends one. Two sentences is enough: you applied, you are still interested, here is the
            one result most relevant to them.
          </p>
          {due.map((d) => (
            <div className="job" key={d.j.id}>
              <div className="job-main">
                <b>{d.j.title || "Untitled"}</b>
                <span>
                  {d.j.co || ""} · applied {d.days} days ago
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button
                  className="btn sm"
                  onClick={() => {
                    S.activeJob = d.j.id;
                    syncActive();
                    save();
                    setWriter("reach");
                    ui.jumpToWriter();
                  }}
                >
                  Draft it
                </button>
                <button
                  className="btn quiet sm"
                  onClick={() => {
                    appFor(d.j).followed = Date.now();
                    save();
                    ui.toast("Logged. It will not ask again.");
                  }}
                >
                  Sent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid2">
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, marginBottom: 2 }}>Ready to send</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
              For the job you have open. Every line is checkable, so nothing here is a guess about
              whether you are ready.
            </p>
            <ReadyList atsScore={atsScore} />
            <div className="btnrow" style={{ marginTop: 14 }}>
              <a
                className={"btn" + (job?.url ? "" : " disabled")}
                href={job?.url || undefined}
                target="_blank"
                rel="noopener"
                onClick={() => {
                  if (!job) return;
                  const a = appFor(job);
                  if (a.status === "saved") {
                    a.status = "applied";
                    a.applied = a.applied || Date.now();
                  }
                  save();
                }}
              >
                Open the application
              </a>
              <button
                className="btn ghost"
                onClick={() => {
                  if (!job) {
                    ui.toast("No job open");
                    return;
                  }
                  const a = appFor(job);
                  a.status = "applied";
                  a.applied = a.applied || Date.now();
                  save();
                  ui.toast("Logged. It will remind you to follow up in six days.");
                }}
              >
                Mark as applied
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 15 }}>Things you write once</h3>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Built only from words you already wrote
              </span>
            </div>
            <div className="seg" role="group" aria-label="Which piece" style={{ margin: "12px 0 14px" }}>
              {WRITER_TABS.map(([k, label]) => (
                <button key={k} aria-pressed={writer === k} onClick={() => setWriter(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="field">
              <textarea
                id="writeBox"
                style={{ minHeight: 230 }}
                value={writeBox}
                onChange={(e) => setWriteBox(e.target.value)}
              />
            </div>
            <div className="btnrow">
              <button
                className="btn"
                onClick={() => {
                  copyText(writeBox);
                  setWriteMsg("Copied.");
                }}
              >
                Copy
              </button>
              <button
                className="btn quiet sm"
                onClick={() => {
                  setWriteBox(writerText(writer));
                  ui.toast("Rebuilt from your current evidence");
                }}
              >
                Rebuild from my evidence
              </button>
              {aiReady() && (
                <button
                  className="btn ghost sm"
                  onClick={async () => {
                    setTighten({ busy: true, out: "", err: false });
                    try {
                      const txt = await aiCall(
                        "Tighten the note below. Keep every fact exactly as written, change no " +
                          "numbers, add nothing. Return only the rewritten note.\n\n" + writeBox,
                      );
                      setTighten({ busy: false, out: txt, err: false });
                    } catch (e) {
                      setTighten({ busy: false, out: "Failed: " + (e as Error).message, err: true });
                    }
                  }}
                >
                  Tighten with my AI
                </button>
              )}
            </div>
            {writeMsg && <Msg kind="good">{writeMsg}</Msg>}
            {tighten && (
              <div className={"ai-out on" + (tighten.err ? " err" : "")}>
                {tighten.busy ? (
                  <>
                    <Spinner />
                    Working...
                  </>
                ) : (
                  <>
                    {tighten.out}
                    {!tighten.err && (
                      <>
                        <br />
                        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setWriteBox(tighten.out)}>
                          Use this version
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 2 }}>Your applications</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
              Status is yours to set. Nothing is sent or checked on your behalf.
            </p>
            <Tracker />
          </div>
        </div>

        <aside>
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 2 }}>Answer bank</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
              The same twelve questions, every form, forever. Fill them in once and copy each one in
              a click.
            </p>
            <AnswerBank />
          </div>
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 6 }}>Backups</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              Snapshots are kept on this device so a mistake is recoverable. Downloading one is the
              only way to move to another computer.
            </p>
            <Backups />
            <div className="btnrow">
              <button
                className="btn quiet sm"
                onClick={() =>
                  downloadBlob(
                    "evidence-engine-" + new Date().toISOString().slice(0, 10) + ".json",
                    "application/json",
                    JSON.stringify(S, null, 2),
                  )
                }
              >
                Download everything
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReadyList({ atsScore }: { atsScore: number }) {
  const ui = useUi();
  const j = activeJob();
  if (!j)
    return (
      <div className="empty" style={{ padding: 20 }}>
        <h3>No job open</h3>
        <p>Save a posting in step 2 and this fills in.</p>
      </div>
    );

  const picked = S.units.filter((u) => j.picked[u.id] !== false);
  const cov = coverageFor(j);
  const graded = picked.filter((u) => u.metricType !== "none").length;
  const hdrOk = !!(S.hdr.name && (S.hdr.email || S.hdr.phone));
  const ans = ANSWER_FIELDS.filter((f) => (S.answers[f.k] || "").trim()).length;

  const checks = [
    { ok: hdrOk, s: "Your name and a way to reach you", f: "The export says Your Name. Step 4, Edit heading.", go: 3 },
    { ok: picked.length >= 4, s: picked.length + " entries selected for this job", f: "Fewer than four entries selected. Step 3 picks them by relevance.", go: 2 },
    { ok: graded >= 2, s: graded + " of them carry a number", f: "Almost nothing here is quantified. Step 1, work down the list.", go: 0 },
    { ok: cov >= 45, s: "Covers " + cov + "% of what the posting asks for", f: "Covers only " + cov + "%. Step 3 shows exactly which words are missing.", go: 2 },
    { ok: atsScore >= 95, s: "ATS structure " + (atsScore || "not checked yet") + (atsScore ? "/100" : ""), f: "Open step 4 once so the checker can run against the rendered page.", go: 3 },
    { ok: ans >= 6, s: ans + " of 12 screener answers saved", f: "Fill the answer bank once and every form after this is faster.", go: 4 },
  ];
  const left = checks.filter((c) => !c.ok).length;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        <b>{j.title || "This role"}</b>
        {j.co ? " at " + j.co : ""}{" "}
        {left ? <span className="tag">{left} still to do</span> : <span className="tag hit">ready</span>}
      </div>
      <ul className="atslist">
        {checks.map((c, i) => (
          <li className={c.ok ? "ok" : "no"} key={i}>
            <span className="m">{c.ok ? "✓" : "✕"}</span>
            <span>
              {c.ok ? c.s : c.f}
              {!c.ok && (
                <>
                  {" "}
                  <button type="button" className="linkbtn" onClick={() => ui.go(c.go)}>
                    take me there
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tracker() {
  const state = useAppState();
  if (!state.jobs.length)
    return (
      <div className="empty" style={{ padding: 20 }}>
        <h3>Nothing tracked yet</h3>
        <p>Every job you save in step 2 appears here.</p>
      </div>
    );
  return (
    <div>
      {state.jobs.map((j) => {
        const a = appFor(j);
        const when = a.applied ? new Date(a.applied).toLocaleDateString() : "";
        return (
          <div className={"job" + (j.id === state.activeJob ? " active" : "")} key={j.id}>
            <div className="job-main">
              <b>{j.title || "Untitled role"}</b>
              <span>
                {j.co || ""}
                {when ? " · applied " + when : ""}
                {a.followed ? " · followed up" : ""}
              </span>
            </div>
            <select
              className="mini"
              aria-label="Status"
              value={a.status}
              onChange={(e) => {
                const v = e.target.value as AppStatus;
                a.status = v;
                if (v === "applied" && !a.applied) a.applied = Date.now();
                if (v === "saved") a.applied = 0;
                save();
              }}
            >
              {STATUSES.map((s) => (
                <option value={s} key={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function AnswerBank() {
  const state = useAppState();
  const ui = useUi();
  return (
    <div>
      {ANSWER_FIELDS.map((f) => {
        const v = state.answers[f.k] || "";
        return (
          <div className="ansrow" key={f.k}>
            <label>{f.q}</label>
            <div className="ansin">
              {f.type === "select" ? (
                <select
                  className="mini"
                  style={{ width: "100%" }}
                  value={v}
                  onChange={(e) => { S.answers[f.k] = e.target.value; save(); }}
                >
                  <option value="">Not set</option>
                  {(f.opts || []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={f.ph || ""}
                  value={v}
                  onChange={(e) => { S.answers[f.k] = e.target.value; save(); }}
                />
              )}
              <button
                className="iconbtn"
                title="Copy"
                aria-label="Copy answer"
                onClick={() => {
                  const val = S.answers[f.k] || "";
                  if (!val) {
                    ui.toast("Nothing saved for that one yet");
                    return;
                  }
                  copyText(val);
                  ui.toast("Copied");
                }}
              >
                ⧉
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Backups() {
  const list = backups();
  const ui = useUi();
  if (!list.length)
    return (
      <span className="hint">No snapshots yet. One is kept every couple of minutes as you work.</span>
    );
  return (
    <div style={{ margin: "10px 0" }}>
      {list.map((x, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
          <span style={{ flex: 1, color: "var(--ink-2)" }}>
            {new Date(x.t).toLocaleString()} · {x.n} entries, {x.j} jobs
          </span>
          <button
            className="btn quiet sm"
            onClick={() => {
              if (
                !confirm(
                  "Restore the snapshot from " + new Date(x.t).toLocaleString() + "?\n\n" +
                    "This replaces what is on screen with " + x.n + " entries and " + x.j + " jobs.",
                )
              )
                return;
              if (restoreSnapshot(x)) location.reload();
              else ui.toast("Could not restore that one");
            }}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
