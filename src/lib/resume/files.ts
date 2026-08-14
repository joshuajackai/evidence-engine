/* =========================================================================
   FILE READING
   PDF and Word need real parsers. Both are loaded on demand, the first time a
   user actually drops one of those formats, so the page keeps making zero
   third-party requests for everybody who pastes text or uploads txt/md.
   ========================================================================= */

interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDoc> };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getTextContent(): Promise<{ items: { str: string; transform: number[] }[] }>;
}
interface MammothLib {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

declare global {
  interface Window {
    pdfjsLib?: PdfLib;
    pdfjsDistBuildPdf?: PdfLib;
    mammoth?: MammothLib;
  }
}

export const CDN = {
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  docx: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
};

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () =>
      rej(
        new Error(
          "Could not load the reader for that format. Check your connection, or paste the text instead.",
        ),
      );
    document.head.appendChild(s);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = () => rej(new Error("That file could not be read."));
    r.readAsText(file);
  });
}

function readAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(new Error("That file could not be read."));
    r.readAsArrayBuffer(file);
  });
}

async function pdfToText(file: File): Promise<string> {
  await loadScript(CDN.pdf);
  const lib = window.pdfjsLib || window.pdfjsDistBuildPdf;
  if (!lib) throw new Error("The PDF reader did not load. Paste the text instead.");
  lib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  const buf = await readAsBuffer(file);
  const doc = await lib.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    /* Rebuild lines from item positions. A naive join loses every line break,
       and line breaks are exactly what the splitter needs to find job blocks. */
    const lines: Record<number, { x: number; s: string }[]> = {};
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      (lines[y] = lines[y] || []).push({ x: it.transform[4], s: it.str });
    }
    Object.keys(lines)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((y) => {
        const line = lines[y]
          .sort((a, b) => a.x - b.x)
          .map((o) => o.s)
          .join(" ");
        out.push(line.replace(/\s+/g, " ").trim());
      });
    out.push("");
  }
  return out.join("\n");
}

async function docxToText(file: File): Promise<string> {
  await loadScript(CDN.docx);
  if (!window.mammoth) throw new Error("The Word reader did not load. Paste the text instead.");
  const buf = await readAsBuffer(file);
  const r = await window.mammoth.convertToHtml({ arrayBuffer: buf });
  const div = document.createElement("div");
  div.innerHTML = r.value || "";
  /* Turn list items back into bullet lines so the splitter recognises them. */
  div.querySelectorAll("li").forEach((li) => {
    li.textContent = "• " + li.textContent;
  });
  div.querySelectorAll("p,li,div,h1,h2,h3,h4,tr").forEach((el) => {
    el.insertAdjacentText("beforeend", "\n");
  });
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n");
}

export async function fileToText(file: File): Promise<string> {
  const n = (file.name || "").toLowerCase();
  if (file.size > 12 * 1024 * 1024)
    throw new Error("That file is larger than 12 MB. Save a smaller copy or paste the text.");
  if (/\.pdf$/.test(n) || file.type === "application/pdf") return await pdfToText(file);
  if (/\.docx$/.test(n) || /wordprocessingml/.test(file.type || "")) return await docxToText(file);
  if (/\.doc$/.test(n))
    throw new Error(
      "Old .doc files are not readable in a browser. Save as .docx or PDF, or paste the text.",
    );
  return await readAsText(file);
}
