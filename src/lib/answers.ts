/** Screener questions every application asks and nobody enjoys retyping. */
export interface AnswerField {
  k: string;
  q: string;
  type?: "select";
  opts?: string[];
  ph?: string;
}

export const ANSWER_FIELDS: AnswerField[] = [
  { k: "auth", q: "Are you legally authorised to work in this country?", type: "select", opts: ["Yes", "No"] },
  { k: "spon", q: "Will you now or in future need visa sponsorship?", type: "select", opts: ["No", "Yes"] },
  { k: "pay", q: "What are your salary expectations?", ph: "e.g. 135,000 to 155,000, open on the mix" },
  { k: "rate", q: "Hourly or day rate, if contract", ph: "e.g. 85 to 125 per hour" },
  { k: "start", q: "When could you start?", ph: "e.g. Two weeks from an offer" },
  { k: "where", q: "Where are you based, and which hours do you cover?", ph: "e.g. Hayward, CA. Pacific, flexible to Eastern." },
  { k: "remote", q: "Are you comfortable with the stated work arrangement?", type: "select", opts: ["Yes", "Hybrid only", "Remote only"] },
  { k: "notice", q: "Are you currently under contract or notice?", ph: "e.g. No. Available immediately." },
  { k: "port", q: "Portfolio or work samples", ph: "https://" },
  { k: "linked", q: "LinkedIn", ph: "https://linkedin.com/in/" },
  { k: "heard", q: "How did you hear about this role?", ph: "e.g. The company's own careers page" },
  { k: "why", q: "Anything else you want us to know?", ph: "Left blank is fine. One or two sentences at most." },
];

export const STATUSES = ["saved", "applied", "replied", "interview", "offer", "closed"] as const;
