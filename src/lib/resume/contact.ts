/* =========================================================================
   CONTACT EXTRACTION
   The header was a blank form the user had to fill in by hand, and every one of
   those fields is already sitting in the first six lines of the file they just
   uploaded. Leaving it blank also meant the export carried "Your Name".
   ========================================================================= */
export interface ExtractedContact {
  name?: string;
  email?: string;
  phone?: string;
  loc?: string;
  link?: string;
}

export function extractContact(text: string): ExtractedContact {
  const head = String(text || "").split(/\r?\n/).slice(0, 14);
  const joined = head.join("\n");
  const out: ExtractedContact = {};
  let m: RegExpMatchArray | null;

  if ((m = joined.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/))) out.email = m[0];
  if ((m = joined.match(/(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)))
    out.phone = m[0].trim();

  /* City, ST or City, Country. Matched per line, because run across the whole
     block the name on line one gets glued to the city on line two. */
  for (let li = 0; li < head.length && !out.loc; li++) {
    const seg = head[li].split(/\s*[|·•]\s*/);
    for (let si = 0; si < seg.length; si++) {
      const hit = seg[si].match(
        /^\s*([A-Z][a-zA-Z.'-]+(?:\s[A-Z][a-zA-Z.'-]+){0,2}),\s*([A-Z]{2}|[A-Z][a-z]{2,})\s*$/,
      );
      if (hit && !/^(university|college|inc|llc|ltd)/i.test(hit[1])) {
        out.loc = hit[0].trim();
        break;
      }
    }
  }

  let links: string[] = Array.from(
    joined.match(
      /\b(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|io|co|dev|design|me|net|org|xyz|app)(?:\/[\w\-./?%&=+#]*)?/gi,
    ) || [],
  );
  /* The domain half of the email address matches this pattern too, so
     josh@example.com was being offered back as a portfolio link. */
  const mailDomain = out.email ? out.email.split("@")[1].toLowerCase() : "";
  links = links.filter((l) => {
    const d = l.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (mailDomain && d.indexOf(mailDomain) === 0) return false;
    return !/@/.test(l) && !/^(gmail|yahoo|outlook|hotmail|icloud|proton|aol)\./i.test(d);
  });
  /* A LinkedIn URL is worth more to a recruiter than any other link. */
  links.sort((a, b) => (/linkedin/i.test(b) ? 1 : 0) - (/linkedin/i.test(a) ? 1 : 0));
  if (links.length) out.link = links.slice(0, 2).join(" · ");

  /* The name is the first line that is not a heading, not contact data and not
     a sentence. Almost always literally the first line. */
  for (let i = 0; i < head.length; i++) {
    const t = head[i].trim();
    if (!t || t.length > 44) continue;
    if (/@|https?:|\d{3}/.test(t)) continue;
    if (/^(resume|curriculum|cv|profile|summary|objective|experience|contact)\b/i.test(t)) continue;
    const words = t.replace(/[|·,].*$/, "").trim().split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w) || /^[A-Z.]{1,3}$/.test(w))
    ) {
      out.name = words.join(" ");
      break;
    }
  }
  return out;
}
