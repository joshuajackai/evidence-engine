/* =========================================================================
   THE TAILOR GENERATOR
   Scoring, linting and prompt assembly for the resume-and-CV pair. Everything
   here is deterministic and runs after the model returns, so what the model
   missed is surfaced honestly rather than trusted.
   ========================================================================= */
import type { GenResult, Job, Keyword } from "@/types";
import { S } from "@/store/state";
import { GRADE, downloadBlob, esc } from "@/lib/util";
import { GEN_SYSTEM } from "@/lib/ai/prompts";
import { kwHitInText } from "./score";
import { mdToHtml } from "./markdown";

export function computeGenMatch(text: string, kwList: Keyword[]): { pct: number; hits: string[]; miss: string[] } {
  const hits: string[] = [];
  const miss: string[] = [];
  (kwList || []).forEach((o) => {
    if (kwHitInText(text, o.k)) hits.push(o.k);
    else miss.push(o.k);
  });
  const pct = kwList && kwList.length ? Math.round((hits.length / kwList.length) * 100) : 0;
  return { pct, hits, miss };
}

/** ATS readability against the generated Markdown, not against a template. */
export function computeGenAts(md: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;
  const pen = (n: number, msg: string) => {
    score -= n;
    issues.push(msg);
  };
  if (/^\s*\|.*\|/m.test(md)) pen(15, "Tables detected. Most ATS parsers scramble tables.");
  if (/<[a-z][a-z0-9]*[\s>]/i.test(md)) pen(10, "Raw HTML tags in the output. Keep it Markdown or plain text.");
  if (/[—–]/.test(md)) pen(6, "Em or en dash detected. Standard hyphens parse more reliably.");
  if (!/^\s*#\s+/m.test(md)) pen(4, "Missing top-level heading with the candidate name.");
  const sects = ["experience", "skills", "education", "summary", "projects"];
  const hitSects = sects.filter((s) => new RegExp("(^|\\n)#{1,3}\\s.*" + s, "i").test(md));
  if (hitSects.length < 2)
    pen(15, "Standard section headings missing. ATS parsers look for Experience, Skills, Education.");
  const words = (md.match(/[A-Za-z]+/g) || []).length;
  if (words < 180) pen(15, "Under 180 words. Too thin for keyword-density scoring.");
  if (words > 1800) pen(8, "Over 1,800 words. A two-page CV should stay under roughly 1,200 words.");
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(md)) pen(8, "Emoji or icon glyph detected. Parsers often drop them.");
  if (/(?:columns|multicol)/i.test(md)) pen(6, "Column instruction in the text. Single column parses best.");
  return { score: Math.max(0, Math.min(100, score)), issues };
}

/* Voice lint. Hard rules, checked deterministically after the model returns.
   Anything the model missed is surfaced honestly. */
const GEN_BANNED = [
  "delve into", "dive into", "unlock", "unleash", "leverage", "transformative", "seamless",
  "robust", "dynamic", "holistic", "streamline", "optimize", "empower", "foster", "elevate",
  "revolutionize", "game changer", "cutting-edge", "powerful tool", "valuable insights",
  "journey", "tapestry", "realm", "navigate the landscape", "in an ever-changing",
  "in today's fast-paced", "meaningful impact", "proven track record", "results-driven",
  "data-driven", "passionate about", "excited to", "strategic mindset", "great question",
];
const GEN_CONTR = [
  "don't", "can't", "won't", "i'm", "you're", "we're", "they're", "it's", "that's", "we'll",
  "you'll", "i'd", "i've", "should't", "couldn't", "wouldn't", "haven't", "hasn't", "isn't",
];

export interface LintIssue {
  sev: "high" | "med" | "low";
  msg: string;
}

