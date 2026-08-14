/* =========================================================================
   OPENROUTER SIGN-IN, OAuth 2.0 with PKCE
   This is the only genuine one-click connect available to a site with no
   backend. PKCE exists precisely for public clients that cannot hold a secret,
   so no client registration and no server-side exchange is needed.

   The direct providers do not offer an equivalent. Anthropic's terms bar using
   OAuth tokens from Claude Free, Pro or Max in a third-party product. OpenAI's
   OAuth is not officially supported for this. Google Gemini needs a GCP project
   and a client secret, and a secret cannot live in a static site.
   ========================================================================= */
import { AI, aiSave } from "./client";
import { AI_DEFAULTS } from "./providers";

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  let s = "";
  const a = new Uint8Array(bytes as ArrayBuffer);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier(): string {
  const a = new Uint8Array(48);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function challengeFor(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(d);
}

export async function startOpenRouterSSO(): Promise<void> {
  if (!(window.crypto && crypto.subtle))
    throw new Error("This browser cannot do the secure sign-in handshake. Paste a key instead.");
  const v = randomVerifier();
  sessionStorage.setItem("ee.pkce", v);
  localStorage.setItem("ee.pkce", v); // survives a browser that drops session state on redirect
  const c = await challengeFor(v);
  const cb = location.origin + location.pathname;
  location.href =
    "https://openrouter.ai/auth?callback_url=" +
    encodeURIComponent(cb) +
    "&code_challenge=" +
    encodeURIComponent(c) +
    "&code_challenge_method=S256";
}

export async function finishOpenRouterSSO(code: string): Promise<boolean> {
  const v = sessionStorage.getItem("ee.pkce") || localStorage.getItem("ee.pkce");
  if (!v) throw new Error("The sign-in could not be verified. Start it again from this page.");
  const r = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: v, code_challenge_method: "S256" }),
  });
  const j = await r.json().catch(() => ({}) as any);
  if (!r.ok || !j.key)
    throw new Error((j.error && (j.error.message || j.error)) || "Sign-in failed, HTTP " + r.status);
  sessionStorage.removeItem("ee.pkce");
  localStorage.removeItem("ee.pkce");
  AI.provider = "openrouter";
  AI.key = j.key;
  AI.model = AI.model || AI_DEFAULTS.openrouter.model || "";
  aiSave();
  return true;
}
