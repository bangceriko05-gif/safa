import { createClient } from "npm:@supabase/supabase-js@2";

export function dokuAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function encryptionKey() {
  const raw = Deno.env.get("DOKU_CREDENTIAL_ENCRYPTION_KEY");
  if (!raw) throw new Error("Encryption unavailable");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptDokuSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(secret)));
  const bytes = new Uint8Array(iv.length + encrypted.length);
  bytes.set(iv); bytes.set(encrypted, iv.length);
  return btoa(String.fromCharCode(...bytes));
}

export async function dokuCredentials(storeId: string, environment: string) {
  const { data, error } = await dokuAdmin().from("doku_outlet_credentials").select("client_id,secret_ciphertext").eq("store_id", storeId).eq("environment", environment).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const bytes = Uint8Array.from(atob(data.secret_ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, await encryptionKey(), bytes.subarray(12));
  return { clientId: data.client_id, secret: new TextDecoder().decode(decrypted), environment };
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