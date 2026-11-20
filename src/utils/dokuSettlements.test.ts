import { describe, expect, test } from "bun:test";
import { buildDokuSettlementBatches, dokuSettlementDateKey, successfulDokuTransactions } from "./dokuSettlements";
import type { DokuTransaction } from "./dokuTransactions";

const row = (overrides: Partial<DokuTransaction>): DokuTransaction => ({
  id: "attempt-1",
  source: "Booking",
  outlet: "SAFA Kost and Guest House",
  bid: "BO-STR-20261118-001",
  invoice_number: "ANKA-invoice-1",
  amount: 200_000,
  status: "success",
  channel: "QRIS",
  environment: "live",
  created_at: "2026-11-18T13:00:00Z",
  paid_at: "2026-11-18T14:06:37Z",
  transaction_at: "2026-11-18T14:06:37Z",
  ...overrides,
});

describe("laporan Settlement DOKU", () => {
  test("hanya pembayaran success dengan paid_at yang masuk ringkasan", () => {
    const rows = [
      row({ id: "success", amount: 200_000 }),
      row({ id: "pending", status: "pending", amount: 90_000 }),
      row({ id: "missing-paid-at", paid_at: null, amount: 50_000 }),
    ];
    expect(successfulDokuTransactions(rows, "").map(item => item.id)).toEqual(["success"]);
    expect(buildDokuSettlementBatches(rows)).toHaveLength(1);
    expect(buildDokuSettlementBatches(rows)[0].totalAmount).toBe(200_000);
  });

  test("batch memakai tanggal uang masuk WIB dan menjumlahkan transaksi pada hari yang sama", () => {
    const lateNight = row({ id: "late", paid_at: "2026-11-18T16:59:59Z", amount: 1 });
    const nextDay = row({ id: "next", paid_at: "2026-11-18T17:00:00Z", amount: 2 });
    expect(dokuSettlementDateKey(lateNight.paid_at!)).toBe("2026-11-18");
    expect(dokuSettlementDateKey(nextDay.paid_at!)).toBe("2026-11-19");
    const batches = buildDokuSettlementBatches([lateNight, nextDay, row({ id: "same-day", amount: 199_999 })]);
    expect(batches.map(batch => [batch.dateKey, batch.totalAmount, batch.transactions.length])).toEqual([
      ["2026-11-19", 2, 1],
      ["2026-11-18", 200_000, 2],
    ]);
  });
});
