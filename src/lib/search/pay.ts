/* =========================================================================
   PAY EXTRACTION
   Boards publish pay in a dozen shapes and most tools throw it away, which
   leaves the user opening twenty tabs to find out a role pays half what they
   need. Parsed into a comparable annual number so it can be filtered on.
   ========================================================================= */
import type { Pay } from "@/types";

export function parsePay(input: string): Pay | null {
  const s = String(input || "");
  let best: Pay | null = null;

  function num(v: string | undefined, suf: string | undefined): number | null {
    if (v == null) return null;
    let n = parseFloat(String(v).replace(/,/g, ""));
    if (isNaN(n)) return null;
    if (suf && /^k/i.test(suf)) n *= 1000;
    return n;
  }

  function scan(re: RegExp, needWord: boolean): void {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      let lo: number | null;
      let hi: number | null;
      if (needWord) {
        lo = num(m[2], m[3]);
        hi = m[4] ? num(m[4], m[5]) : lo;
      } else {
        lo = num(m[2], m[3]);
        hi = m[5] ? num(m[5], m[6]) : lo;
      }
      if (lo == null || hi == null) continue;
      const ctx = s.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).toLowerCase();
      if (
        needWord &&
        !/\b(salary|salaries|compensation|comp|pay|paying|rate|base|range|earn|usd|cad|gbp|eur|annum|annually|per\s+year|yearly|hourly|per\s+hour)\b/.test(
          ctx,
        )
      )
        continue;
      const per: Pay["per"] = /\b(hour|hr|hourly|\/hr|per hour)\b/.test(ctx)
        ? "hour"
        : /\b(day|daily|\/day)\b/.test(ctx)
          ? "day"
          : /\b(month|monthly|\/mo|per month)\b/.test(ctx)
            ? "month"
            : "year";
      /* Sanity: an "annual" figure under 1,000 is not a salary, it is a discount
         code or an equity number that happened to sit near a dollar sign. */
      const annual = per === "hour" ? hi * 2080 : per === "day" ? hi * 230 : per === "month" ? hi * 12 : hi;
      if (per === "year" && hi < 1000) continue;
      if (per === "hour" && (hi < 8 || hi > 900)) continue;
      if (annual < 12000 || annual > 2000000) continue;
      const cand: Pay = { lo, hi, per, annual: Math.round(annual), cur: m[1] || "$" };
      if (!best || cand.annual > best.annual) best = cand;
    }
  }

  /* Two passes. The first needs a currency symbol. The second accepts a bare
     figure but only when a pay word is sitting next to it, which is how most
     boards write "Salary: 140k" and "Compensation 120,000 to 150,000". */
  scan(
    /([$£€])\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k\b|,000\b)?(?:\s*(?:-|to|–|—)\s*([$£€])?\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k\b|,000\b)?)?/gi,
    false,
  );
  if (!best)
    scan(
      /()(\d{2,3}(?:,\d{3})*(?:\.\d+)?|\d{2,3})\s*(k\b|,000\b)?(?:\s*(?:-|to|–|—)\s*(\d{2,3}(?:,\d{3})*(?:\.\d+)?|\d{2,3})\s*(k\b|,000\b)?)?/gi,
      true,
    );
  return best;
}

export function payLabel(p: Pay | null | undefined): string {
  if (!p) return "";
  const f = (n: number) => (n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n)));
  const unit = p.per === "hour" ? "/hr" : p.per === "day" ? "/day" : p.per === "month" ? "/mo" : "";
  const body = p.lo === p.hi ? f(p.lo) : f(p.lo) + "-" + f(p.hi);
  return p.cur + body + unit;
}

export function typeOf(title: string, raw: string): string[] {
  const s = ((title || "") + " " + (raw || "")).toLowerCase();
  const out: string[] = [];
  if (/\bintern(ship)?\b/.test(s)) out.push("intern");
  if (/contract|freelance|1099|temporary|fractional|consultant/.test(s)) out.push("contract");
  if (/part[\s-]?time/.test(s)) out.push("parttime");
  if (/full[\s-]?time/.test(s)) out.push("fulltime");
  if (/remote|anywhere|distributed/.test(s)) out.push("remote");
  return out;
}
