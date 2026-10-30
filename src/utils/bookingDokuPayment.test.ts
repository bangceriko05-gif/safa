import { expect, test } from "bun:test";
import { unpaidBookingQris } from "./bookingDokuPayment";
test("QRIS booking does not record received money before DOKU confirms", () => {
  const payment = unpaidBookingQris(160000, 2, false);
  expect(payment.price).toBe(0);
  expect(payment.price_2).toBeNull();
  expect(payment.payment_status).toBe("belum_lunas");
  expect(payment.payment_proof_url).toBeNull();
});
test("unpaid OTA keeps Rp 2.500.000 room charge over two nights", () => {
  const payment = unpaidBookingQris(2500000, 2, true);
  expect(payment.variant_price_override).toBe(1250000);
  expect(payment.price).toBe(0);
});