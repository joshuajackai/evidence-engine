/* =========================================================================
   THE DOCUMENT

   No rules, no filled bands, no boxes anywhere in it.

   A horizontal rule is a graphic. Some parsers read it as a table edge or a
   section terminator and drop what follows; a coloured band behind a heading
   can be read as a shape and its text skipped. Both were in here once.

   The hierarchy is carried entirely by size, weight, case and spacing, which
   every parser handles because it is just text:
     name      25px bold
     SECTION   11.5px bold, uppercase, wide tracking, generous space above
     Employer  14px bold
     Role      12.5px semibold italic
     bullets   normal weight
   Four unmistakable levels, zero graphics.
   ========================================================================= */
import { forwardRef, type ReactNode } from "react";
import type { Header, Unit, WrittenDoc } from "@/types";
import { S, isPro } from "@/store/state";
import { bullet } from "@/lib/util";
import { prettySkill } from "@/lib/jd/vocab";
import { scoreUnit } from "@/lib/jd/match";

export type PaperMode = "ai" | "evidence" | "ideal";

/** Bracketed text in the specimen is rendered as unmistakably not-yours. */
function Bracketed({ text }: { text: string }) {
  const parts = String(text || "").split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span className="unearned" key={i}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Contact({ h }: { h: Header }) {
  const line = [h.loc, h.phone, h.email].filter(Boolean).join("  |  ");
  return (
    <div className="rcontact">
      {line}
      {h.link ? (
        <>
          <br />
          Portfolio: {h.link}
        </>
      ) : null}
    </div>
  );
}

function Watermark() {
  if (isPro()) return null;
  return <div className="wm">Built with Evidence Engine · free version</div>;
}

export interface PaperProps {
  mode: PaperMode;
  doc: WrittenDoc | null;
  customText: string;
}

export const Paper = forwardRef<HTMLDivElement, PaperProps>(function Paper(
  { mode, doc, customText },
  ref,
) {
  const h = S.hdr;
  const cls =
    "paper f-" + (S.type.font || "sans") + (S.type.accent === "off" ? " mono-accent" : "");
  const style = { fontSize: (S.type.size || "11") + "pt", lineHeight: S.type.lead || "1.5" };

  /* Hand edits win. Once the user has typed their own version, the generator
     stops overwriting it until they explicitly discard. */
  if (customText && customText.trim())
    return (
      <div className={cls} style={style} ref={ref}>
        <TextPaper txt={customText} />
        <Watermark />
      </div>
    );

  if (doc)
    return (
      <div className={cls} style={style} ref={ref}>
        <DocPaper doc={doc} isIdeal={mode === "ideal"} h={h} />
      </div>
    );

  return (
    <div className={cls} style={style} ref={ref}>
      <EvidencePaper h={h} />
    </div>
  );
});

function DocPaper({ doc, isIdeal, h }: { doc: WrittenDoc; isIdeal: boolean; h: Header }) {
  return (
    <>
      {isIdeal && (
        <div className="specimen noprint">
          <b>This is a specimen, not your resume.</b> It shows the candidate this posting was written
          for. Everything in [brackets] is not yours, cannot be defended in an interview, and must
          not be sent. Exporting is disabled while it is on screen.
        </div>
      )}
      <div className="rname">{h.name || "Your Name"}</div>
      {h.title && <div className="rtitle">{h.title}</div>}
      <Contact h={h} />
      {doc.summary && (
        <>
          <h4>Summary</h4>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
            <Bracketed text={doc.summary} />
          </p>
        </>
      )}
      {doc.skills && doc.skills.length > 0 && (
        <>
          <h4>Skills</h4>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
            <Bracketed text={doc.skills.map(prettySkill).join(", ")} />
          </p>
        </>
      )}
      <h4>Experience</h4>
      {(doc.roles || []).map((r, i) => (
        <div className="rentry" key={i}>
          <div className="rorg">
            <span>
              <Bracketed text={r.org || ""} />
            </span>
            {r.dates && <em>{r.dates}</em>}
          </div>
          {r.role && (
            <div className="rrole">
              <Bracketed text={r.role} />
            </div>
          )}
          <ul>
            {(r.bullets || []).map((b, k) => {
              const t = (typeof b === "string" ? b : b.text) || "";
              return (
                <li key={k}>
                  <Bracketed text={t.replace(/\.*$/, "") + "."} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Watermark />
    </>
  );
}

function EvidencePaper({ h }: { h: Header }) {
  const chosen = S.units.filter((u) => S.picked[u.id] !== false);
  if (S.jd.kw && S.jd.kw.length)
    chosen.sort((a, b) => scoreUnit(b, S.jd.kw).s - scoreUnit(a, S.jd.kw).s);

  const byOrg: Record<string, Unit[]> = {};
  const order: string[] = [];
  chosen.forEach((u) => {
    const k = u.org + "||" + (u.role || "");
    if (!byOrg[k]) {
      byOrg[k] = [];
      order.push(k);
    }
    byOrg[k].push(u);
  });

  const skills: Record<string, 1> = {};
  chosen.forEach((u) => (u.tags || []).forEach((t) => (skills[t] = 1)));
  const skillList = Object.keys(skills);

  return (
    <>
      {!h.name && (
        <div
          className="noprint"
          style={{
            background: "var(--none-bg)", border: "1px solid var(--none)", color: "var(--none)",
            borderRadius: 8, padding: "10px 13px", marginBottom: 14, fontSize: 13,
          }}
        >
          <b>Your contact details are not filled in yet.</b> Press <b>Edit heading</b> above, or this
          exports with a placeholder name and no way to reach you.
        </div>
      )}
      <div className="rname">{h.name || "Your Name"}</div>
      {h.title && <div className="rtitle">{h.title}</div>}
      <Contact h={h} />
      <div className="rrule" />
      {h.summary && (
        <>
          <h4>Summary</h4>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{h.summary}</p>
        </>
      )}
      {skillList.length > 0 && (
        <>
          <h4>Skills</h4>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{skillList.join(", ")}</p>
        </>
      )}
      {order.length ? (
        <>
          <h4>Experience</h4>
          {order.map((k) => {
            const us = byOrg[k];
            const f = us[0];
            return (
              <div className="rentry" key={k}>
                <div className="rorg">
                  <span>{f.org}</span>
                  {f.dates && <em>{f.dates}</em>}
                </div>
                {f.role && <div className="rrole">{f.role}</div>}
                <ul>
                  {us.map((u) => (
                    <li key={u.id}>{bullet(u)}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      ) : (
        <div className="empty">
          <h3>No entries were selected for this job</h3>
          <p>
            Nothing in your experience overlapped what this posting asks for, so nothing was chosen
            automatically. That is worth knowing before you apply. Go to <b>Match</b> and switch on
            the entries you still want to show, or pick a different job.
          </p>
        </div>
      )}
      <Watermark />
    </>
  );
}

/**
 * The plain-text editor's format, rendered. Blank lines separate blocks, a line
 * starting with # becomes a section heading, a line starting with - becomes a
 * bullet, and "org :: dates" becomes an employer line.
 */
function TextPaper({ txt }: { txt: string }) {
  const lines = txt.split(/\r?\n/);
  const head: string[] = [];
  let i = 0;
  while (i < lines.length && lines[i].trim() && lines[i].charAt(0) !== "#") {
    head.push(lines[i].trim());
    i++;
  }

  const nodes: ReactNode[] = [];
  let ul: string[] = [];
  const flushUl = (key: string) => {
    if (!ul.length) return;
    nodes.push(
      <ul key={"ul" + key}>
        {ul.map((t, n) => (
          <li key={n}>{t}</li>
        ))}
      </ul>,
    );
    ul = [];
  };

  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      flushUl("b" + i);
      continue;
    }
    if (t.charAt(0) === "#") {
      flushUl("h" + i);
      nodes.push(<h4 key={i}>{t.replace(/^#+\s*/, "")}</h4>);
      continue;
    }
    if (t.charAt(0) === "-") {
      ul.push(t.replace(/^-\s*/, ""));
      continue;
    }
    flushUl("t" + i);
    if (t.indexOf("::") > -1) {
      const p = t.split("::");
      nodes.push(
        <div className="rorg" key={i}>
          <span>{p[0].trim()}</span>
          <em>{p[1].trim()}</em>
        </div>,
      );
    } else nodes.push(<div className="rbody" key={i}>{t}</div>);
  }
  flushUl("end");

  return (
    <>
      <div className="rname">{head[0] || ""}</div>
      {head[1] && <div className="rtitle">{head[1]}</div>}
      {head.length > 2 && (
        <div className="rcontact">
          {head.slice(2).map((l, n) => (
            <div key={n}>{l}</div>
          ))}
        </div>
      )}
      <div className="rrule" />
      {nodes}
    </>
  );
}
