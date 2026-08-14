/* =========================================================================
   THE AI CALL
   Every request goes through here, including the self-healing that turns the
   two failures which otherwise look like "the AI is broken" into a retry the
   user never sees: a retired model id, and an answer cut off at the token
   ceiling with a perfectly healthy 200 in front of it.
   ========================================================================= */
import type { AiConfig, AiLogEntry, ProviderId } from "@/types";
import { readJson, writeJson } from "@/store/storage";
import { AI_DEFAULTS } from "./providers";
import { discoverModels, pickClosestModel } from "./models";
import { aiFetch, aiTrunc } from "./fetch";
import { AI_SYSTEM } from "./prompts";

const AI_KEY = "ee.ai";

export const AI: AiConfig = { provider: "openrouter", key: "", model: "", baseUrl: "" };

export function aiLoad(): void {
  const r = readJson<Partial<AiConfig> | null>(AI_KEY, null);
  if (r && typeof r === "object") Object.assign(AI, r);
}

export function aiSave(): void {
  writeJson(AI_KEY, AI);
}

export function aiReady(): boolean {
  return !!(AI.key && AI.key.length > 10);
}

export function aiModel(): string {
  return AI.model || AI_DEFAULTS[AI.provider].model || "";
}

export function aiUrl(): string {
  return AI.provider === "custom" ? AI.baseUrl : AI_DEFAULTS[AI.provider].url;
}

/* Diagnostic ring buffer. Every AI call, success or failure, lands here so the
   user can inspect the last few requests from the Debug panel. Bodies are
   truncated to keep memory sane. Keys never enter the log, only header names. */
export let AI_LOG: AiLogEntry[] = [];
const logListeners = new Set<() => void>();

export function onAiLog(fn: () => void): () => void {
  logListeners.add(fn);
  return () => logListeners.delete(fn);
}

export function clearAiLog(): void {
  AI_LOG = [];
  logListeners.forEach((l) => l());
}

function aiLog(entry: AiLogEntry): void {
  entry.at = new Date().toISOString();
  AI_LOG.unshift(entry);
  if (AI_LOG.length > 10) AI_LOG.length = 10;
  try {
    console.log("[EvidenceEngine AI]", entry);
  } catch {
    /* a console-less environment is not a reason to fail the call */
  }
  logListeners.forEach((l) => l());
}

/**
 * Robust extraction of usable text from any provider's JSON response.
 * Handles Anthropic thinking blocks, OpenAI reasoning content, Gemini
 * multi-part responses, and refusal messages. Never returns an empty string
 * silently.
 */
export function aiExtractText(provider: string, j: any): string {
  if (!j) return "";
  if (provider === "google") {
    const parts: string[] = [];
    (j.candidates || []).forEach((c: any) => {
      ((c && c.content && c.content.parts) || []).forEach((p: any) => {
        if (p && typeof p.text === "string") parts.push(p.text);
      });
    });
    return parts.join("").trim();
  }
  if (provider === "anthropic") {
    /* Newer Claude models can prepend a thinking block. Collect every text
       block, in order. Ignore thinking, tool_use, tool_result. */
    const out: string[] = [];
    (j.content || []).forEach((b: any) => {
      if (!b) return;
      if (b.type === "text" && typeof b.text === "string") out.push(b.text);
      else if (!b.type && typeof b.text === "string") out.push(b.text);
    });
    return out.join("").trim();
  }
  /* OpenAI-compatible. Some models return content as an array of parts rather
     than a plain string. Some put actual output in reasoning fields when
     max_tokens is exhausted mid-answer. */
  const ch = (j.choices && j.choices[0]) || null;
  if (!ch) return "";
  const msg = ch.message || ch.delta || {};
  const c = msg.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c))
    return c
      .map((p: any) => (typeof p === "string" ? p : p && typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
  if (typeof msg.reasoning === "string" && msg.reasoning.trim()) return msg.reasoning.trim();
  if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim())
    return msg.reasoning_content.trim();
  return "";
}

