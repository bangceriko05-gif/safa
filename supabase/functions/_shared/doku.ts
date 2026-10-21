import { createClient } from "npm:@supabase/supabase-js@2";

export function dokuAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function dokuCredentials() {
  const clientId = Deno.env.get("DOKU_CLIENT_ID")?.trim();
  const secret = Deno.env.get("DOKU_SECRET_KEY")?.trim();
  const environment = Deno.env.get("DOKU_ENVIRONMENT")?.trim();
  if (!clientId || !secret || !["sandbox", "live"].includes(environment || "")) return null;
  return { clientId, secret, environment };
}

const base64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
export async function dokuSignature(secret: string, clientId: string, requestId: string, timestamp: string, target: string, body: string) {
  const digest = base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const components = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}\nDigest:${digest}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `HMACSHA256=${base64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(components)))}`;
}

export function signaturesEqual(expected: string, actual: string) {
  let mismatch = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
  return mismatch === 0;
}