/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

const url = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const session = JSON.parse(process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON || "{}");

async function request(path: string, authenticated: boolean, method = "GET", body?: object) {
  if (!url || !apiKey || (authenticated && !session.access_token)) throw new Error("Test session unavailable");
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: apiKey, Authorization: `Bearer ${authenticated ? session.access_token : apiKey}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("DOKU credential isolation", () => {
  test("signed-in browsers cannot read encrypted outlet credentials", async () => {
    const response = await request("doku_outlet_credentials?select=store_id&limit=1", true);
    expect(response.status).toBe(403);
  });
  test("anonymous browsers cannot read encrypted outlet credentials", async () => {
    const response = await request("doku_outlet_credentials?select=store_id&limit=1", false);
    expect([401, 403]).toContain(response.status);
  });
  test("legacy secret column is not readable by signed-in browsers", async () => {
    const response = await request("website_payment_settings?select=doku_secret_key&limit=1", true);
    expect(response.status).toBe(403);
  });
  test("browsers cannot bypass outlet authorization through the save RPC", async () => {
    const response = await request("rpc/save_doku_outlet_settings", true, "POST", {
      p_store_id: "00000000-0000-0000-0000-000000000000", p_environment: "sandbox",
      p_client_id: "", p_ciphertext: null, p_enabled: false, p_channels: [],
    });
    expect(response.status).toBe(403);
  });
});