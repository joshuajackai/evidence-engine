import { useEffect } from "react";
import { S, activeJob, useAppState } from "@/store/state";
import { save } from "@/store/storage";
import { bullet } from "@/lib/util";
import { coreKw } from "@/lib/jd/keywords";
import { rankUnits } from "@/lib/jd/match";
import { NOT_A_SKILL } from "@/lib/jd/vocab";
import { useUi } from "@/ui/UiContext";
import { aiReady } from "@/lib/ai/client";

export function MatchPanel() {
  const state = useAppState();
  const ui = useUi();
  const kw = state.jd.kw || [];
  const rows = kw.length ? rankUnits(kw) : [];

  /* Was: picked = s>0. The metric-type bonus alone gives a Proven entry 14
     points with zero keyword overlap, so entries with nothing to do with the
     posting were being switched on by default. Require a real hit. */
  useEffect(() => {
    if (!rows.length) return;
    let changed = false;
    rows.forEach((r) => {
      if (S.picked[r.u.id] === undefined) {
        S.picked[r.u.id] = r.hits.length > 0;
        changed = true;
      }
    });
    if (changed) save();
  });

  if (!state.units.length)
    return (
      <section className="panel">
        <Head />
        <div className="grid2">
          <div>
            <div className="empty">
              <h3>No entries to rank</h3>
              <p>Add evidence first.</p>
            </div>
          </div>
          <aside>
            <Coverage pct={0} gaps={[]} nothingRead />
          </aside>
        </div>
      </section>
    );

  if (!kw.length)
    return (
      <section className="panel">
        <Head />
        <div className="grid2">
          <div>
            <div className="callout">Read a job description first and the ranking appears here.</div>
          </div>
          <aside>
            <Coverage pct={0} gaps={[]} nothingRead />
          </aside>
        </div>
      </section>
    );

  const anyHit = rows.some((r) => r.hits.length > 0);
  const covered: Record<string, 1> = {};
  rows.filter((r) => S.picked[r.u.id]).forEach((r) => r.hits.forEach((h) => (covered[h] = 1)));
  const core = coreKw(kw);
  const pct = core.length ? Math.round((core.filter((o) => covered[o.k]).length / core.length) * 100) : 0;
  const gaps = core.filter((o) => !covered[o.k] && o.k.length > 2 && !NOT_A_SKILL.test(o.k)).slice(0, 10);

  return (
    <section className="panel">
      <Head />
      <div className="grid2">
        <div>
          <div className="callout">
            {anyHit ? (
              <>
                Ranked against <b>{state.jd.title || "the posting"}</b>
                {state.jd.co ? " at " + state.jd.co : ""}. Turn anything off that you do not want on
                the page.
              </>
            ) : (
              <>
                <b>Nothing here overlaps this posting.</b> Not one of your entries mentions anything{" "}
                {state.jd.title || "this role"} asks for, so none were selected. That is a real
                signal about the fit. You can still switch entries on by hand below.
              </>
            )}
          </div>
          <div>
            {rows.map((r) => {
              const on = !!S.picked[r.u.id];
              return (
                <div className={"matchrow" + (on ? "" : " off")} key={r.u.id}>
                  <div className={"mscore" + (r.pct >= 20 ? " hi" : "")}>{r.pct}</div>
                  <div className="mtext">
                    <b>{r.u.org}</b>
                    <span>{bullet(r.u) || r.u.action}</span>
                    <div className="tags" style={{ marginTop: 5 }}>
                      {r.hits.length ? (
                        r.hits.slice(0, 6).map((h) => (
                          <span className="tag hit" key={h}>{h}</span>
                        ))
                      ) : (
                        <span className="tag">no overlap with this posting</span>
                      )}
                    </div>
                  </div>
                  <label className="sw">
                    <input
                      type="checkbox"
                      /* Ten switches all named "Include this entry" are
                         indistinguishable to a screen reader. Name each after
                         the entry it controls. */
                      aria-label={"Include on this resume: " + r.u.org + (r.u.role ? ", " + r.u.role : "")}
                      checked={on}
                      onChange={(e) => {
                        S.picked[r.u.id] = e.target.checked;
                        const j = activeJob();
                        if (j) j.picked = S.picked;
                        save();
                      }}
                    />
                    <i />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
        <aside>
          <Coverage
            pct={pct}
            gaps={gaps.map((o) => o.k)}
            onWizard={() => ui.openGapWizard(gaps.map((o) => o.k))}
            onSemantic={() => ui.openSemantic(gaps.map((o) => o.k))}
            aiOn={aiReady()}
          />
        </aside>
      </div>
    </section>
  );
}

function Head() {
  return (
    <div className="head">
      <h1>What earns a place on the page</h1>
      <p>
        Entries are ranked by how much of this posting they answer. Everything below the line stays
        in your inventory and off this resume.
      </p>
    </div>
  );
}

function Coverage({
  pct, gaps, onWizard, onSemantic, aiOn, nothingRead,
}: {
  pct: number;
  gaps: string[];
  onWizard?(): void;
  onSemantic?(): void;
  aiOn?: boolean;
  /** No entries or no posting yet. Saying "everything is covered" here would
      be a claim about a comparison that has not happened. */
  nothingRead?: boolean;
}) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 14, marginBottom: 9 }}>Coverage</h3>
      <div className="score-n">{pct}%</div>
      <div className="score-l">Of what the posting asks for</div>
      <div className="legend" style={{ marginTop: 14 }}>
        {nothingRead ? null : gaps.length ? (
          <>
            <div style={{ display: "block", marginBottom: 7, color: "var(--muted)", fontSize: 12.5 }}>
              Named in the posting, absent from your evidence:
            </div>
            <div className="tags">
              {gaps.map((g) => (
                <span className="tag" key={g} style={{ borderColor: "var(--none)", color: "var(--none)" }}>
                  {g}
                </span>
              ))}
            </div>
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={onSemantic} disabled={!onSemantic}>
                Re-check with AI
              </button>
              <button className="btn quiet sm" onClick={onWizard} disabled={!onWizard}>
                Answer them myself
              </button>
            </div>
            <div style={{ display: "block", marginTop: 7, color: "var(--muted)", fontSize: 12.2 }}>
              Keyword matching is literal. It will call something missing when you described it in
              different words. The AI re-check reads what you actually wrote.
              {aiOn === false && " It needs a connected model."}
            </div>
            <div style={{ display: "block", marginTop: 9, color: "var(--muted)", fontSize: 12.2 }}>
              Some of these you may genuinely have and simply never wrote down. The rest are real,
              and knowing which is which before an interview is the point.
            </div>
          </>
        ) : (
          <div style={{ color: "var(--audited)" }}>Everything named in the posting is covered.</div>
        )}
      </div>
    </div>
  );
}