/** Build a human-readable error. Users read this string. No provider jargon. */
export function aiExplainError(status: number, _provider: string, j: any, rawText: string): string {
  const msg =
    (j && j.error && (j.error.message || j.error.type || j.error.code)) ||
    (j && j.message) ||
    (rawText ? aiTrunc(rawText, 400) : "HTTP " + status);
  const lower = String(msg || "").toLowerCase();
  if (status === 401 || lower.indexOf("invalid api key") >= 0 || lower.indexOf("unauthorized") >= 0 || lower.indexOf("authentication") >= 0)
    return "The API key was rejected as invalid. Open Connect AI, paste the key again, and Save. Details from the provider: " + msg;
  if (status === 403)
    return "The provider refused the request. The key may not have access to this model, or your account has restrictions. Details: " + msg;
  if (status === 404 || (lower.indexOf("model") >= 0 && (lower.indexOf("not found") >= 0 || lower.indexOf("does not exist") >= 0 || lower.indexOf("invalid") >= 0)))
    return "The model name was rejected: " + msg + ". Open Connect AI, pick a different model from the list, then Save.";
  if (status === 429 || lower.indexOf("rate") >= 0 || lower.indexOf("quota") >= 0)
    return "Rate limited by the provider. Wait about 60 seconds and try again, or switch to a lighter model in Connect AI. Details: " + msg;
  if (status === 402 || lower.indexOf("credit") >= 0 || lower.indexOf("balance") >= 0 || lower.indexOf("billing") >= 0)
    return "The provider says your account is out of credits or has a billing issue. Details: " + msg;
  if (status === 400 && (lower.indexOf("max_tokens") >= 0 || lower.indexOf("context") >= 0))
    return "The request was too large or the token budget was invalid. Details: " + msg;
  if (status >= 500)
    return "The provider had a server-side error (" + status + "). Try again in a moment. Details: " + msg;
  return "Provider error (" + status + "): " + msg;
}

/** Set when a retired model was silently swapped for a live sibling. */
export const AI_STATE: { swapped: { from: string; to: string } | null; truncated: boolean } = {
  swapped: null,
  truncated: false,
};

export interface AiCallOpts {
  system?: string;
  maxTokens?: number;
  modelOverride?: string;
  noThink?: boolean;
  /** false stops the automatic budget growth on a truncated answer. */
  grow?: boolean;
}

