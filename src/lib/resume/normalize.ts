/* =========================================================================
   CLEAN-UP PASS
   Real resumes are not clean text. A PDF export brings ligatures, smart quotes,
   page furniture, hyphens split across line breaks and bullets wrapped over
   three lines. Feeding that straight into the splitter produces fragments, and
   feeding it to an ATS produces a mangled parse. Everything is normalised here
   first, and the user is told what changed so nothing happens invisibly.
   ========================================================================= */
import { BULLET_RE, DATE_RE, sectionOf } from "./text";

export interface NormalizeResult {
  text: string;
  fixes: string[];
  suspectTwoColumn: boolean;
}

export function normalizeResume(raw: string): NormalizeResult {
  const fixes: string[] = [];
  let s = String(raw || "");
  const note = (cond: boolean, label: string) => {
    if (cond) fixes.push(label);
  };

  let before = s;
  s = s
    .replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl").replace(/ﬀ/g, "ff")
    .replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl");
  note(s !== before, "ligatures unpacked");

  before = s;
  s = s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    /* Includes U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash
       and U+2212 minus. Word and InDesign emit all of them and none of them
       are the ASCII hyphen a parser is looking for. */
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/…/g, "...");
  note(s !== before, "smart quotes and dashes straightened");

  before = s;
  s = s
    .replace(/[         　]/g, " ")
    .replace(/[​‌‍⁠﻿­]/g, "")
    .replace(/\t+/g, "  ");
  note(s !== before, "invisible and non-breaking characters removed");

  before = s;
  s = s.replace(/^[ \t]*[▪●◦‣⁃∙·•○❖➢➜]\s*/gm, "• ");
  note(s !== before, "bullet glyphs standardised");

  before = s;
  s = s
    .replace(/^\s*(page\s*\d+\s*(of\s*\d+)?|\d+\s*\/\s*\d+)\s*$/gim, "")
    .replace(/^\s*\d{1,2}\s*$/gm, "")
    .replace(/^\s*(confidential|curriculum vitae|r[eé]sum[eé])\s*$/gim, "");
  note(s !== before, "page numbers and headers dropped");

  /* A word hyphenated across a line break is one word, not two. */
  before = s;
  s = s.replace(/([a-z])-\n\s*([a-z])/g, "$1$2");
  note(s !== before, "words rejoined across line breaks");

  /* Letter-spaced text. A PDF that applies tracking to a heading or a contact
     line can export one glyph per token, so "josh@example.com" arrives as
     "j o s h @ e x a m p l e . c o m". Four or more single-character tokens in
     a row does not occur in real prose, which makes this safe to collapse. */
  before = s;
  s = s.replace(
    /(?:(?:^|(?<=\s))[A-Za-z0-9@._+-] ){3,}[A-Za-z0-9@._+-](?=\s|$)/g,
    (run) => run.replace(/ /g, ""),
  );
  note(s !== before, "letter-spaced text collapsed");

  /* Contact details still split around the separators. */
  before = s;
  s = s.replace(/([\w.+-]+)\s*@\s*([\w-]+)\s*\.\s*(\w{2,})/g, "$1@$2.$3");
  note(s !== before, "email addresses reassembled");

  /* Rejoin wrapped continuation lines.
     The old rule required the NEXT line to start lowercase, which missed the
     two commonest wraps in a real export and split one sentence into two
     entries. A line is now also treated as continuing when it ENDS on
     something that cannot end a sentence, whatever the next line starts with. */
  const CONTINUES =
    /(\b(?:a|an|the|and|or|but|of|in|on|at|to|for|with|from|by|as|into|over|under|across|per|via|plus|than|that|which|while|after|before|during|about)\b|[,:;\-–—/&+]|\b\d+(?:\.\d+)?%?)$/i;
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  let joined = 0;
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    while (i + 1 < lines.length) {
      const nxt = lines[i + 1];
      const curT = cur.trim();
      const nxtT = nxt.trim();
      if (!curT || !nxtT) break;
      if (/[.;:!?]$/.test(curT)) break; /* a finished sentence */
      if (BULLET_RE.test(nxt)) break; /* the next bullet */
      if (sectionOf(nxtT)) break; /* a section heading */
      if (DATE_RE.test(nxtT) && nxtT.length < 90) break; /* a new job header follows */
      /* And the CURRENT line is a job header when it carries a date, is short
         and is not a bullet. Without this the "ends on a number so it
         continues" rule glued a header onto its own first sentence. */
      if (!BULLET_RE.test(cur) && DATE_RE.test(curT) && curT.length < 90) break;
      if (curT.length < 25) break;
      const nextStartsLower = /^[a-z(]/.test(nxtT);
      const curDangles = CONTINUES.test(curT);
      if (!nextStartsLower && !curDangles) break;
      cur = curT + " " + nxtT;
      i++;
      joined++;
    }
    out.push(cur);
  }
  s = out.join("\n");
  note(joined > 0, joined + " wrapped line" + (joined > 1 ? "s" : "") + " rejoined");

  /* PDF TEXT-LAYER SPACING.
     A PDF stores glyph positions, not words, so an extractor guesses where the
     spaces go and routinely puts them in the wrong place. Runs AFTER the
     wrapped-line rejoin: continuation lines are not bullets yet, so de-spacing
     first left every wrapped half untouched. Applied to BULLET LINES ONLY,
     because on a header line " - " is usually a real separator. */
  before = s;
  s = s
    .split(/\r?\n/)
    .map((ln) => {
      if (!BULLET_RE.test(ln)) return ln;
      return ln
        .replace(/\s+([,;:.!?])(\s|$)/g, "$1$2")
        .replace(/(\w)\s*-\s+(\w)/g, "$1-$2")
        .replace(/(\w)\s+-\s*(\w)/g, "$1-$2")
        /* "3 D" and "5 x" and "31 x". Deliberately narrow: "43 KB",
           "12 categories" and "14 days" are correct with the space. */
        .replace(/\b(\d+)\s+([xX])\b/g, "$1$2")
        .replace(/\b(\d+)\s+D\b/g, "$1D")
        .replace(/([$£€])\s+(\d)/g, "$1$2")
        .replace(/(\d)\s+%/g, "$1%");
    })
    .join("\n");
  note(s !== before, "PDF spacing repaired");

  before = s;
  s = s.replace(/[ ]{3,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  note(s !== before, "spacing tidied");

  /* Two-column PDFs interleave text and there is no reliable repair. Detect it
     and say so rather than silently producing nonsense. */
  const body = s.split(/\r?\n/).filter((l) => l.trim());
  let shortRun = 0;
  let worstRun = 0;
  body.forEach((l) => {
    if (l.trim().length < 26) {
      shortRun++;
      worstRun = Math.max(worstRun, shortRun);
    } else shortRun = 0;
  });
  const suspect = body.length > 15 && worstRun >= 8;

  return { text: s, fixes, suspectTwoColumn: suspect };
}

/* =========================================================================
   LANGUAGE CHECK

   The importer reads English month names, English section headings such as
   EXPERIENCE and SKILLS, an English stop-word list and English metric words. A
   French or German resume will split badly, and the honest thing is to say so
   before it does rather than hand back three broken entries.

   Deliberately conservative: it looks for positive evidence of another
   language rather than for the absence of English, because a resume can be in
   English and still contain almost none of these headings.
   ========================================================================= */

/** Markers that essentially never appear in an English-language resume. */
const NON_ENGLISH_MARKERS: [lang: string, re: RegExp][] = [
  ["es", /\b(experiencia laboral|formación|educación|habilidades|competencias|idiomas|referencias|actualmente|licenciatura)\b/i],
  ["fr", /\b(expérience professionnelle|formation|compétences|langues|références|actuellement|dipl[oô]me|stage)\b/i],
  ["de", /\b(berufserfahrung|ausbildung|kenntnisse|fähigkeiten|lebenslauf|sprachen|referenzen|derzeit|abschluss)\b/i],
  ["pt", /\b(experiência profissional|formação|habilidades|competências|idiomas|referências|atualmente)\b/i],
  ["it", /\b(esperienza lavorativa|formazione|competenze|lingue|referenze|attualmente|laurea)\b/i],
  ["nl", /\b(werkervaring|opleiding|vaardigheden|talen|referenties|momenteel)\b/i],
];

/** English section headings the splitter actually depends on. */
const ENGLISH_MARKERS =
  /\b(experience|employment|education|skills|summary|profile|projects|certifications|present|current)\b/i;

export interface LanguageCheck {
  /** True when the text carries clear markers of a language the parser cannot read. */
  looksNonEnglish: boolean;
  /** Best guess at which language, for the message. Empty when unsure. */
  guess: string;
}

export function checkLanguage(text: string): LanguageCheck {
  const s = String(text || "");
  if (s.trim().length < 120) return { looksNonEnglish: false, guess: "" };

  let bestLang = "";
  let bestHits = 0;
  for (const [lang, re] of NON_ENGLISH_MARKERS) {
    const hits = (s.match(new RegExp(re.source, "gi")) || []).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestLang = lang;
    }
  }
  const englishHits = (s.match(new RegExp(ENGLISH_MARKERS.source, "gi")) || []).length;

  /* Two independent markers of another language, and more of them than English
     markers. One match is not enough: "formation" and "profile" are English
     words too, and a bilingual resume should not be refused. */
  const looksNonEnglish = bestHits >= 2 && bestHits > englishHits;
  return { looksNonEnglish, guess: looksNonEnglish ? bestLang : "" };
}
