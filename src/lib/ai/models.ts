/* ---- live model discovery ----------------------------------------------
   Anything that is not a text chat model. Embeddings, speech, images and the
   batch/preview duplicates that clutter every catalogue. */
import type { ModelOption, ProviderId } from "@/types";
import { readJson, writeJson } from "@/store/storage";
import { AI_DEFAULTS } from "./providers";
import { aiFetch } from "./fetch";

const NOT_CHAT =
  /(embed|embedding|whisper|tts|audio|speech|voice|moder|rerank|image|vision-only|dall-e|imagen|veo|sora|guard|codestral-embed|:batch$|-batch$|search-index)/i;

/* Families a job seeker is plausibly choosing between, strongest signal first.
   This is ordering for a dropdown, not a benchmark claim. */
const MODEL_FAMILIES: { re: RegExp; fam: string; w: number }[] = [
  { re: /\bclaude\b/i, fam: "claude", w: 100 },
  { re: /\bgpt\b|^o[1-9]\b/i, fam: "gpt", w: 96 },
  { re: /\bgemini\b/i, fam: "gemini", w: 92 },
  { re: /\bgrok\b/i, fam: "grok", w: 80 },
  { re: /\bdeepseek\b/i, fam: "deepseek", w: 78 },
  { re: /\bllama\b/i, fam: "llama", w: 74 },
  { re: /\bmistral|magistral|ministral\b/i, fam: "mistral", w: 70 },
  { re: /\bqwen\b/i, fam: "qwen", w: 66 },
  { re: /\bcommand\b/i, fam: "command", w: 60 },
  { re: /\bglm\b/i, fam: "glm", w: 50 },
  { re: /\bkimi|moonshot\b/i, fam: "kimi", w: 48 },
  { re: /\bnova\b/i, fam: "nova", w: 44 },
];

export function modelFamily(id: string): { fam: string; w: number } | null {
  for (let i = 0; i < MODEL_FAMILIES.length; i++) if (MODEL_FAMILIES[i].re.test(id)) return MODEL_FAMILIES[i];
  return null;
}

/**
 * Highest version number anywhere in the id, so grok-4.5 beats grok-2.
 *
 * Parameter counts have to come out first. "gpt-oss-20b" and
 * "deepseek-r1-distill-llama-70b" were scoring as version 20 and version 70,
 * which made them beat every real flagship.
 */
function modelVersion(id: string): number {
  const s = String(id)
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?\s*[bkm]\b/g, " ") // 20b, 70b, 8x7b sizes
    .replace(/\d{6,}/g, " ") // date stamps
    .replace(/\b(19|20)\d{2}\b/g, " "); // years
  const m = s.match(/(\d+(?:\.\d+)?)/g);
  if (!m) return 0;
  return Math.max(...m.map(parseFloat).filter((n) => n > 0 && n < 100).concat([0]));
}

export function modelRank(id: string): number {
  const f = modelFamily(id);
  const base = f ? f.w : 20;
  let score = base * 100 + modelVersion(id) * 10;
  /* Small, cheap and preview variants are legitimate choices but should not
     open the list ahead of the flagship. */
  if (/mini|lite|flash|small|nano|instant|turbo|fast|haiku|8b|7b/i.test(id)) score -= 25;
  if (/preview|alpha|beta|exp\b|experimental|-0\.\d|test/i.test(id)) score -= 60;
  if (/free\)|:free/i.test(id)) score -= 10;
  return score;
}

const MODEL_CACHE_KEY = "ee.models2";
type ModelCache = Record<string, { t: number; list: ModelOption[] }>;

export function modelCache(): ModelCache {
  return readJson<ModelCache>(MODEL_CACHE_KEY, {});
}

function modelCacheSet(p: string, list: ModelOption[]): void {
  const c = modelCache();
  c[p] = { t: Date.now(), list };
  writeJson(MODEL_CACHE_KEY, c);
}

