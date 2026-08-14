/* Small Markdown to HTML converter. Handles what the JSON output uses:
   headings, bullets, paragraphs, bold, italic, links, horizontal rules. */
import { esc } from "@/lib/util";

export function mdToHtml(md: string): string {
  const lines = String(md || "").split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inP = false;

  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  const closeP = () => {
    if (inP) {
      out.push("</p>");
      inP = false;
    }
  };
  const inline = (t: string) => {
    let v = esc(t);
    v = v.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    v = v.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    v = v.replace(/`([^`]+)`/g, "<code>$1</code>");
    v = v.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return v;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      closeUl();
      closeP();
      const lvl = m[1].length;
      out.push("<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">");
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      closeP();
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push("<li>" + inline(l.replace(/^\s*[-*]\s+/, "")) + "</li>");
      continue;
    }
    if (/^\s*$/.test(l)) {
      closeUl();
      closeP();
      continue;
    }
    if (/^\s*---+\s*$/.test(l)) {
      closeUl();
      closeP();
      out.push('<div style="border-bottom:1px solid var(--hairline); margin:8px 0"></div>');
      continue;
    }
    closeUl();
    if (!inP) {
      out.push("<p>");
      inP = true;
    } else out.push("<br>");
    out.push(inline(l));
  }
  closeUl();
  closeP();
  return out.join("");
}

/**
 * Highlight matched keywords inside rendered HTML. Wraps whole words only, so
 * 'seo' does not fire on 'season'. Longest first, so 'design system' wraps
 * before 'design'.
 */
export function highlightKw(html: string, hits: string[]): string {
  if (!hits || !hits.length) return html;
  const terms = hits.slice().sort((a, b) => b.length - a.length);
  let out = html;
  terms.forEach((t) => {
    if (!t || t.length < 2) return;
    const pat = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(?<![a-z0-9])(" + pat + ")(?![a-z0-9])", "ig");
    out = out.replace(re, (m) => '<span class="kw-hit">' + m + "</span>");
  });
  return out;
}
