import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sessionPath = process.env.TEST_SETTINGS_SESSION_FILE;
const authenticatedTest = sessionPath ? test : test.skip;

async function request(path: string, body?: object) {
  if (!sessionPath) throw new Error("Test session unavailable");
  const { session } = JSON.parse(readFileSync(sessionPath, "utf8"));
  const url = process.env.VITE_SUPABASE_URL;
  const apikey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apikey) throw new Error("Test configuration unavailable");
  return fetch(`${url}/rest/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { apikey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

authenticatedTest("delegated User cannot change PPN without PPN permission", async () => {
  const response = await request("rpc/save_delegated_store_settings", {
    p_store_id: "777a84a5-2439-42c6-a80d-e56edcb41b22", p_section: "tax", p_values: {},
  });
  expect(response.ok).toBe(false);
});

authenticatedTest("Nota permission cannot access another outlet's receipt settings", async () => {
  const response = await request("print_settings?select=store_id&store_id=neq.777a84a5-2439-42c6-a80d-e56edcb41b22");
  expect(response.ok).toBe(true);
  expect(await response.json()).toEqual([]);
});
