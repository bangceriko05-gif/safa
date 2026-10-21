/// <reference types="bun" />
import { expect, test } from "bun:test";
import { mapPosReportItems, type PosReportOrder } from "./posReportItems";

const order: PosReportOrder = {
  id: "oak-order", bid: "BO-OAK-1", date: "2026-10-21", customer_name: "Tamu",
  payment_method: "Cash", payment_proof_urls: ["proof.jpg"], process_status: "selesai",
  booking_order_items: [{ id: "item-1", product_id: "product-1", product_name: "Americano", quantity: 2, subtotal: 50000 }],
};

test("POS sales retain BID, item amounts and HPP without an embedded product relation", () => {
  const [item] = mapPosReportItems([order], new Map([["product-1", 8000]]));
  expect(item).toMatchObject({ bid: "BO-OAK-1", order_id: "oak-order", product_name: "Americano", quantity: 2, subtotal: 50000, purchase_price: 8000, proof_url: "proof.jpg" });
});

test("missing or deleted products do not hide persisted POS sales", () => {
  const items = mapPosReportItems([order, { ...order, id: "deleted-product-order", booking_order_items: [{ ...order.booking_order_items[0], product_id: null }] }], new Map());
  expect(items).toHaveLength(2);
  expect(items.map(item => item.subtotal)).toEqual([50000, 50000]);
  expect(items.map(item => item.purchase_price)).toEqual([0, 0]);
});

test("cancelled POS orders remain excluded", () => {
  expect(mapPosReportItems([{ ...order, process_status: "batal" }], new Map())).toEqual([]);
});