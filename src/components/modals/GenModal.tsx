/* =========================================================================
   THE TAILOR MODAL
   Every claim in the output traces to the user's existing evidence. If the
   posting asks for something they have not written, this surfaces the gap.
   Nothing is upgraded and nothing is invented, and the deterministic checks
   underneath the model say so out loud.
   ========================================================================= */
import { useEffect, useMemo, useState } from "react";
import type { GenResult, Job } from "@/types";
import { Veil } from "@/components/Veil";
import { Msg, Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import { S, useAppState } from "@/store/state";
import { save } from "@/store/storage";
import { bullet, copyText } from "@/lib/util";
import { coverageFor, scoreUnit } from "@/lib/jd/match";
import { mdToHtml, highlightKw } from "@/lib/doc/markdown";
import { docMatchWeighted } from "@/lib/doc/score";
import {
  fabricationCheck, genBuildCopyPrompt, genBuildUserPrompt, genDownload, genParseJson,
  normalizeGen, type DownloadKind,
} from "@/lib/doc/gen";
import { GEN_SYSTEM } from "@/lib/ai/prompts";
import { AI, aiCall, aiModel, aiReady } from "@/lib/ai/client";
import { AI_DEFAULTS } from "@/lib/ai/providers";

type Tab = "resume" | "cv" | "side" | "analysis";

export function GenModal() {
  const ui = useUi();
  const state = useAppState();
  const job = ui.genJob;
  const open = ui.isOpen("gen") && !!job;

  const [tab, setTab] = useState<Tab>("resume");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState<{ kind: "" | "good" | "bad" | "warn"; node: React.ReactNode } | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteBox, setPasteBox] = useState("");

  const g: GenResult | null = job ? state.gen[job.id] || null : null;

  useEffect(() => {
    if (!open || !job) return;
    setTab("resume");
    setPromptOpen(false);
    setPasteOpen(false);
    setPasteBox("");
    const prior = S.gen && S.gen[job.id];
    if (prior)
      setStatus(
        "Loaded a saved draft from " +
          (prior.when ? new Date(prior.when).toLocaleString() : "earlier") +
          (prior.model ? " (via " + prior.model + ")" : "") + ". Regenerate to refresh.",
      );
    else setStatus("");
    /* Warn honestly if the source is empty. Clicking this before uploading
       anything used to produce a confusing error. */
    if (!S.units.length && !(S.rawResume && S.rawResume.trim()))
      setMsg({
        kind: "bad",
        node: (
          <>
            <b>No source to draw from.</b> Upload or paste your resume on Step 1 first. Without a
            source, the tool has nothing honest to say.
          </>
        ),
      });
    else setMsg(null);
  }, [open, job]);

  const covered = useMemo(() => {
    const c: Record<string, 1> = {};
    if (!job) return c;
    S.units.forEach((u) => {
      if (job.picked && job.picked[u.id] === false) return;
      scoreUnit(u, job.kw || []).hits.forEach((h) => (c[h] = 1));
    });
    return c;
  }, [job, state]);

  if (!open || !job) return <Veil on={false} label="">{null}</Veil>;

  const beforePct = coverageFor(job);
  const sourceBits: string[] = [];
  if (S.units.length) sourceBits.push(S.units.length + " graded evidence entries");
  if (S.rawResume && S.rawResume.trim())
    sourceBits.push(Math.round(S.rawResume.length / 1000) + "K characters of uploaded resume text");
  if (S.hdr.name) sourceBits.push("your contact block");

  async function run() {
    if (!job) return;
    if (!S.units.length && !(S.rawResume && S.rawResume.trim())) {
      setMsg({ kind: "bad", node: "Upload or paste your resume on Step 1 first. There is nothing to tailor from." });
      return;
    }
    if (!aiReady()) {
      /* Reveal the copy-prompt fallback rather than failing outright. */
      setPromptOpen(true);
      setMsg({
        kind: "warn",
        node: "No API key connected. Paste the prompt below into any chat AI, then paste the JSON response back.",
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    setStatus(
      "Calling " + (AI_DEFAULTS[AI.provider]?.label || AI.provider) + " via " + aiModel() + "...",
    );
    const user = genBuildUserPrompt(job);
    try {
      let txt: string;
      try {
        txt = await aiCall(user, { system: GEN_SYSTEM, maxTokens: 3800 });
      } catch (primaryErr) {
        /* Auto-fallback on model or size errors. This handles the common case
           where the account does not have access to the flagship, or the model
           name typed in was stale. */
        let fallback: string | null = null;
        if (AI.provider === "anthropic") fallback = "claude-haiku-4-5";
        else if (AI.provider === "openrouter") fallback = "anthropic/claude-haiku-4.5";
        else if (AI.provider === "openai") fallback = "gpt-4o-mini";
        const m = (primaryErr as Error).message || "";
        const shouldFall = !!fallback && /model|not found|does not exist|invalid|context|token|max_tokens|401|403|404|429/i.test(m);
        if (shouldFall && fallback !== aiModel()) {
          setStatus("Primary model failed. Retrying with " + fallback + "...");
          txt = await aiCall(user, { system: GEN_SYSTEM, maxTokens: 3800, modelOverride: fallback as string });
        } else throw primaryErr;
      }
      const j = genParseJson(txt);
      if (!j.resume_md || !j.cv_md)
        throw new Error("The response was missing resume_md or cv_md. Raw output start: " + (txt || "").slice(0, 200));
      const res = normalizeGen(j, job, aiModel());
      S.gen = S.gen || {};
      S.gen[job.id] = res;
      save();
      setStatus(
        "Done. Match " + res.matchAfter + "%, ATS " + res.atsScore + "/100, voice lint " + res.lintScore + "/100.",
      );
    } catch (err) {
      setMsg({
        kind: "bad",
        node: (
          <>
            <b>Generation failed.</b> {(err as Error).message}
            <br />
            <br />
            Open <b>Connect AI</b> and expand the <b>Debug: last AI calls</b> drawer to see the exact
            request and response. If the provider blocked the call, switch provider or model in
            Connect AI, or use the copy-prompt fallback below.
          </>
        ),
      });
      setPromptOpen(true);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function download(kind: DownloadKind) {
    if (!g || !job) {
      ui.toast("Nothing to download yet");
      return;
    }
    const err = genDownload(kind, job, g);
    if (err) ui.toast(err);
  }

  return (
    <Veil on={open} wide className="gen-modal" label="Tailored resume and CV">
      <div className="gen-header">
        <div>
          <h3>Tailored resume and CV</h3>
          <div className="gen-jobtag">
            {(job.title || "Untitled") + (job.co ? " at " + job.co : "")} ·{" "}
            {(job.kw || []).length} keywords in the posting
          </div>
        </div>
        <div className="btnrow" style={{ flex: "none" }}>
          <button className="btn quiet sm" onClick={() => ui.close("gen")}>Close</button>
        </div>
      </div>

      <p style={{ fontSize: 12.7, color: "var(--muted)", marginTop: 4 }}>
        Every claim in the output traces to your existing evidence. If the posting asks for something
        you have not written, this surfaces the gap. Nothing is upgraded and nothing is invented.
      </p>

      <div className="gen-source">
        <b>Source:</b>{" "}
        {sourceBits.length ? (
          sourceBits.join(", ")
        ) : (
          <span style={{ color: "var(--none)" }}>
            No source uploaded. Add your evidence first, on Step 1.
          </span>
        )}
        . Every claim in the output has to trace to something in this source.
      </div>

      <div className="gen-scores">
        <div className="gen-score">
          <div className="lbl">Match, before</div>
          <div className="num">{beforePct}%</div>
          <div className="delta">Your current evidence against this posting.</div>
        </div>
        <div className="gen-score">
          <div className="lbl">Match, after</div>
          <div className={"num " + (g ? (g.matchAfter >= beforePct ? "up" : "down") : "up")}>
            {g ? g.matchAfter + "%" : "—"}
          </div>
          <div className="delta">
            {g
              ? (g.matchAfter - beforePct >= 0 ? "+" : "") + (g.matchAfter - beforePct) + " points against the JD."
              : "Run the tailor to see the lift."}
          </div>
        </div>
        <div className="gen-score">
          <div className="lbl">ATS readability</div>
          <div className={"num " + (g ? (g.atsScore >= 80 ? "up" : g.atsScore >= 60 ? "" : "down") : "")}>
            {g ? g.atsScore + "/100" : "—"}
          </div>
          <div className="delta">
            {g
              ? g.atsIssues.length
                ? g.atsIssues.length + " issue" + (g.atsIssues.length === 1 ? "" : "s") + " to review"
                : "Clean against the parser rules."
              : "Layout checks against real parser rules."}
          </div>
        </div>
        <div className="gen-score">
          <div className="lbl">Voice lint</div>
          <div className={"num " + (g ? (g.lintScore >= 90 ? "up" : g.lintScore >= 70 ? "" : "down") : "")}>
            {g ? g.lintScore + "/100" : "—"}
          </div>
          <div className="delta">
            {g
              ? g.lintIssues.length
                ? g.lintIssues.length + " voice-rule hit" + (g.lintIssues.length === 1 ? "" : "s")
                : "Voice rules held."
              : "Em dashes, contractions, banned phrases."}
          </div>
        </div>
      </div>

      <div className="gen-kwbox">
        <div className="lh">
          <h4>Keywords the posting names</h4>
          <span className="n">
            {(job.kw || []).length
              ? (job.kw || []).length + " total, " + Object.keys(covered).length + " already covered"
              : ""}
          </span>
        </div>
        <div>
          {(job.kw || []).length ? (
            (job.kw || []).map((o) => (
              <span className={covered[o.k] ? "kw-hit" : "kw-miss"} key={o.k}>{o.k}</span>
            ))
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
              No keywords extracted, paste the full posting on Step 2 for a sharper tailor.
            </span>
          )}
        </div>
      </div>

      <div className="gen-actions">
        <button className="btn" disabled={busy} onClick={run}>
          {g ? "Regenerate with AI" : "Generate resume and CV with AI"}
        </button>
        <button className="btn quiet" onClick={() => setPromptOpen(true)}>
          Copy the prompt for any chat AI
        </button>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{status}</span>
      </div>

      {msg && <Msg kind={msg.kind}>{msg.node}</Msg>}

      {busy && (
        <div style={{ padding: "14px 0" }}>
          <Spinner />
          Reading your evidence and drafting the tailored versions...
        </div>
      )}

      {g && !busy && (
        <div>
          <div className="gen-tabs" role="tablist">
            {(
              [
                ["resume", "Resume, one page"],
                ["cv", "CV, two pages"],
                ["side", "Side by side"],
                ["analysis", "Match analysis"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                className="gen-tab"
                role="tab"
                key={k}
                aria-selected={tab === k}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "resume" && (
            <div className="gen-view on">
              <div
                className="gen-doc"
                dangerouslySetInnerHTML={{
                  __html: '<div class="genhead">Tailored resume</div>' + mdToHtml(g.resume),
                }}
              />
              <div className="gen-actions">
                <button className="btn sm" onClick={() => download("resume-md")}>Download Markdown</button>
                <button className="btn sm" onClick={() => download("resume-doc")}>Download Word (.doc)</button>
                <button className="btn sm" onClick={() => download("resume-pdf")}>Save as PDF</button>
                <button className="btn quiet sm" onClick={() => { copyText(g.resume); ui.toast("Resume copied."); }}>
                  Copy text
                </button>
              </div>
            </div>
          )}

          {tab === "cv" && (
            <div className="gen-view on">
              <div
                className="gen-doc"
                dangerouslySetInnerHTML={{ __html: '<div class="genhead">Tailored CV</div>' + mdToHtml(g.cv) }}
              />
              <div className="gen-actions">
                <button className="btn sm" onClick={() => download("cv-md")}>Download Markdown</button>
                <button className="btn sm" onClick={() => download("cv-doc")}>Download Word (.doc)</button>
                <button className="btn sm" onClick={() => download("cv-pdf")}>Save as PDF</button>
                <button className="btn quiet sm" onClick={() => { copyText(g.cv); ui.toast("CV copied."); }}>
                  Copy text
                </button>
              </div>
            </div>
          )}

          {tab === "side" && (
            <div className="gen-view on">
              <div className="gen-cols">
                <div>
                  <div
                    className="lbl"
                    style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}
                  >
                    Your original
                  </div>
                  <div className="gen-doc" dangerouslySetInnerHTML={{ __html: originalHtml() }} />
                </div>
                <div>
                  <div
                    className="lbl"
                    style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}
                  >
                    Tailored, keywords highlighted
                  </div>
                  <div
                    className="gen-doc"
                    dangerouslySetInnerHTML={{ __html: highlightKw(mdToHtml(g.resume), g.kwHit || []) }}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "analysis" && <Analysis g={g} job={job} />}
        </div>
      )}

      {promptOpen && (
        <div className="gen-copyprompt">
          <h4 style={{ fontSize: 13, margin: "0 0 6px" }}>Prompt for any chat AI</h4>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
            Paste this into Claude, ChatGPT, Gemini, Perplexity or any model you already use. The
            output is JSON, then you paste that back below.
          </p>
          <textarea readOnly value={genBuildCopyPrompt(job)} />
          <div className="btnrow" style={{ marginTop: 9 }}>
            <button
              className="btn sm"
              onClick={() => {
                copyText(genBuildCopyPrompt(job));
                ui.toast("Prompt copied. Paste into Claude, ChatGPT, Gemini or Perplexity.");
              }}
            >
              Copy prompt
            </button>
            <button className="btn quiet sm" onClick={() => setPasteOpen(true)}>Paste the JSON response</button>
            <button className="btn quiet sm" onClick={() => setPromptOpen(false)}>Hide</button>
          </div>
          {pasteOpen && (
            <div style={{ marginTop: 10 }}>
              <textarea
                autoFocus
                placeholder="Paste the JSON response here"
                style={{ width: "100%", minHeight: 140, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }}
                value={pasteBox}
                onChange={(e) => setPasteBox(e.target.value)}
              />
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button
                  className="btn sm"
                  onClick={() => {
                    const raw = pasteBox.trim();
                    if (!raw) {
                      ui.toast("Paste the JSON first");
                      return;
                    }
                    try {
                      const j = genParseJson(raw);
                      if (!j.resume_md || !j.cv_md) throw new Error("Missing resume_md or cv_md");
                      const res = normalizeGen(j, job, "pasted by hand");
                      S.gen = S.gen || {};
                      S.gen[job.id] = res;
                      save();
                      setPasteOpen(false);
                      setPromptOpen(false);
                      ui.toast("Loaded. Match " + res.matchAfter + "%.");
                    } catch (e) {
                      ui.toast("Could not read that as JSON: " + (e as Error).message);
                    }
                  }}
                >
                  Load this into the tool
                </button>
                <button className="btn quiet sm" onClick={() => setPasteOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Veil>
  );
}

function originalHtml(): string {
  if (S.rawResume && S.rawResume.trim()) return mdToHtml(S.rawResume.slice(0, 12000));
  if (S.units.length)
    return (
      "<p><em>No raw resume text uploaded. Original view shows your graded evidence entries instead.</em></p><ul>" +
      S.units.map((u) => "<li>" + bullet(u).replace(/[<>&]/g, "") + "</li>").join("") +
      "</ul>"
    );
  return "<p><em>No source available.</em></p>";
}

/**
 * ATS Score Gate. Resume and CV are scored SEPARATELY with the weighted model,
 * because a CV that skipped a title term hides behind a passing resume in any
 * combined number. The gate reads PASS only at 100 on both documents plus a
 * clean parser audit.
 */
function Analysis({ g, job }: { g: GenResult; job: Job }) {
  const rm = docMatchWeighted(g.resume || "", job);
  const cm = docMatchWeighted(g.cv || "", job);
  const pass = rm.pct === 100 && cm.pct === 100 && g.atsScore === 100;
  const flags = fabricationCheck(g.resume + "\n" + g.cv);

  /* The chips carry no margin of their own, so without a real space between
     them the whole run is one unbreakable word and it overflows the modal
     rather than wrapping. */
  const chips = (a: string[]) =>
    a.length ? (
      a.map((k) => (
        <span key={k}>
          <span className="tag">{k}</span>{" "}
        </span>
      ))
    ) : (
      <span style={{ color: "var(--audited)", fontSize: 12.5 }}>none</span>
    );

  return (
    <div className="gen-view on">
      <div className="gen-score" style={{ textAlign: "left" }}>
        <div className="lbl">Positioning notes</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-2)" }}>
          {g.positioning || "No notes returned."}
        </div>
      </div>

      <div className="gen-kwbox" style={{ marginTop: 16 }}>
        <div className="lh">
          <h4>Keywords addressed in the tailored copy</h4>
          <span className="n">
            {(g.kwHit || []).length} of {(job.kw || []).length}
          </span>
        </div>
        <div>
          {(g.kwHit || []).length ? (
            (g.kwHit || []).map((k) => (
              <span className="kw-hit" key={k}>{k}</span>
            ))
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>None yet.</span>
          )}
        </div>
      </div>

      <div className="gen-kwbox">
        <div className="lh">
          <h4>Honestly declined</h4>
          <span className="n">{(g.declined || []).length} honestly declined</span>
        </div>
        <p style={{ fontSize: 12.7, color: "var(--muted)", margin: "0 0 8px" }}>
          The posting asked for these but your evidence did not show them. They were left off rather
          than invented.
        </p>
        <div className="gen-declined">
          {(g.declined || []).length ? (
            (g.declined || []).map((d, i) => (
              <div className="row" key={i}>
                <b>{d.term || "(unspecified)"}</b>
                <span>{d.reason || ""}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--audited)", fontSize: 13 }}>
              Everything the posting asks for was addressable from your source.
            </div>
          )}
        </div>
      </div>

      <div className="gen-fabtest">
        <b>Fabrication check.</b>{" "}
        {flags.length ? (
          <>
            <span style={{ color: "var(--none)" }}>
              {flags.length} possible upgrade{flags.length === 1 ? "" : "s"} vs the source:{" "}
              {flags.join("; ")}
            </span>
            . Review these before sending.
          </>
        ) : (
          <b>No obvious upgrades vs the source. Every years-of-experience number in the output appears in the source.</b>
        )}
      </div>

      <div className="gen-kwbox" style={{ marginTop: 12 }}>
        <div className="lh">
          <h4>ATS Score Gate</h4>
          <span className="n" style={{ color: pass ? "var(--audited)" : "var(--none)" }}>
            {pass ? "GATE PASS 100/100" : "GATE OPEN"}
          </span>
        </div>
        <div className="row">
          <b>Resume match</b>
          <span>{rm.pct}/100</span>
        </div>
        <div className="row">
          <b>CV match</b>
          <span>{cm.pct}/100</span>
        </div>
        <div className="row">
          <b>Parser audit</b>
          <span>{g.atsScore}/100</span>
        </div>
        {rm.missing.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 12.7 }}>
            <b>Missing from the resume:</b> {chips(rm.missing)}
          </div>
        )}
        {cm.missing.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 12.7 }}>
            <b>Missing from the CV:</b> {chips(cm.missing)}
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
          Weighted the way keyword screens read: a term in the job title counts three times, a
          repeated term twice. 100 on both documents plus a clean parser audit is the ship bar. Terms
          you cannot evidence belong in Honestly declined, never invented into a bullet.
        </p>
      </div>

      {g.atsIssues.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontSize: 13, margin: "12px 0 6px" }}>ATS readability issues</h4>
          <ul style={{ fontSize: 12.7, color: "var(--ink-2)", paddingLeft: 18 }}>
            {g.atsIssues.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {g.lintIssues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4 style={{ fontSize: 13, margin: "12px 0 6px" }}>Voice-rule hits</h4>
          <ul style={{ fontSize: 12.7, color: "var(--ink-2)", paddingLeft: 18 }}>
            {g.lintIssues.map((i, n) => (
              <li key={n}>
                [{i.sev}] {i.msg}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
