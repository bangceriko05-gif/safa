import { describe, expect, it } from "bun:test";
import { dokuDashboardTime, needsDokuReconciliation, dokuTransactionMethod, formatDokuPaidAt, formatDokuTransactionTime, matchesDokuTransactionSearch } from "./dokuTransactions";

const row = { outlet: "SAFA Kost and Guest House", bid: "FBSTR20261108001", invoice_number: "ANKA-123" };

describe("daftar transaksi DOKU", () => {
  it("mencari berdasarkan BID, invoice, dan outlet", () => {
    expect(matchesDokuTransactionSearch(row, "20261108001")).toBe(true);
    expect(matchesDokuTransactionSearch(row, "anka-123")).toBe(true);
    expect(matchesDokuTransactionSearch(row, "safa kost")).toBe(true);
    expect(matchesDokuTransactionSearch(row, "oak lawang")).toBe(false);
  });

  it("menampilkan QRIS untuk tagihan QR yang channel-nya belum dikirim DOKU", () => {
    expect(dokuTransactionMethod({ channel: null })).toBe("QRIS");
    expect(dokuTransactionMethod({ channel: "VIRTUAL_ACCOUNT_BCA" })).toBe("VIRTUAL_ACCOUNT_BCA");
  });

  it("menampilkan waktu GMT+7 secara konsisten", () => {
    expect(formatDokuTransactionTime("2026-11-08T06:24:00.000Z")).toBe("08 Nov 2026 13:24:00");
  });

  it("memakai waktu uang diterima, bukan waktu invoice dibuat", () => {
    expect(formatDokuPaidAt("2026-11-09T01:36:00.841374+00")).toBe("09 Nov 2026 08:36:00 WIB");
    expect(formatDokuPaidAt(null)).toBe("-");
  });

  it("mencocokkan ulang invoice expired atau failed, bukan hanya pending", () => {
    expect(needsDokuReconciliation({ status: "expired", transaction_at: null })).toBe(true);
    expect(needsDokuReconciliation({ status: "failed", transaction_at: null })).toBe(true);
    expect(needsDokuReconciliation({ status: "success", transaction_at: null })).toBe(true);
    expect(needsDokuReconciliation({ status: "success", transaction_at: "2026-11-18T14:06:37Z" })).toBe(false);
  });

  it("mengutamakan waktu DOKU 21:06:37 daripada invoice lokal 21:04", () => {
    const value = dokuDashboardTime({ created_at: "2026-11-18T14:04:17.489717+00", paid_at: "2026-11-19T02:00:00Z", transaction_at: "2026-11-18T14:06:37Z" });
    expect(formatDokuTransactionTime(value)).toBe("18 Nov 2026 21:06:37");
  });
});