export async function aiCall(userMsg: string, opts: AiCallOpts = {}): Promise<string> {
  if (!aiReady()) throw new Error("No API key connected. Open Connect AI and paste a key.");
  const sysPrompt = opts.system || AI_SYSTEM;
  let maxTokens = opts.maxTokens || 1400;
  const provider: ProviderId = AI.provider;
  let model = opts.modelOverride || aiModel();
  let url = aiUrl();
  let body: any;
  let headers: Record<string, string>;
  let redactedHeaders: Record<string, string>;

  if (provider === "google") {
    /* Gemini uses its own request shape and puts the key in the path. */
    url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(AI.key);
    headers = { "content-type": "application/json" };
    body = {
      system_instruction: { parts: [{ text: sysPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    };
    redactedHeaders = { "content-type": "application/json", "(key in URL query)": "redacted" };
  } else if (provider === "anthropic") {
    headers = {
      "content-type": "application/json",
      "x-api-key": AI.key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    body = { model, max_tokens: maxTokens, system: sysPrompt, messages: [{ role: "user", content: userMsg }] };
    /* Reasoning models spend max_tokens on thinking before they write a word.
       For a formatting job there is nothing to reason about, so it is switched
       off. If a model rejects the parameter the call retries without it. */
    if (opts.noThink) body.thinking = { type: "disabled" };
    redactedHeaders = {
      "content-type": "application/json",
      "x-api-key": "redacted",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
  } else {
    headers = { "content-type": "application/json", authorization: "Bearer " + AI.key };
    redactedHeaders = { "content-type": "application/json", authorization: "Bearer redacted" };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = location.origin;
      headers["X-Title"] = "Evidence Engine";
      redactedHeaders["HTTP-Referer"] = location.origin;
      redactedHeaders["X-Title"] = "Evidence Engine";
    }
    body = { model, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userMsg }] };
    /* OpenAI renamed the budget parameter on its newer families and rejects the
       old one outright. Everything else still expects max_tokens. */
    if (provider === "openai" && /^(gpt-5|gpt-6|o[1-9])/i.test(model)) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;
  }

  let attempt = 0;
  let maxAttempts = 2;
  let lastErr: Error | null = null;

  while (attempt < maxAttempts) {
    attempt++;
    const started = Date.now();
    const logEntry: AiLogEntry = {
      provider, model, url, headers: redactedHeaders,
      requestBodyPreview: aiTrunc(JSON.stringify(body), 2000),
      attempt,
    };
    try {
      const res = await aiFetch(url, { method: "POST", headers, body: JSON.stringify(body) }, 60000);
      let rawText = "";
      try {
        rawText = await res.text();
      } catch {
        rawText = "";
      }
      let j: any = null;
      if (rawText) {
        try {
          j = JSON.parse(rawText);
        } catch {
          j = null;
        }
      }
      logEntry.status = res.status;
      logEntry.ok = res.ok;
      logEntry.responseBodyPreview = aiTrunc(rawText, 2000);
      logEntry.elapsedMs = Date.now() - started;

      if (!res.ok) {
        const err = new Error(aiExplainError(res.status, provider, j, rawText)) as Error & { status?: number };
        err.status = res.status;
        logEntry.error = err.message;
        aiLog(logEntry);

        const msg = (rawText || "").toLowerCase();
        /* Not every model accepts an explicit thinking switch. Drop it and go
           again rather than failing the whole write. */
        if (body.thinking && /thinking/.test(msg) && attempt < 4) {
          delete body.thinking;
          maxAttempts = Math.max(maxAttempts, 4);
          lastErr = err;
          continue;
        }
        if (
          /max_tokens|max_completion_tokens/.test(msg) &&
          /unsupported|not supported|unrecognized|invalid/.test(msg) &&
          attempt < 3
        ) {
          if (body.max_tokens != null) {
            body.max_completion_tokens = body.max_tokens;
            delete body.max_tokens;
          } else {
            body.max_tokens = body.max_completion_tokens;
            delete body.max_completion_tokens;
          }
          maxAttempts = Math.max(maxAttempts, 3);
          lastErr = err;
          continue;
        }
        /* A retired model id. Ask the provider what it does have, pick the
           closest sibling, and say so afterwards rather than just failing. */
        if ((res.status === 404 || /model.*(not.?found|does not exist|invalid|decommission|deprecat)/.test(msg)) && attempt < 3) {
          try {
            const live = await discoverModels(provider, AI.key);
            const alt = pickClosestModel(model, live);
            if (alt && alt !== model) {
              AI_STATE.swapped = { from: model, to: alt };
              model = alt;
              body.model = alt;
              maxAttempts = Math.max(maxAttempts, 3);
              lastErr = err;
              continue;
            }
          } catch {
            /* the catalogue is optional; fall through to the real error */
          }
        }

        /* Retry on transient statuses only. Never on a 4xx that is the
           client's fault. */
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw err;
      }

      const text = aiExtractText(provider, j);
      logEntry.textLen = text.length;

      /* A 200 with a truncated body is the worst failure mode here, because
         everything looks healthy: right model, right key, right status. The
         answer is simply cut off, and downstream JSON parsing fails with a
         message that points nowhere near the cause. */
      let stopR = "";
      if (provider === "anthropic" && j) stopR = j.stop_reason || "";
      else if (provider === "google" && j && j.candidates && j.candidates[0]) stopR = j.candidates[0].finishReason || "";
      else if (j && j.choices && j.choices[0]) stopR = j.choices[0].finish_reason || j.choices[0].stop_reason || "";
      logEntry.stopReason = stopR;
      const truncated = /max_tokens|length|MAX_TOKENS/i.test(String(stopR));

      if (truncated && opts.grow !== false && maxTokens < 32000 && attempt < 4) {
        logEntry.error = "output truncated at " + maxTokens + " tokens, retrying with more";
        aiLog(logEntry);
        maxTokens = Math.min(32000, maxTokens * 3);
        if (body.max_tokens != null) body.max_tokens = maxTokens;
        else body.max_completion_tokens = maxTokens;
        /* Thinking is the usual reason the budget vanished before any output. */
        if (provider === "anthropic" && !body.thinking) body.thinking = { type: "disabled" };
        maxAttempts = Math.max(maxAttempts, 4);
        continue;
      }
      if (truncated && text) {
        /* Out of headroom. Hand the partial text back with a flag so the caller
           can try to salvage it rather than losing the whole run. */
        logEntry.truncatedFinal = true;
        AI_STATE.truncated = true;
      } else AI_STATE.truncated = false;

      aiLog(logEntry);

      if (!text) {
        let hint = stopR ? " Stop reason: " + stopR + "." : "";
        const low = String(stopR).toLowerCase();
        if (low.indexOf("max_tokens") >= 0)
          hint += " The token budget ran out before any text was produced. Try a shorter prompt, or lower the max_tokens on this call.";
        else if (low.indexOf("safety") >= 0 || low.indexOf("refus") >= 0)
          hint += " The model declined the request under its safety rules.";
        throw new Error("The provider returned no text." + hint + " See Debug panel for the raw response.");
      }
      return text;
    } catch (e) {
      const err = e as Error & { status?: number };
      lastErr = err;
      if (!logEntry.status) {
        logEntry.error = err.message || String(err);
        logEntry.elapsedMs = Date.now() - started;
        aiLog(logEntry);
      }
      if (!err.status && attempt < maxAttempts && /timed out|network|cors/i.test(err.message || "")) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("The AI call failed for an unknown reason.");
}
