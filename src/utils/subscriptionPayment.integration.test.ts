import { expect, test } from "bun:test";

const url = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const session = JSON.parse(process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON || "{}");
const authenticatedTest = url && apiKey && session.access_token ? test : test.skip;

async function request(path: string, authenticated: boolean, method = "GET", body?: object) {
  if (!url || !apiKey || (authenticated && !session.access_token)) throw new Error("Test session unavailable");
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...(authenticated ? { Authorization: `Bearer ${session.access_token}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("anonymous users cannot read subscription payment history", async () => {
  if (!url || !apiKey) return;
  const response = await request("subscription_payments?select=id&limit=1", false);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

authenticatedTest("Super Admin can record, read, and remove a subscription payment", async () => {
  let paymentId: string | null = null;
  try {
    const inserted = await request("subscription_payments", true, "POST", {
      store_id: "777a84a5-2439-42c6-a80d-e56edcb41b22",
      feature_key: "pms",
      feature_name: "Uji Langganan",
      amount: 1,
      status: "paid",
      payment_method: "Transfer Bank",
      paid_at: new Date().toISOString(),
    });
    expect(inserted.status).toBe(201);
    const [payment] = await inserted.json();
    paymentId = payment.id;

    const read = await request(`subscription_payments?id=eq.${paymentId}&select=id,feature_name,amount`, true);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual([{ id: paymentId, feature_name: "Uji Langganan", amount: 1 }]);
  } finally {
    if (paymentId) {
      const removed = await request(`subscription_payments?id=eq.${paymentId}`, true, "DELETE");
      expect([200, 204]).toContain(removed.status);
    }
  }
});
