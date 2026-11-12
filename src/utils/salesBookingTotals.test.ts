import { expect, test } from "bun:test";
import { salesBookingPayments, salesBookingTotals } from "./salesBookingTotals";

test("SAFA October received sales remain Rp41.715.558 despite Rp160.000 discount", () => {
  const booking = { price: 41_715_558, price_2: 0, dual_payment: false, duration: 1,
    discount_type: "fixed", discount_value: 160_000, discount_applies_to: "variant" };
  const overview = salesBookingPayments(booking, 550_000);
  const details = salesBookingTotals(booking, 550_000);
  expect(details.discount).toBe(160_000);
  expect(overview.paid).toBe(41_715_558);
  expect(details.paid).toBe(41_715_558);
  expect(overview.roomPaid).toBe(41_165_558);
  expect(overview.roomPaid + overview.productPaid).toBe(details.paid);
});

test("received Rp900.000 is not reduced again by Rp220.000 discount", () => {
  const booking = { price: 900_000, price_2: 0, duration: 1, variant_price_override: 1_120_000,
    discount_type: "fixed", discount_value: 220_000, discount_applies_to: "variant" };
  expect(salesBookingTotals(booking).paid).toBe(900_000);
  expect(salesBookingPayments(booking).roomPaid).toBe(900_000);
});

test("second payments follow the same enabled-slot rule in overview and details", () => {
  const booking = { price: 100_000, price_2: 40_000, duration: 1,
    discount_type: null, discount_value: null, discount_applies_to: null };
  expect(salesBookingPayments({ ...booking, dual_payment: true }).paid).toBe(140_000);
  expect(salesBookingTotals({ ...booking, dual_payment: true }).paid).toBe(140_000);
  expect(salesBookingPayments({ ...booking, dual_payment: false }).paid).toBe(100_000);
  expect(salesBookingTotals({ ...booking, dual_payment: false }).paid).toBe(100_000);
});