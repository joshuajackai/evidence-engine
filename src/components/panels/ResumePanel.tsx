import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WrittenDoc } from "@/types";
import { S, activeJob, isPro, useAppState, useStoreVersion } from "@/store/state";
import { save } from "@/store/storage";
import { useUi } from "@/ui/UiContext";
import { Paper, type PaperMode } from "@/components/Paper";
import { Msg, Spinner } from "@/components/Toast";
import { runATS, type AtsResult } from "@/lib/doc/ats";
import { jdRequired, parseDocJson, resumeToText, scoreDoc, writerDigest } from "@/lib/doc/score";
import { AI_WRITER } from "@/lib/ai/prompts";
import { AI_STATE, aiCall, aiReady } from "@/lib/ai/client";

export function ResumePanel({ onAts }: { onAts(r: AtsResult): void }) {
  const state = useAppState();
  const version = useStoreVersion();
  const ui = useUi();
  const paperRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PaperMode>("ai");
  const [view, setView] = useState<"fmt" | "text">("fmt");
  const [hdrOpen, setHdrOpen] = useState(false);
  const [hdr, setHdr] = useState({ ...state.hdr });
  const [textPane, setTextPane] = useState("");
  const [ats, setAts] = useState<AtsResult>({ score: 0, checks: [], failed: [] });
  const [writeStatus, setWriteStatus] = useState<{ kind: "" | "good" | "bad" | "warn"; node: React.ReactNode } | null>(null);
  const [writing, setWriting] = useState(false);
  const [tighten, setTighten] = useState<{ busy: boolean; out: string; err: boolean } | null>(null);

  const job = activeJob();
  const doc: WrittenDoc | null =
    job && mode !== "evidence" ? (mode === "ideal" ? job.idealDoc || null : job.aiDoc || null) : null;
  const hasModes = !!(job && (job.aiDoc || job.idealDoc));

  /* The ATS number the readiness list reads comes from the rendered page, so
     the resume has to be laid out before the check means anything. */
  useLayoutEffect(() => {
    const r = runATS(paperRef.current);
    setAts(r);
    onAts(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, mode, view, doc]);

  useEffect(() => {
    setHdr({ ...state.hdr });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hdr.name, state.hdr.email, state.hdr.phone, state.hdr.title, state.hdr.loc, state.hdr.link, state.hdr.summary]);

  function print() {
    if (!isPro()) {
      ui.open("paywall");
      return;
    }
    /* Last line of defence. Exporting a resume with no name or no way to
       contact you is the single most costly mistake this tool could let
       through. */
    const miss: string[] = [];
    if (!S.hdr.name) miss.push("your name");
    if (!S.hdr.email && !S.hdr.phone) miss.push("an email or phone number");
    if (!paperRef.current?.querySelectorAll("li").length) miss.push("any experience bullets");
    if (miss.length && !confirm("This resume is missing " + miss.join(" and ") + ".\n\nExport anyway?")) {
      setHdrOpen(true);
      return;
    }
    /* Browsers name the PDF after document.title, and "Evidence Engine · Build
       a resume..." is not what anybody wants sitting in a recruiter's inbox.
       Twenty applications otherwise produce twenty identically named files. */
    const was = document.title;
    const parts = [S.hdr.name || "Resume"];
    if (job && job.co) parts.push(job.co);
    if (job && job.title) parts.push(job.title);
    document.title = parts.join(" - ").replace(/[\\/:*?"<>|]/g, "").slice(0, 110);
    window.print();
    setTimeout(() => {
      document.title = was;
    }, 1500);
  }

  /* =========================================================================
     WRITE, SCORE, REWRITE
     One pass gets most of the way. What closes the gap is showing the model
     exactly which required terms are still unmatched and asking it to look
     again at whether the evidence already covers them in different words.
     Three passes is where the improvement flattens out.
     ========================================================================= */
  async function writeDoc(kind: "resume" | "cv") {
    const j = activeJob();
    if (!j) {
      ui.toast("Save a job in step 2 first");
      return;
    }
    if (!S.units.length) {
      ui.toast("Add your evidence in step 1 first");
      return;
    }
    if (!aiReady()) {
      ui.open("ai");
      return;
    }
    if (writing) return;
    setWriting(true);
    setMode("ai");

    const req = jdRequired(j);
    const longform = kind === "cv";
    const base =
      "TARGET ROLE: " + (j.title || "") + (j.co ? " at " + j.co : "") + "\n\n" +
      "THE POSTING:\n" + (j.text || "").slice(0, 4500) + "\n\n" +
      "TERMS THIS WILL BE SCORED AGAINST: " + req.join(", ") + "\n\n" +
      "MY VERIFIED ENTRIES (the only facts that exist):\n" + writerDigest(j) + "\n\n" +
      (longform
        ? "Write a CV. Longer than a resume: keep every role, allow four to six bullets on recent roles, and write a fuller summary of three to four sentences."
        : "Write a one to two page resume. Six to fourteen bullets in total, weighted toward the roles closest to this posting.");

    let best: WrittenDoc | null = null;
    let bestScore = -1;
    const history: { pass: number; pct: number; sig: string }[] = [];

    try {
      for (let pass = 1; pass <= 3; pass++) {
        setWriteStatus({
          kind: "",
          node: (
            <>
              <Spinner />
              Pass {pass} of 3, writing and scoring against {req.length} required terms...
            </>
          ),
        });

        let prompt = base;
        if (pass > 1 && best) {
          const sc = scoreDoc(best, j);
          prompt +=
            "\n\nYOUR PREVIOUS ATTEMPT SCORED " + sc.pct + "%.\n" +
            "Still unmatched: " + sc.missing.join(", ") + "\n\n" +
            "Go back through my entries. For each unmatched term, decide honestly which it is:\n" +
            "(a) I already did this and described it in different words. Rewrite that bullet using the posting's term. The fact must stay identical.\n" +
            "(b) I have not done it. Leave it out of the bullets and put it in `missing`.\n" +
            "Do not pad the skills line with terms the entries do not evidence. Return the full JSON again.";
        }

        /* Budgets are generous on purpose. A resume is a long structured object
           and 3000 was not enough for the JSON alone, never mind a model that
           thinks first. Truncation grows the budget automatically. */
        const txt = await aiCall(prompt, {
          system: AI_WRITER,
          noThink: true,
          maxTokens: longform ? 12000 : 8000,
        });
        const parsed = parseDocJson(txt);
        if (AI_STATE.truncated) parsed.partial = true;
        parsed.kind = kind;
        const s = scoreDoc(parsed, j);
        const sig = s.missing.slice().sort().join("|");
        history.push({ pass, pct: s.pct, sig });
        if (s.pct > bestScore) {
          bestScore = s.pct;
          best = parsed;
        }
        if (s.pct >= 100) break;
        /* Identical gap set two passes running means the remainder is genuinely
           absent from the history, not a wording problem. Another round would
           cost a call and return the same answer. */
        if (pass > 1 && sig === history[pass - 2].sig) break;
        if (pass > 1 && s.pct <= history[pass - 2].pct) break; // stopped improving
      }
    } catch (e) {
      setWriting(false);
      setWriteStatus({ kind: "bad", node: <>The writer failed: {(e as Error).message}</> });
      return;
    }

    setWriting(false);
    if (!best) return;
    j.aiDoc = best;
    const fin = scoreDoc(best, j);
    j.aiScore = fin.pct;
    save();

    const line = history.map((h) => h.pct + "%").join(" then ");
    const partialWarn = best.partial ? (
      <>
        <br />
        <span style={{ color: "#8A5A00" }}>
          The model hit its output limit and the last section may be short. What is here is complete
          and usable; press <b>Write my resume for this job</b> again, or pick a model with a larger
          output limit, to get the rest.
        </span>
      </>
    ) : null;

    if (fin.pct >= 100) {
      setWriteStatus({
        kind: "good",
        node: (
          <>
            <b>100% of the posting's terms are covered</b>, using only facts already in your entries.
            Passes: {line}. Read every bullet before you send it: you have to be able to walk through
            each one.
            {partialWarn}
          </>
        ),
      });
    } else {
      setWriteStatus({
        kind: "warn",
        node: (
          <>
            <b>Reached {fin.pct}%</b> ({line}). The remaining {fin.missing.length}
            {fin.missing.length === 1 ? " term is" : " terms are"} not in your history:{" "}
            <b>{fin.missing.slice(0, 10).join(", ")}</b>. Padding the resume with them would win the
            filter and lose the interview, so they were left out.{" "}
            <button type="button" className="linkbtn" onClick={buildIdeal}>
              Show me what a 100% resume would look like
            </button>
            {partialWarn}
          </>
        ),
      });
    }
  }

  /* =========================================================================
     THE 100% EXEMPLAR
     When the real document cannot reach 100, show what one that does would look
     like. It is generated as a SPECIMEN, every unearned claim wrapped in
     brackets, and it is never exportable. Its job is to make the gap concrete.
     ========================================================================= */
  async function buildIdeal() {
    const j = activeJob();
    if (!j) return;
    if (!aiReady()) {
      ui.open("ai");
      return;
    }
    setWriteStatus({ kind: "", node: <><Spinner />Building the 100% specimen...</> });
    const miss = scoreDoc(j.aiDoc || null, j).missing;
    const prompt =
      "TARGET ROLE: " + (j.title || "") + (j.co ? " at " + j.co : "") + "\n\n" +
      "THE POSTING:\n" + (j.text || "").slice(0, 4500) + "\n\n" +
      "MUST COVER EVERY ONE OF THESE TERMS: " + jdRequired(j).join(", ") + "\n\n" +
      "MY REAL ENTRIES, for shape and voice only:\n" + writerDigest(j) + "\n\n" +
      "TERMS I CANNOT CURRENTLY EVIDENCE: " + miss.join(", ") + "\n\n" +
      "This is a TEACHING SPECIMEN, not my resume, and it will be labelled as such and cannot be " +
      "exported. Write the resume of the person this posting is actually written for, covering 100% " +
      "of the terms.\n" +
      "Every claim I cannot currently evidence must be wrapped in square brackets, like " +
      "[led a migration of 40 services], so the difference between what is mine and what is not is " +
      "visible at a glance. Claims I CAN evidence should appear unbracketed and unchanged.\n" +
      "Use realistic but obviously placeholder numbers inside the brackets.\n" +
      "In `missing`, for each bracketed claim, put the smallest concrete thing I could genuinely do in " +
      "the next month to earn it, in `earn`. Be specific and modest: a side project, a certification, " +
      "one task volunteered for at work.\n" +
      "Same JSON shape as before.";
    try {
      const txt = await aiCall(prompt, {
        noThink: true,
        maxTokens: 8000,
        system: AI_WRITER.replace(
          "WHAT YOU MAY NEVER DO",
          "IN SPECIMEN MODE ONLY you may write bracketed illustrative claims, and only bracketed ones.\n\nWHAT YOU MAY NEVER DO",
        ),
      });
      const parsed = parseDocJson(txt);
      parsed.ideal = true;
      j.idealDoc = parsed;
      save();
      setMode("ideal");
      const s = scoreDoc(parsed, j);
      setWriteStatus({
        kind: "",
        node: (
          <>
            <b>Specimen built, {s.pct}% coverage.</b> Everything in [brackets] is not yours and must
            not be sent. It is there so you can see the exact distance between your history and this
            posting, and what would close it.
          </>
        ),
      });
    } catch (e) {
      setWriteStatus({ kind: "bad", node: <>Could not build the specimen: {(e as Error).message}</> });
    }
  }

  async function tightenText() {
    setTighten({ busy: true, out: "", err: false });
    try {
      const txt = await aiCall(
        "Tighten the resume below. Keep every fact exactly as written, change no numbers, add " +
          "nothing. Return the full resume in the same plain text format, nothing else.\n\n" + textPane,
      );
      setTighten({ busy: false, out: txt, err: false });
    } catch (e) {
      setTighten({ busy: false, out: "Failed: " + (e as Error).message, err: true });
    }
  }

  const missingLedger = doc?.missing || (job?.aiDoc?.missing ?? []);

  return (
    <section className="panel">
      <div className="head noprint">
        <h1>Your resume</h1>
        <p>
          Every bullet below was assembled from words you typed. No model wrote a claim on your
          behalf, which is why there is nothing here you cannot walk through in an interview.
        </p>
      </div>

      <div className="card noprint" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 15 }}>Write it for this job</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Your facts, the posting's words</span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", margin: "6px 0 12px" }}>
          A keyword filter marks a qualified person as a poor fit for saying the same thing
          differently. This rewrites your entries into the posting's vocabulary, scores the result,
          and goes again on whatever is still unmatched. It cannot change a fact, a date or a number.
        </p>
        <div className="btnrow">
          <button className="btn" disabled={writing} onClick={() => writeDoc("resume")}>
            Write my resume for this job
          </button>
          <button className="btn ghost" disabled={writing} onClick={() => writeDoc("cv")}>
            Write the longer CV
          </button>
          {job?.aiDoc && (job.aiScore ?? 0) < 100 && (
            <button className="btn quiet sm" onClick={buildIdeal}>Show a 100% specimen</button>
          )}
        </div>
        {hasModes && (
          <div className="seg noprint" role="group" aria-label="Which version" style={{ marginTop: 12 }}>
            <button aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>Tailored</button>
            <button aria-pressed={mode === "evidence"} onClick={() => setMode("evidence")}>From my entries</button>
            {job?.idealDoc && (
              <button aria-pressed={mode === "ideal"} onClick={() => setMode("ideal")}>Specimen</button>
            )}
          </div>
        )}
        {writeStatus && <Msg kind={writeStatus.kind}>{writeStatus.node}</Msg>}

        {missingLedger && missingLedger.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 15, marginBottom: 2 }}>
              {mode === "ideal" ? "What would close the gap" : "Left out on purpose"}
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
              {mode === "ideal"
                ? "Each of these is a bracketed claim in the specimen. The third column is the smallest real thing that would let you write it unbracketed."
                : "The posting asks for these and your entries do not evidence them. They were kept off the resume deliberately."}
            </p>
            <ul className="atslist">
              {missingLedger.map((m, i) => (
                <li className="no" key={i}>
                  <span className="m">·</span>
                  <span>
                    <b>{m.term || ""}</b>
                    {m.why ? ". " + m.why : ""}
                    {m.earn && (
                      <>
                        <br />
                        <span style={{ color: "var(--audited)" }}>Earn it: {m.earn}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="btnrow noprint" style={{ marginBottom: 18 }}>
        <button
          className="btn"
          onClick={print}
          disabled={mode === "ideal"}
          title={mode === "ideal" ? "Exporting is disabled for the specimen" : ""}
        >
          Save as PDF
        </button>
        <button className="btn quiet" onClick={() => setHdrOpen(!hdrOpen)}>Edit heading</button>
        <div className="seg" role="group" aria-label="View mode">
          <button aria-pressed={view === "fmt"} onClick={() => setView("fmt")}>Formatted</button>
          <button
            aria-pressed={view === "text"}
            onClick={() => {
              if (!textPane) setTextPane(S.customText || resumeToText());
              setView("text");
            }}
          >
            Edit as text
          </button>
        </div>
        {S.customText && (
          <button
            className="btn quiet sm"
            onClick={() => {
              if (!confirm("Discard your text edits and rebuild the resume from your entries?")) return;
              S.customText = "";
              setTextPane("");
              save();
              setView("fmt");
              ui.toast("Rebuilt from your entries");
            }}
          >
            Discard my edits
          </button>
        )}
      </div>

      {view === "text" && (
        <div className="card noprint" style={{ marginBottom: 18, maxWidth: 760 }}>
          <div className="sub" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 9 }}>
            Edit freely. Blank lines separate blocks, a line starting with <b>#</b> becomes a section
            heading and a line starting with <b>-</b> becomes a bullet. What you type here is what
            prints.
          </div>
          <textarea id="textPane" value={textPane} onChange={(e) => setTextPane(e.target.value)} />
          <div className="btnrow" style={{ marginTop: 11 }}>
            <button
              className="btn sm"
              onClick={() => {
                S.customText = textPane;
                save();
                setView("fmt");
                ui.toast("Your edits are now the resume");
              }}
            >
              Apply to resume
            </button>
            {aiReady() && (
              <button className="btn quiet sm" onClick={tightenText}>Ask AI to tighten this</button>
            )}
          </div>
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
                      <button
                        className="btn sm"
                        style={{ marginTop: 10 }}
                        onClick={() => {
                          setTextPane(tighten.out);
                          ui.toast("Pasted in. Review it, then Apply.");
                        }}
                      >
                        Use this version
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {hdrOpen && (
        <div className="card noprint" style={{ marginBottom: 18, maxWidth: 760 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="hName">Full name</label>
              <input id="hName" type="text" autoComplete="name" value={hdr.name} onChange={(e) => setHdr({ ...hdr, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hTitle">Professional title</label>
              <input id="hTitle" type="text" autoComplete="organization-title" value={hdr.title} onChange={(e) => setHdr({ ...hdr, title: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="hLoc">Location</label>
              <input id="hLoc" type="text" autoComplete="address-level2" value={hdr.loc} onChange={(e) => setHdr({ ...hdr, loc: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hEmail">Email</label>
              <input id="hEmail" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={hdr.email} onChange={(e) => setHdr({ ...hdr, email: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="hPhone">Phone</label>
              <input id="hPhone" type="tel" inputMode="tel" autoComplete="tel" value={hdr.phone} onChange={(e) => setHdr({ ...hdr, phone: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hLink">Portfolio or LinkedIn</label>
              <input id="hLink" type="url" inputMode="url" autoComplete="url" spellCheck={false} value={hdr.link} onChange={(e) => setHdr({ ...hdr, link: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="hSummary">Summary</label>
            <textarea id="hSummary" value={hdr.summary} onChange={(e) => setHdr({ ...hdr, summary: e.target.value })} />
          </div>
          <button
            className="btn sm"
            onClick={() => {
              S.hdr = {
                name: hdr.name.trim(), title: hdr.title.trim(), loc: hdr.loc.trim(),
                email: hdr.email.trim(), phone: hdr.phone.trim(), link: hdr.link.trim(),
                summary: hdr.summary.trim(),
              };
              save();
              setHdrOpen(false);
              ui.toast("Heading updated");
            }}
          >
            Done
          </button>
        </div>
      )}

      <div className="grid2">
        <div>
          <Paper ref={paperRef} mode={mode} doc={doc} customText={state.customText} />
        </div>
        <aside className="noprint">
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 3 }}>ATS check</h3>
            <div className="sub" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
              Run against what is actually on the page, not against a template.
            </div>
            <div
              className="score-n"
              style={{ color: ats.score === 100 ? "var(--audited)" : ats.score >= 80 ? "var(--estimated)" : "var(--none)" }}
            >
              {ats.score}
            </div>
            <div className="score-l">Machine readability</div>
            <ul className="atslist">
              {ats.checks.map((c, i) => (
                <li className={c.ok ? "ok" : "no"} key={i}>
                  <span className="m">{c.ok ? "✓" : "✕"}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <ImproveBox failed={ats.failed} />
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 11 }}>Typeface</h3>
            <div className="field">
              <label htmlFor="fFont">Font</label>
              <select
                id="fFont"
                value={state.type.font}
                onChange={(e) => { S.type = { ...S.type, font: e.target.value }; save(); }}
              >
                <option value="sans">Inter and system sans</option>
                <option value="arial">Arial and Helvetica</option>
                <option value="calibri">Calibri and Carlito</option>
                <option value="georgia">Georgia serif</option>
                <option value="times">Times New Roman serif</option>
                <option value="garamond">Garamond serif</option>
              </select>
              <div className="hint">
                Every option is a real text font that parsers read. Decorative and icon fonts are not
                offered, because they are the most common reason a resume scores badly before a human
                ever sees it.
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="fSize">Body size</label>
                <select
                  id="fSize"
                  value={state.type.size}
                  onChange={(e) => { S.type = { ...S.type, size: e.target.value }; save(); }}
                >
                  <option value="10">10 pt</option>
                  <option value="10.5">10.5 pt</option>
                  <option value="11">11 pt</option>
                  <option value="11.5">11.5 pt</option>
                  <option value="12">12 pt</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fLead">Line spacing</label>
                <select
                  id="fLead"
                  value={state.type.lead}
                  onChange={(e) => { S.type = { ...S.type, lead: e.target.value }; save(); }}
                >
                  <option value="1.35">Tight</option>
                  <option value="1.5">Normal</option>
                  <option value="1.65">Relaxed</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fAccent">Colour</label>
              <select
                id="fAccent"
                value={state.type.accent}
                onChange={(e) => { S.type = { ...S.type, accent: e.target.value }; save(); }}
              >
                <option value="on">Accent headings</option>
                <option value="off">Monochrome, safest</option>
              </select>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ImproveBox({ failed }: { failed: string[] }) {
  const ui = useUi();
  const state = useAppState();
  /* Recomputed here rather than passed down, because it reads the entries as
     well as the failed structural checks. */
  const count = failed.length + countLineIssues(state.units.length);
  if (!count)
    return <div style={{ fontSize: 12.8, color: "var(--audited)" }}>Nothing to flag. The document is clean.</div>;
  return (
    <>
      <div style={{ fontSize: 12.8, color: "var(--ink-2)", marginBottom: 9 }}>
        {count} thing{count > 1 ? "s" : ""} worth looking at.
      </div>
      <button className="btn sm" onClick={() => ui.open("ats")}>Review improvements</button>
    </>
  );
}

function countLineIssues(_n: number): number {
  /* Cheap proxy so the button appears whenever there is anything to review. The
     modal recomputes the real list from readabilitySuggestions(). */
  let c = 0;
  S.units
    .filter((u) => S.picked[u.id] !== false)
    .forEach((u) => {
      const b = (u.action || "").trim();
      if (/^(managed|helped|assisted|worked on|responsible for|supported|participated)/i.test(b)) c++;
      if (b.split(/\s+/).length > 34) c++;
      if (u.metricType === "none") c++;
    });
  if (!S.hdr.summary) c++;
  return c;
}
