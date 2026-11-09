import { describe, expect, it } from "bun:test";
import { dokuTransactionMethod, formatDokuPaidAt, formatDokuTransactionTime, matchesDokuTransactionSearch } from "./dokuTransactions";

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
    expect(formatDokuTransactionTime("2026-11-08T06:24:00.000Z")).toBe("08 Nov 2026 13:24");
  });

  it("memakai waktu uang diterima, bukan waktu invoice dibuat", () => {
    expect(formatDokuPaidAt("2026-11-09T01:36:00.841374+00")).toBe("09 Nov 2026 08:36 WIB");
    expect(formatDokuPaidAt(null)).toBe("-");
  });
});
