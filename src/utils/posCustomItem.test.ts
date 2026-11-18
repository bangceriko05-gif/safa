/// <reference types="bun" />
import { expect, test } from "bun:test";
import { createPosCustomItem } from "./posCustomItem";
import { readPosOrderDrafts, savePosOrderDraft } from "./posOrderDrafts";

test("custom name and amount become one order item without a catalog product", () => {
  expect(createPosCustomItem("  Item tambahan  ", 25000)).toEqual({
    product_id: null, product_name: "Item tambahan", quantity: 1, unit_price: 25000, unit_cost: null,
  });
});

test("invalid names and amounts cannot enter an order", () => {
  expect(createPosCustomItem("  ", 25000)).toBeNull();
  for (const amount of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(createPosCustomItem("Item", amount)).toBeNull();
  }
});

test("custom items retain their individual names and prices when a draft is resumed", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const items = [createPosCustomItem("Item A", 25000), createPosCustomItem("Item B", 10000)];
  savePosOrderDraft(storage, "outlet", "cashier", { id: "pos-draft:custom", store_id: "outlet", created_at: "2026-11-18", items });
  expect(readPosOrderDrafts(storage, "outlet", "cashier")[0].items).toEqual(items);
});