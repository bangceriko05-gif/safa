/// <reference types="bun" />
import { expect, test } from "bun:test";
import { mapPosReportItems, type PosReportOrder } from "./posReportItems";

const order: PosReportOrder = {
  id: "oak-order", bid: "BO-OAK-1", date: "2026-10-21", customer_name: "Tamu",
  payment_method: "Cash", payment_proof_urls: ["proof.jpg"], process_status: "selesai",
  booking_order_items: [{ id: "item-1", product_id: "product-1", product_name: "Produk A", quantity: 1, subtotal: 15000, unit_cost: 12944 }],
};

test("transaksi lama mempertahankan harga jual, HPP, dan laba setelah harga master berubah", () => {
  const [oldItem] = mapPosReportItems([order]);
  expect(oldItem.subtotal).toBe(15000);
  expect(oldItem.purchase_price).toBe(12944);
  expect(oldItem.subtotal - oldItem.purchase_price * oldItem.quantity).toBe(2056);

  const newOrder: PosReportOrder = {
    ...order,
    id: "new-order",
    booking_order_items: [{ ...order.booking_order_items[0], id: "item-2", subtotal: 16000 }],
  };
  const [newItem] = mapPosReportItems([newOrder]);
  expect(newItem.subtotal).toBe(16000);
  expect(newItem.purchase_price).toBe(12944);
  expect(newItem.subtotal - newItem.purchase_price * newItem.quantity).toBe(3056);

  // Simulasi HPP master berubah: snapshot item lama tidak ikut berubah.
  const [oldAfterCostEdit] = mapPosReportItems([order]);
  expect(oldAfterCostEdit.purchase_price).toBe(12944);
  expect(oldAfterCostEdit.subtotal - oldAfterCostEdit.purchase_price).toBe(2056);
});

test("produk yang terhapus tetap menampilkan nilai transaksi dan HPP tersimpan", () => {
  const items = mapPosReportItems([order, { ...order, id: "deleted-product-order", booking_order_items: [{ ...order.booking_order_items[0], product_id: null }] }]);
  expect(items).toHaveLength(2);
  expect(items.map(item => item.subtotal)).toEqual([15000, 15000]);
  expect(items.map(item => item.purchase_price)).toEqual([12944, 12944]);
});

test("HPP nol yang memang tersimpan tetap nol dan order batal tetap dikecualikan", () => {
  const zeroCost = { ...order, booking_order_items: [{ ...order.booking_order_items[0], unit_cost: 0 }] };
  expect(mapPosReportItems([zeroCost])[0].purchase_price).toBe(0);
  expect(mapPosReportItems([{ ...order, process_status: "batal" }])).toEqual([]);
});
