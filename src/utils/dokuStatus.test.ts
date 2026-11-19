import { describe, expect, it } from "bun:test";
import { isMatchingDokuPayment, parseDokuRemotePayment, parseDokuTransactionDate } from "../../supabase/functions/_shared/dokuStatus";

describe("validasi status pembayaran DOKU", () => {
  it("membaca pembayaran QRIS sukses dengan nominal berupa string", () => {
    const payment = parseDokuRemotePayment({ order: { invoice_number: "ANKA-123", amount: "1" }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS_DOKU" } });
    expect(payment).toEqual({ invoiceNumber: "ANKA-123", amount: 1, status: "SUCCESS", channel: "QRIS_DOKU", transactionAt: null });
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

  it("memakai tanggal resmi UTC DOKU sampai detik, bukan waktu sinkronisasi", () => {
    const payment = parseDokuRemotePayment({ order: { invoice_number: "ANKA-b024166d-6f97-4de0-b0c9-f1e38cb5a0a7", amount: "200000" }, transaction: { status: "SUCCESS", date: "2026-11-18T14:06:37Z" }, channel: { id: "QRIS" } });
    expect(payment?.status).toBe("SUCCESS");
    expect(payment?.transactionAt).toBe("2026-11-18T14:06:37.000Z");
    expect(payment && isMatchingDokuPayment(payment, "ANKA-b024166d-6f97-4de0-b0c9-f1e38cb5a0a7", 200000)).toBe(true);
    expect(parseDokuTransactionDate("2026-11-18T14:06:37")).toBe("2026-11-18T14:06:37.000Z");
    expect(parseDokuTransactionDate("2026-11-18T21:06:37+07:00")).toBe("2026-11-18T14:06:37.000Z");
    expect(parseDokuTransactionDate("invalid")).toBeNull();
  });
});