export function computeGenLint(text: string): { score: number; issues: LintIssue[] } {
  const issues: LintIssue[] = [];
  const t = String(text || "");
  const low = t.toLowerCase();
  if (/[—–]/.test(t))
    issues.push({ sev: "high", msg: "Em or en dash present. Voice rule: commas, periods or colons only." });
  GEN_CONTR.forEach((w) => {
    const re = new RegExp("(?:^|[^a-z])" + w.replace(/'/g, "['’]") + "(?:$|[^a-z])", "i");
    if (re.test(t))
      issues.push({ sev: "med", msg: "Contraction found: '" + w + "'. Voice rule: expand every contraction." });
  });
  GEN_BANNED.forEach((p) => {
    if (low.indexOf(p.toLowerCase()) > -1) issues.push({ sev: "med", msg: "Banned phrase: '" + p + "'." });
  });
  if (/\*\*[A-Za-z][^*]*:\*\*/.test(t))
    issues.push({ sev: "low", msg: "Bold: lead-in in body prose. Reserve bold for short headers." });
  const high = issues.filter((i) => i.sev === "high").length;
  const score = Math.max(0, 100 - high * 20 - (issues.length - high) * 4);
  return { score, issues };
}

/**
 * Deterministic post-check for the most common fabrication risk: the model
 * quietly upgrading years-of-experience or naming a credential the source
 * never had.
 */
export function fabricationCheck(outputText: string): string[] {
  const flags: string[] = [];
  const src = (
    S.rawResume + " " +
    S.units.map((u) => u.action + " " + u.metric + " " + u.role + " " + (u.tags || []).join(" ")).join(" ")
  ).toLowerCase();
  const srcYears: Record<number, 1> = {};
  const srcRe = /(\d+)\+?\s*years?/g;
  let mm: RegExpExecArray | null;
  while ((mm = srcRe.exec(src))) srcYears[+mm[1]] = 1;
  const yearRe = /(\d+)\+?\s*years?/g;
  let m: RegExpExecArray | null;
  while ((m = yearRe.exec(String(outputText || "")))) {
    const n = +m[1];
    if (n >= 3 && !srcYears[n] && !srcYears[n - 1] && !srcYears[n + 1])
      flags.push('"' + m[0] + '" not found in your source');
  }
  return flags.slice(0, 6);
}

/* Source assembly. Every fact the model is allowed to use has to appear here.
   Nothing outside this block is available to it. */
export function genBuildSource(): string {
  const parts: string[] = [];
  if (S.hdr && (S.hdr.name || S.hdr.email || S.hdr.phone)) {
    parts.push(
      "CANDIDATE CONTACT:\n" +
        "Name: " + (S.hdr.name || "(not set)") + "\n" +
        "Title: " + (S.hdr.title || "") + "\n" +
        "Location: " + (S.hdr.loc || "") + "\n" +
        "Email: " + (S.hdr.email || "") + "\n" +
        "Phone: " + (S.hdr.phone || "") + "\n" +
        "Link: " + (S.hdr.link || "") + "\n" +
        "Summary: " + (S.hdr.summary || ""),
    );
  }
  if (S.units && S.units.length) {
    parts.push(
      "EVIDENCE ENTRIES (structured, graded by the user):\n" +
        S.units
          .map(
            (u, i) =>
              i + 1 + ". [" + GRADE[u.metricType][2] + "] " + u.org +
              (u.role ? " - " + u.role : "") + (u.dates ? " (" + u.dates + ")" : "") + "\n" +
              "   Action: " + (u.action || "") + "\n" +
              (u.metric ? "   Number: " + u.metric + "\n" : "") +
              (u.constraint ? "   Constraint held flat: " + u.constraint + "\n" : "") +
              (u.evidence ? "   Evidence source: " + u.evidence + "\n" : "") +
              ((u.tags || []).length ? "   Tags: " + u.tags.join(", ") + "\n" : ""),
          )
          .join(""),
    );
  }
  if (S.rawResume && S.rawResume.trim()) {
    /* Cap to 15,000 chars to keep the request within any provider's token
       budget. If the corpus is bigger, keep the last chunk since that usually
       holds the most recent employers. */
    const raw = S.rawResume.length > 15000 ? S.rawResume.slice(-15000) : S.rawResume;
    parts.push("SOURCE RESUME TEXT (verbatim, this is what every claim must trace to):\n" + raw);
  }
  return parts.join("\n\n---\n\n");
}

export function genBuildUserPrompt(job: Job): string {
  const kw = (job.kw || []).map((o) => o.k).join(", ");
  return (
    "JOB POSTING:\n" +
    "Title: " + (job.title || "") + "\n" +
    "Company: " + (job.co || "") + "\n" +
    "URL: " + (job.url || "") + "\n\n" +
    "JD KEYWORDS (already extracted by the tool):\n" + kw + "\n\n" +
    "FULL JOB DESCRIPTION:\n" + (job.text || "(only the title was available)") +
    "\n\n---\n\n" +
    "SOURCE, the only material you may draw claims from:\n" + genBuildSource() +
    "\n\n---\n\n" +
    "Task: produce the tailored resume and CV as specified in the system prompt. " +
    "Return ONLY the JSON object. No preface, no code fences."
  );
}

export function genBuildCopyPrompt(job: Job): string {
  return GEN_SYSTEM + "\n\n---\n\n" + genBuildUserPrompt(job);
}

/** Extract JSON from a response that may be wrapped in fences or preface prose. */
export function genParseJson(txt: string): Record<string, unknown> {
  let s = String(txt || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The model did not return a JSON object.");
  const body = s.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    /* Retry after stripping trailing commas, a common model tic. */
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"));
  }
}

export function normalizeGen(j: Record<string, any>, job: Job, model: string): GenResult {
  const resumeMd = String(j.resume_md || "").trim();
  const cvMd = String(j.cv_md || "").trim();
  const combined = resumeMd + "\n\n" + cvMd;
  const m = computeGenMatch(combined, job.kw || []);
  const ats = computeGenAts(resumeMd);
  const lint = computeGenLint(combined);
  return {
    resume: resumeMd,
    cv: cvMd,
    summaryLine: j.summary_line || "",
    matchAfter: m.pct,
    kwHit: m.hits,
    kwMiss: m.miss,
    addressed: Array.isArray(j.keywords_addressed) ? j.keywords_addressed : [],
    declined: Array.isArray(j.keywords_declined)
      ? j.keywords_declined.map((d: any) =>
          typeof d === "string" ? { term: d, reason: "" } : { term: d.term || "", reason: d.reason || "" },
        )
      : [],
    positioning: String(j.positioning_notes || ""),
    atsScore: ats.score,
    atsIssues: ats.issues,
    lintScore: lint.score,
    lintIssues: lint.issues,
    model,
    when: Date.now(),
  };
}

/* ---------- downloads ---------- */

export function genBaseName(job: Job, kind: string): string {
  const name = (S.hdr.name || "Tailored") + " - " + (job.co || "Role") + " - " + (job.title || "Role") + " - " + kind;
  return name.replace(/[\\/:*?"<>|]/g, "").slice(0, 110);
}

/** Bundle the Markdown as print-ready HTML with print-safe CSS. */
export function genHtmlDoc(md: string, title: string): string {
  const body = mdToHtml(md);
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + "</title><style>" +
    "body{font-family:Arial,Helvetica,sans-serif; color:#1F1C17; max-width:8.5in; margin:0.5in auto; padding:0; font-size:11pt; line-height:1.42}" +
    "h1{font-size:20pt; margin:0 0 4pt; letter-spacing:-.01em}" +
    "h2{font-size:12pt; text-transform:uppercase; letter-spacing:.05em; background:#DDDDDE; padding:3pt 8pt; margin:14pt 0 6pt; border-radius:2pt}" +
    "h3{font-size:11.5pt; margin:10pt 0 3pt}" +
    "h4{font-size:11pt; margin:8pt 0 2pt}" +
    "ul{margin:4pt 0 8pt 18pt; padding:0}" +
    "li{margin-bottom:2pt}" +
    "p{margin:0 0 6pt}" +
    "strong{font-weight:700}" +
    "@page{size:letter; margin:0.5in}" +
    "</style></head><body>" + body + "</body></html>"
  );
}

export type DownloadKind =
  | "resume-md" | "resume-doc" | "resume-pdf"
  | "cv-md" | "cv-doc" | "cv-pdf";

export function genDownload(kind: DownloadKind, job: Job, g: GenResult): string | null {
  const isCv = /^cv/.test(kind);
  const md = isCv ? g.cv : g.resume;
  const base = genBaseName(job, isCv ? "CV" : "Resume");

  if (/-md$/.test(kind)) {
    downloadBlob(base + ".md", "text/markdown;charset=utf-8", md);
    return null;
  }
  if (/-doc$/.test(kind)) {
    /* Word-openable HTML file with a .doc extension, plus the Word MHTML
       preamble so Word treats it as a document rather than as web content.
       That preamble is the trick that makes the plain HTML approach reliably
       openable across every recent version of Word and Google Docs. */
    const wordDoc =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>" + esc(base) + "</title>" +
      "<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom>" +
      "<w:DoNotOptimizeForBrowser/></w:WordDocument></xml>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif; color:#1F1C17; font-size:11pt; line-height:1.42}" +
      "h1{font-size:20pt; margin:0 0 4pt}" +
      "h2{font-size:12pt; text-transform:uppercase; letter-spacing:.05em; background:#DDDDDE; padding:3pt 8pt; margin:14pt 0 6pt}" +
      "h3{font-size:11.5pt; margin:10pt 0 3pt}" +
      "ul{margin:4pt 0 8pt 18pt; padding:0}" +
      "li{margin-bottom:2pt}" +
      "p{margin:0 0 6pt}" +
      "@page{size:letter; margin:0.5in}" +
      "</style></head><body>" + mdToHtml(md) + "</body></html>";
    downloadBlob(base + ".doc", "application/msword", wordDoc);
    return null;
  }
  if (/-pdf$/.test(kind)) {
    /* Open a print-ready window and trigger print. Users choose "Save as PDF"
       from the print dialog. Works across every browser with no library. */
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return "Pop-up blocked. Allow pop-ups or use the Word download.";
    w.document.open();
    w.document.write(genHtmlDoc(md, base));
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* the user can print from the window themselves */
      }
    }, 250);
    return null;
  }
  return null;
}
