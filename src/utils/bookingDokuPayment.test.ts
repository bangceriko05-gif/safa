import { expect, test } from "bun:test";
import { DOKU_METHOD_GROUPS } from "./dokuChannels";
import { bookingPaymentProofMissing, bookingPaymentProofRequired, unpaidBookingQris } from "./bookingDokuPayment";

test("semua metode DOKU dapat menyimpan BID tanpa bukti bayar", () => {
  for (const group of DOKU_METHOD_GROUPS) {
    expect(bookingPaymentProofRequired(group.name, 60000)).toBe(false);
    expect(bookingPaymentProofMissing(group.name, null, 60000)).toBe(false);
  }
});

test("metode pembayaran manual tetap mewajibkan bukti bayar", () => {
  expect(bookingPaymentProofMissing("Cash", null, 1)).toBe(true);
  expect(bookingPaymentProofMissing("Transfer", "", 60000)).toBe(true);
  expect(bookingPaymentProofMissing("Transfer", "https://example.com/bukti.jpg", 60000)).toBe(false);
});
test("booking tanpa pembayaran dapat disimpan tanpa bukti pada setiap slot", () => {
  for (const method of ["Cash", "Transfer Bank", ...DOKU_METHOD_GROUPS.map(group => group.name)]) {
    expect(bookingPaymentProofRequired(method, 0)).toBe(false);
    expect(bookingPaymentProofMissing(method, null, 0)).toBe(false);
  }
});
test("kewajiban bukti pembayaran pertama dan kedua mengikuti nominal masing-masing", () => {
  expect(bookingPaymentProofMissing("Transfer Bank", null, 0)).toBe(false);
  expect(bookingPaymentProofMissing("Cash", null, 60000)).toBe(true);
  expect(bookingPaymentProofMissing("Transfer Bank", null, 60000)).toBe(true);
  expect(bookingPaymentProofMissing("Cash", null, 0)).toBe(false);
});
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