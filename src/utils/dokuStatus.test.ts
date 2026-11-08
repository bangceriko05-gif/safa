import { describe, expect, it } from "bun:test";
import { isMatchingDokuPayment, parseDokuRemotePayment } from "../../supabase/functions/_shared/dokuStatus";

describe("validasi status pembayaran DOKU", () => {
  it("membaca pembayaran QRIS sukses dengan nominal berupa string", () => {
    const payment = parseDokuRemotePayment({ order: { invoice_number: "ANKA-123", amount: "1" }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS_DOKU" } });
    expect(payment).toEqual({ invoiceNumber: "ANKA-123", amount: 1, status: "SUCCESS", channel: "QRIS_DOKU" });
  });

  it("hanya menerima invoice dan nominal yang sama persis", () => {
    const payment = parseDokuRemotePayment({ order: { invoice_number: "ANKA-123", amount: 1 }, transaction: { status: "SUCCESS" } });
    expect(payment && isMatchingDokuPayment(payment, "ANKA-123", 1)).toBe(true);
    expect(payment && isMatchingDokuPayment(payment, "ANKA-LAIN", 1)).toBe(false);
    expect(payment && isMatchingDokuPayment(payment, "ANKA-123", 140000)).toBe(false);
  });

  it("menolak respons tanpa status transaksi atau nominal yang valid", () => {
    expect(parseDokuRemotePayment({ order: { invoice_number: "ANKA-123", amount: 1, status: "SUCCESS" } })).toBeNull();
    expect(parseDokuRemotePayment({ order: { invoice_number: "ANKA-123", amount: -1 }, transaction: { status: "SUCCESS" } })).toBeNull();
  });
});