export function clearModelCache(p: string): void {
  const c = modelCache();
  delete c[p];
  writeJson(MODEL_CACHE_KEY, c);
}

export async function discoverModels(p: ProviderId, key: string): Promise<ModelOption[] | null> {
  const d = AI_DEFAULTS[p];
  if (!d || !d.modelsUrl) return null;
  const cached = modelCache()[p];
  if (cached && Date.now() - cached.t < 6 * 3600 * 1000 && cached.list && cached.list.length)
    return cached.list;

  let url = d.modelsUrl;
  let headers: Record<string, string> = {};
  if (p === "google") url += "?key=" + encodeURIComponent(key || "");
  else if (p === "anthropic")
    headers = {
      "x-api-key": key || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
  else if (!d.modelsNoKey) headers = { authorization: "Bearer " + (key || "") };

  const res = await aiFetch(url, { method: "GET", headers }, 15000);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();

  const raw = Array.isArray(j) ? j : j.data || j.models || [];
  const list: ModelOption[] = [];
  raw.forEach((m: any) => {
    let id = m.id || m.name || m.model || "";
    if (p === "google") id = String(id).replace(/^models\//, "");
    if (!id || NOT_CHAT.test(id)) return;
    /* Gemini publishes what each model can actually do. Use it. */
    if (p === "google" && m.supportedGenerationMethods && m.supportedGenerationMethods.indexOf("generateContent") < 0)
      return;
    let label = m.display_name || m.displayName || m.name || id;
    if (label === id || /^models\//.test(label)) label = id;
    list.push([String(id), String(label).slice(0, 64)]);
  });
  /* A plain descending sort put z-ai at the top of a 323-model list, which is
     alphabetical order wearing a disguise. Rank by how likely somebody is to
     want the model, then by version, newest first within each family. */
  list.sort(
    (a, b) => modelRank(b[0]) - modelRank(a[0]) || b[0].localeCompare(a[0], undefined, { numeric: true }),
  );
  if (!list.length) throw new Error("no chat models returned");
  modelCacheSet(p, list);
  return list;
}

/**
 * Closest surviving relative of a retired model id.
 *
 * Token-prefix matching was too crude: it sent grok-2 to grok-build-0.1 and
 * gpt-4o to gpt-4o-mini, both of which are worse than failing. Match on the
 * model FAMILY instead, then take the best-ranked member of it, which is what
 * a person would pick by hand.
 */
export function pickClosestModel(dead: string, list: ModelOption[] | null): string | null {
  if (!list || !list.length) return null;
  const d = String(dead || "").toLowerCase();
  const vendor = d.indexOf("/") > 0 ? d.split("/")[0] : "";
  const fam = modelFamily(d);

  let pool = list.filter((m) => {
    const id = String(m[0]).toLowerCase();
    if (fam) {
      const f = modelFamily(id);
      return !!f && f.fam === fam.fam;
    }
    return vendor ? id.indexOf(vendor + "/") === 0 : true;
  });
  /* Same family, same vendor is better still. Anthropic's Claude on OpenRouter
     should not be swapped for somebody else's Claude-shaped listing. */
  if (vendor) {
    const sameVendor = pool.filter((m) => String(m[0]).toLowerCase().indexOf(vendor + "/") === 0);
    if (sameVendor.length) pool = sameVendor;
  }
  if (!pool.length) pool = list;

  /* Do not silently move somebody onto a much more expensive tier. Prefer the
     nearest size class to what they had. */
  const wasSmall = /mini|lite|flash|small|nano|haiku|instant|turbo/i.test(d);
  pool.sort((a, b) => {
    let sa = modelRank(a[0]);
    let sb = modelRank(b[0]);
    if (wasSmall) {
      if (/mini|lite|flash|small|nano|haiku|instant/i.test(a[0])) sa += 400;
      if (/mini|lite|flash|small|nano|haiku|instant/i.test(b[0])) sb += 400;
    }
    return sb - sa;
  });
  return pool[0][0];
}
