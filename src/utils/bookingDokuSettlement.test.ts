import { describe, expect, it } from "bun:test";
import { matchesBookingDokuSettlement } from "./bookingDokuSettlement";

const expected = { bookingId: "booking-012", storeId: "safa", invoiceNumber: "ANKA-e851551c-c778-4e72-9520-e524132d6892", amount: 1 };
const attempt = { booking_id: expected.bookingId, store_id: expected.storeId, invoice_number: expected.invoiceNumber, amount: 1, status: "success" };
const owner = { id: expected.bookingId, store_id: expected.storeId, reference_no: expected.invoiceNumber, price: 1 };
describe("pelunasan QRIS booking", () => {
  it("menggunakan invoice DOKU yang tersimpan sebagai No. Reff", () => {
    expect(matchesBookingDokuSettlement(expected, attempt, owner)).toBe(true);
    expect(matchesBookingDokuSettlement(expected, attempt, { ...owner, reference_no: "acak" })).toBe(false);
  });
  it("menolak invoice berbeda", () => {
    expect(matchesBookingDokuSettlement(expected, { ...attempt, invoice_number: "ANKA-lain" }, owner)).toBe(false);
  });
  it("menolak nominal berbeda pada attempt maupun booking", () => {
    expect(matchesBookingDokuSettlement(expected, { ...attempt, amount: 2 }, owner)).toBe(false);
    expect(matchesBookingDokuSettlement(expected, attempt, { ...owner, price: 2 })).toBe(false);
  });
  it("menolak BID booking atau outlet lain", () => {
    expect(matchesBookingDokuSettlement(expected, { ...attempt, booking_id: "booking-lain" }, owner)).toBe(false);
    expect(matchesBookingDokuSettlement(expected, { ...attempt, store_id: "oak" }, owner)).toBe(false);
  });
  it("tidak menyelesaikan pembayaran yang belum diterima", () => {
    expect(matchesBookingDokuSettlement(expected, { ...attempt, status: "pending" }, owner)).toBe(false);
    expect(matchesBookingDokuSettlement(expected, null, owner)).toBe(false);
  });
});