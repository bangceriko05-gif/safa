/// <reference types="bun" />
import { expect, test } from "bun:test";
import { format } from "date-fns";
import { bookingReceiptStay } from "./bookingReceiptStay";
import { billingRoomTotal, groupBillingTotals } from "./groupBookingBilling";

const stay = { date: "2026-10-24", duration: 31, start_time: "14:00:00", end_time: "12:00:00" };
test("BO-STR-20261023-032 stays 31 nights, ending 24 November 2026 rather than 31 months later", () => {
  const result = bookingReceiptStay(stay, "pms");
  expect(result.unit).toBe("hari");
  expect(format(result.checkout, "yyyy-MM-dd")).toBe("2026-11-24");
});
test("BO-STR-20261023-032 monthly room remains Rp 1.500.000 and fully paid", () => {
  const room = { id: "monthly", store_id: "safa", room_id: "201", duration: 31, price: 1500000, variant_price_override: 1500000, room_variants: { price: 1500000, variant_name: "Reguler Kos", booking_duration_type: "months", booking_duration_value: 1 } };
  expect(billingRoomTotal(room)).toBe(1500000);
  expect(groupBillingTotals([room]).remaining).toBe(0);
});
test("other daily BIDs retain the per-night multiplication", () => {
  expect(billingRoomTotal({ id: "daily", store_id: "safa", room_id: "101", price: 240000, duration: 2, variant_price_override: 120000, room_variants: { price: 160000, variant_name: "Daily", booking_duration_type: "days", booking_duration_value: 1 } })).toBe(240000);
});
test("OTA overrides a monthly variant with the saved per-night rate", () => {
  expect(billingRoomTotal({ id: "ota", store_id: "safa", room_id: "101", price: 2500000, duration: 2, ota_source: "OTA", variant_price_override: 1250000, room_variants: { price: 1500000, variant_name: "Room", booking_duration_type: "months", booking_duration_value: 1 } })).toBe(2500000);
});
test("hourly schedule bookings retain hours and cross-midnight checkout", () => {
  const result = bookingReceiptStay({ date: "2026-10-24", duration: 2, start_time: "23:00:00", end_time: "01:00:00" }, "schedule");
  expect(result.unit).toBe("jam");
  expect(format(result.checkout, "yyyy-MM-dd HH:mm")).toBe("2026-10-25 01:00");
});