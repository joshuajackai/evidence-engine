/* =========================================================================
   THE ATS CHECK
   Checks run against the rendered DOM, so the score reflects what will actually
   be exported rather than what the template promises. Asserting "no horizontal
   lines" in the CSS is not the same as knowing there are none.
   ========================================================================= */
import { S } from "@/store/state";
import { bullet } from "@/lib/util";
import type { Suggestion } from "@/types";

export interface AtsCheck {
  ok: boolean;
  label: string;
}

export interface AtsResult {
  score: number;
  checks: AtsCheck[];
  failed: string[];
}

export function runATS(p: HTMLElement | null): AtsResult {
  if (!p) return { score: 0, checks: [], failed: [] };
  const txt = p.innerText || "";
  const checks: AtsCheck[] = [];
  const add = (ok: boolean, label: string) => checks.push({ ok: !!ok, label });

  add(!p.querySelector("table"), "No tables");
  add(!p.querySelector("img,svg,canvas"), "No images or icons in content");
  const cc = getComputedStyle(p).columnCount;
  add(cc === "auto" || cc === "1", "Single column");
  add(parseFloat(S.type.size || "11") >= 10, "Body text at least 10 pt");
  add(!/[—–]/.test(txt), "No dashes that split words in parsing");
  add(!/[-]/.test(txt), "No private use or icon glyphs");

  const heads = [...p.querySelectorAll("h4")].map((h) => (h.textContent || "").trim().toLowerCase());
  add(heads.length > 0, "Section headings present");
  add(heads.some((h) => /experience|employment|work/.test(h)), "Experience section named plainly");
  const nameEl = p.querySelector(".rname");
  add(!!nameEl && (nameEl.textContent || "").trim().length > 1, "Name is real text");
  add(/@|\d{3}/.test((p.querySelector(".rcontact") || { textContent: "" }).textContent || ""), "Contact details as text");
  const lis = p.querySelectorAll("li");
  add(lis.length > 0, "Bullets used for achievements");
  add(getComputedStyle(p).getPropertyValue("list-style-type") !== "none", "Standard bullet characters");

  /* Measure the rendered document: any element carrying a visible border, a
     filled background behind text, or a zero-height block is a graphic as far
     as a parser is concerned. */
  const graphics: string[] = [];
  const nodes = p.querySelectorAll("*");
  for (let gi = 0; gi < nodes.length; gi++) {
    const el = nodes[gi] as HTMLElement;
    if (el.closest(".noprint")) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bw = (["Top", "Right", "Bottom", "Left"] as const).some((side) => {
      return (
        parseFloat(cs.getPropertyValue("border-" + side.toLowerCase() + "-width")) > 0 &&
        cs.getPropertyValue("border-" + side.toLowerCase() + "-style") !== "none" &&
        cs.getPropertyValue("border-" + side.toLowerCase() + "-color") !== "rgba(0, 0, 0, 0)"
      );
    });
    const filled =
      !!cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    const hairline = r.height > 0 && r.height <= 4 && r.width > 40 && (filled || bw);
    if (bw || hairline || (filled && (el.textContent || "").trim()))
      graphics.push(el.className || el.tagName);
  }
  add(
    graphics.length === 0,
    "No rules, boxes or filled bands" + (graphics.length ? " (" + graphics.length + " found)" : ""),
  );

  /* Four distinct text levels is what lets a parser and a human find the
     structure without any graphics doing the work. */
  const szName = parseFloat(getComputedStyle((p.querySelector(".rname") as HTMLElement) || p).fontSize) || 0;
  const h4 = p.querySelector("h4") as HTMLElement | null;
  const org = p.querySelector(".rorg") as HTMLElement | null;
  const li0 = p.querySelector("li") as HTMLElement | null;
  const levels = [
    szName,
    h4 ? parseFloat(getComputedStyle(h4).fontSize) : 0,
    org ? parseFloat(getComputedStyle(org).fontSize) : 0,
    li0 ? parseFloat(getComputedStyle(li0).fontSize) : 0,
  ];
  const distinct =
    szName > 0 && !!h4 && !!org && !!li0 &&
    getComputedStyle(h4).textTransform === "uppercase" &&
    parseInt(getComputedStyle(org).fontWeight, 10) >= 600 &&
    szName > levels[2] && levels[2] >= levels[3];
  add(distinct, "Heading levels distinguished by type, not graphics");

  const ok = checks.filter((c) => c.ok).length;
  const score = Math.round((ok / checks.length) * 100);
  return { score, checks, failed: checks.filter((c) => !c.ok).map((c) => c.label) };
}

/* ---------- readability suggestions ----------
   Deterministic checks first. The model is only offered for the rewrite, and
   only on lines the user already wrote, and only after they tick a box. */
export function readabilitySuggestions(atsFailed: string[]): Suggestion[] {
  const out: Suggestion[] = [];
  atsFailed.forEach((f) =>
    out.push({ kind: "ats", label: f, fix: "Structural. Fix it in the controls rather than by rewriting." }),
  );
  const chosen = S.units.filter((u) => S.picked[u.id] !== false);
  chosen.forEach((u) => {
    const b = bullet(u);
    if (!b) return;
    if (/^(managed|helped|assisted|worked on|responsible for|supported|participated)/i.test(b))
      out.push({ kind: "verb", id: u.id, label: "Weak opening verb", detail: b.slice(0, 90) });
    if (b.split(/\s+/).length > 34)
      out.push({ kind: "long", id: u.id, label: "Bullet runs long, parsers truncate", detail: b.slice(0, 90) });
    if (u.metricType === "none")
      out.push({ kind: "nonum", id: u.id, label: "No number attached", detail: b.slice(0, 90) });
  });
  if (!S.hdr.summary)
    out.push({
      kind: "summary",
      label: "No summary line",
      fix: "Two sentences at the top help a human reader and give the parser context.",
    });
  return out;
}
