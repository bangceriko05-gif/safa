import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkout = readFileSync(new URL("../../supabase/functions/doku-booking-checkout/index.ts", import.meta.url), "utf8");
const settlement = readFileSync(new URL("../../drizzle/migrations/0019_booking_doku_second_payment.sql", import.meta.url), "utf8");

test("QRIS kedua tidak ditolak hanya karena pembayaran pertama sudah diterima", () => {
  expect(checkout).not.toContain('if (Number(order.price) > 0 || Number(order.price_2) > 0)');
  expect(checkout).toContain('order.payment_method_2 !== "QRIS DOKU"');
});

test("konfirmasi DOKU menambah slot kedua dan menyimpan invoice tanpa mengganti slot pertama", () => {
  expect(settlement).toContain("dual_payment=true,price_2=COALESCE(price_2,0)+p_amount,payment_method_2='QRIS DOKU',reference_no_2=a.invoice_number");
  expect(settlement).toContain("IF a.status='success' THEN RETURN false;");
  expect(settlement).toContain("IF p_amount>remaining THEN RAISE EXCEPTION");
});