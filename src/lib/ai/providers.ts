/* =========================================================================
   BRING YOUR OWN MODEL
   The key lives in this browser and is sent only to the provider the user
   picked. There is no server in this product to send it to.

   The model lists below are a FALLBACK ONLY, used before the live list arrives
   and when a provider's catalogue endpoint is unreachable.

   Hardcoding model names was the bug behind "the AI just fails". Providers
   retire model IDs on a scale of weeks, the call comes back 404
   model_not_found, and to the user that is indistinguishable from the feature
   being broken. So every provider now publishes its own list and we read it.
   `modelsUrl` is that endpoint. See discoverModels().
   ========================================================================= */
import type { ProviderDef, ProviderId } from "@/types";

export const AI_DEFAULTS: Record<ProviderId, ProviderDef> = {
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    modelsNoKey: true,
    keys: "https://openrouter.ai/keys",
    colour: "#6467F2",
    initials: "OR",
    note: "One key, every major model.",
    models: [
      ["anthropic/claude-sonnet-5", "Claude Sonnet 5, balanced"],
      ["anthropic/claude-opus-5", "Claude Opus 5, strongest"],
      ["anthropic/claude-haiku-4.5", "Claude Haiku 4.5, fast and cheap"],
      ["openai/gpt-5.6-terra", "GPT-5.6 Terra"],
      ["openai/gpt-5.6-luna", "GPT-5.6 Luna, cheap"],
      ["google/gemini-3.6-flash", "Gemini 3.6 Flash"],
      ["deepseek/deepseek-v4-flash", "DeepSeek v4 Flash, very cheap"],
      ["x-ai/grok-4.5", "Grok 4.5"],
    ],
  },
  anthropic: {
    label: "Anthropic",
    url: "https://api.anthropic.com/v1/messages",
    modelsUrl: "https://api.anthropic.com/v1/models",
    keys: "https://console.anthropic.com/settings/keys",
    colour: "#C4331A",
    initials: "A",
    note: "Claude, direct.",
    models: [
      ["claude-sonnet-5", "Claude Sonnet 5, balanced"],
      ["claude-opus-5", "Claude Opus 5, strongest"],
      ["claude-haiku-4-5-20251001", "Claude Haiku 4.5, fast and cheap"],
    ],
  },
  openai: {
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    modelsUrl: "https://api.openai.com/v1/models",
    keys: "https://platform.openai.com/api-keys",
    colour: "#10A37F",
    initials: "AI",
    note: "GPT, direct.",
    models: [
      ["gpt-5.6-terra", "GPT-5.6 Terra, balanced"],
      ["gpt-5.6-luna", "GPT-5.6 Luna, cheap"],
      ["gpt-5.6-sol", "GPT-5.6 Sol, strongest"],
    ],
  },
  google: {
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    keys: "https://aistudio.google.com/apikey",
    colour: "#3D5A80",
    initials: "G",
    note: "Gemini, free tier available.",
    models: [
      ["gemini-3.6-flash", "Gemini 3.6 Flash"],
      ["gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite, cheapest"],
    ],
  },
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    keys: "https://console.groq.com/keys",
    colour: "#A0670F",
    initials: "GQ",
    note: "Very fast, free tier.",
    models: [
      ["llama-3.3-70b-versatile", "Llama 3.3 70B, free tier"],
      ["llama-3.1-8b-instant", "Llama 3.1 8B, fastest"],
    ],
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    modelsUrl: "https://api.deepseek.com/models",
    keys: "https://platform.deepseek.com/api_keys",
    colour: "#1E6F4E",
    initials: "DS",
    note: "Low cost.",
    models: [["deepseek-chat", "DeepSeek Chat"], ["deepseek-reasoner", "DeepSeek Reasoner"]],
  },
  mistral: {
    label: "Mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    modelsUrl: "https://api.mistral.ai/v1/models",
    keys: "https://console.mistral.ai/api-keys",
    colour: "#B03A22",
    initials: "M",
    note: "European, EU hosted.",
    models: [["mistral-large-latest", "Mistral Large"], ["mistral-small-latest", "Mistral Small, cheap"]],
  },
  xai: {
    label: "xAI Grok",
    url: "https://api.x.ai/v1/chat/completions",
    modelsUrl: "https://api.x.ai/v1/models",
    keys: "https://console.x.ai/",
    colour: "#3A342C",
    initials: "X",
    note: "Grok, direct.",
    models: [["grok-4.5", "Grok 4.5"], ["grok-4.3", "Grok 4.3"]],
  },
  together: {
    label: "Together AI",
    url: "https://api.together.xyz/v1/chat/completions",
    modelsUrl: "https://api.together.xyz/v1/models",
    keys: "https://api.together.ai/settings/api-keys",
    colour: "#4A4238",
    initials: "T",
    note: "Open models.",
    models: [
      ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B Turbo"],
      ["Qwen/Qwen2.5-72B-Instruct-Turbo", "Qwen 2.5 72B"],
    ],
  },
  custom: {
    label: "Other",
    url: "",
    keys: "",
    colour: "#6E6E72",
    initials: "?",
    note: "Any OpenAI-compatible endpoint.",
    models: [],
  },
};

/* Each provider's default model is simply the first entry in its fallback list. */
(Object.keys(AI_DEFAULTS) as ProviderId[]).forEach((k) => {
  const d = AI_DEFAULTS[k];
  d.model = (d.models[0] && d.models[0][0]) || "";
});

export const PROVIDER_ORDER: ProviderId[] = [
  "openrouter", "anthropic", "openai", "google", "groq", "deepseek", "mistral", "xai",
];

/**
 * Nobody should have to know which provider their key belongs to. Every vendor
 * uses a distinct prefix, so paste anything and the provider and model are set
 * for you. This is the realistic answer to "signing up for a key is confusing":
 * real single sign-on does not exist for these vendors, but the guesswork can.
 */
export const KEY_SHAPES: [RegExp, ProviderId][] = [
  [/^sk-or-/i, "openrouter"],
  [/^sk-ant-/i, "anthropic"],
  [/^gsk_/, "groq"],
  [/^AIza[0-9A-Za-z_-]{30,}/, "google"],
  [/^xai-/i, "xai"],
  [/^sk-proj-|^sk-svcacct-/i, "openai"],
  [/^r8_/, "custom"],
  [/^sk-[0-9a-f]{32}$/i, "deepseek"],
  [/^sk-/i, "openai"],
];

export function providerFromKey(v: string): ProviderId | null {
  if (!v || v.length < 12) return null;
  for (let i = 0; i < KEY_SHAPES.length; i++) if (KEY_SHAPES[i][0].test(v)) return KEY_SHAPES[i][1];
  return null;
}
