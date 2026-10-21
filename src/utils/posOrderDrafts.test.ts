/// <reference types="bun" />
import { expect, test } from "bun:test";
import { readPosOrderDrafts, savePosOrderDraft, removePosOrderDraft } from "./posOrderDrafts";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

test("new order retains existing selections as a resumable draft", () => {
  const storage = memoryStorage();
  const draft = { id: "pos-draft:1", store_id: "oak", created_at: "2026-10-21", customer_name: "Pelanggan", items: [{ product_name: "Item", quantity: 2, unit_price: 50000, notes: "Catatan" }], amount: 100000 };
  savePosOrderDraft(storage, "oak", "user", draft);
  expect(readPosOrderDrafts(storage, "oak", "user")).toEqual([draft]);
});

test("drafts remain isolated by outlet and cashier", () => {
  const storage = memoryStorage();
  savePosOrderDraft(storage, "oak", "user", { id: "pos-draft:1", store_id: "oak", created_at: "2026-10-21" });
  expect(readPosOrderDrafts(storage, "safa", "user")).toEqual([]);
  expect(readPosOrderDrafts(storage, "oak", "other")).toEqual([]);
});

test("resaving a draft updates it without duplication and checkout removes it", () => {
  const storage = memoryStorage();
  const draft = { id: "pos-draft:1", store_id: "oak", created_at: "2026-10-21", total_amount: 50000 };
  savePosOrderDraft(storage, "oak", "user", draft);
  savePosOrderDraft(storage, "oak", "user", { ...draft, total_amount: 100000 });
  expect(readPosOrderDrafts(storage, "oak", "user").map((entry) => entry.total_amount)).toEqual([100000]);
  removePosOrderDraft(storage, "oak", "user", draft.id);
  expect(readPosOrderDrafts(storage, "oak", "user")).toEqual([]);
});