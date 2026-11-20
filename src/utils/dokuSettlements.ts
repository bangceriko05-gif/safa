import { matchesDokuTransactionSearch, type DokuTransaction } from "@/utils/dokuTransactions";

export interface DokuSettlementBatch {
  dateKey: string;
  totalAmount: number;
  transactions: DokuTransaction[];
}

/** Kelompokkan pembayaran berhasil berdasarkan tanggal uang masuk WIB, bukan tanggal invoice. */
export function dokuSettlementDateKey(value: string) {
  const normalized = value
    .replace(/\.(\d{3})\d+(?=Z|[+-]\d{2}(?::?\d{2})?$)/, ".$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(normalized));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function successfulDokuTransactions(rows: DokuTransaction[], query: string) {
  return rows.filter(row => row.status === "success" && !!row.paid_at && matchesDokuTransactionSearch(row, query));
}

export function buildDokuSettlementBatches(rows: DokuTransaction[]): DokuSettlementBatch[] {
  const batches = new Map<string, DokuTransaction[]>();
  for (const row of rows) {
    if (row.status !== "success" || !row.paid_at) continue;
    const dateKey = dokuSettlementDateKey(row.paid_at);
    batches.set(dateKey, [...(batches.get(dateKey) || []), row]);
  }
  return Array.from(batches, ([dateKey, transactions]) => ({
    dateKey,
    transactions: [...transactions].sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at))),
    totalAmount: transactions.reduce((total, row) => total + Number(row.amount), 0),
  })).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
