/* =========================================================================
   RESUME CLEAN-UP PROMPT
   The parser here is good, but it cannot rescue a two-column PDF with the dates
   in a sidebar and the job titles in a text box. Neither can the applicant
   tracking system the user is about to submit to, which is the real point. The
   cheapest fix is to hand the user a prompt for the AI they already pay for,
   have it reformat their own history once, and bring the clean version back.

   Two rules make this prompt worth shipping rather than generic advice. It
   specifies the exact structure this parser and most ATS parsers read best, and
   it forbids invention in the same terms the rest of this product does.
   ========================================================================= */

export interface PrepFlags {
  twoCol: boolean;
  thin: number;
}

export const PREP_FLAGS: PrepFlags = { twoCol: false, thin: 0 };

export function prepPrompt(): string {
  let extra = "";
  if (PREP_FLAGS.twoCol)
    extra +=
      "\n- My current file appears to use a two-column layout, so the reading order may already be " +
      "scrambled. Rebuild the order from meaning, not from the order the text arrives in.";
  if (PREP_FLAGS.thin)
    extra +=
      "\n- An automated parser only found " + PREP_FLAGS.thin + " usable bullet(s) in my current " +
      "file, so assume the structure is unclear and be explicit about it.";

  return [
    "You are reformatting my existing resume so that applicant tracking systems and AI resume parsers",
    "can read every word of it correctly. You are not writing a new resume, you are not a career coach,",
    "and you are not improving my career story. You are a formatter.",
    "",
    "I am attaching my current resume. I may also attach older resumes, cover letters, a LinkedIn export",
    "or rough notes. Merge them into one document.",
    "",
    "THE RULE THAT MATTERS MOST",
    "Do not invent anything. Every employer, job title, date, tool, certification and number in your",
    "output must already appear somewhere in what I gave you. If a detail is missing, leave it out and",
    "list it at the end under THINGS I COULD NOT FIND. Never estimate a figure, never round one up,",
    "never upgrade my verbs to make a task sound like ownership, and never add an achievement I did not",
    "describe. If two files disagree, use the more recent one and flag the conflict at the end.",
    "",
    "Equally, do not delete a number that IS there. Numbers are the most valuable thing in the document.",
    "Keep each one in the same bullet as the work that produced it, along with any condition I mentioned",
    'such as "with no increase in budget" or "with the same headcount".',
    "",
    "OUTPUT FORMAT, FOLLOW IT EXACTLY",
    "Plain text only. No markdown, no bold, no tables, no columns, no text boxes, no headers or footers,",
    "no icons, no emoji, no graphics, no page numbers. One column, top to bottom. Return the whole thing",
    "inside a single code block so I can copy it in one go.",
    "",
    "FULL NAME",
    "City, State | email@address.com | phone | portfolio URL | LinkedIn URL",
    "",
    "SUMMARY",
    "Two or three sentences. Only claims that appear in my source material.",
    "",
    "SKILLS",
    "Comma separated on one or more plain lines. No columns, no tables, no proficiency bars, no ratings.",
    "Group related tools together if it helps, but keep it as running text.",
    "",
    "EXPERIENCE",
    "",
    "Job Title | Company Name",
    "Month Year - Month Year",
    "- One achievement per bullet, starting with a plain hyphen and a space.",
    "- Start each bullet with a concrete past-tense verb: rebuilt, migrated, negotiated, wrote, shipped,",
    "  diagnosed, reduced. Avoid responsible for, assisted with, leveraged, spearheaded, utilised.",
    "- Keep each bullet to one sentence. Do not wrap a single achievement across two bullets.",
    "",
    "Repeat that block for every role, most recent first.",
    "",
    "EDUCATION",
    "Degree, Institution, Year",
    "",
    "CERTIFICATIONS",
    "Name, Issuer, Year. Omit this heading entirely if I have none.",
    "",
    "FORMATTING RULES THAT BREAK PARSERS IF IGNORED",
    "- Use the plain ASCII hyphen for bullets. Never use a bullet glyph, an asterisk, an en dash or an",
    "  em dash anywhere in the document.",
    "- Use straight quotes and straight apostrophes only. No curly quotes.",
    "- Spell dates as Month Year, for example March 2024 - Present. Never 3/24 or 03.2024.",
    "- Write the section headings exactly as given above, in capitals, on their own line. An ATS looks",
    "  for these specific words. Do not rename EXPERIENCE to Where I Have Worked.",
    "- Put the company and the job title on the same line separated by a vertical bar, and the dates",
    "  alone on the next line. Never put dates in the same line as the title.",
    "- Spell out an abbreviation the first time it appears, then use the short form: Search Engine",
    "  Optimization (SEO).",
    "- Keep the contact line as plain text. Do not hyperlink it, do not use a mailto, do not split the",
    "  phone number across lines.",
    "- No line should be a fragment of the line above it.",
    "",
    "AFTER THE RESUME",
    "Add these two short sections outside the code block:",
    "1. THINGS I COULD NOT FIND. Anything a hiring manager will expect that was missing, especially",
    "   missing dates, missing employers and achievements with no number attached.",
    "2. NUMBERS WORTH CHASING. For each bullet with no figure, name the specific number I should go and",
    "   look up, and where I would most likely find it. Do not guess the value.",
    extra ? "\nADDITIONAL CONTEXT ABOUT MY FILE" + extra : "",
  ]
    .join("\n")
    .trim();
}
