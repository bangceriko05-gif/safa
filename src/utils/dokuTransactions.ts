export interface DokuTransaction {
  id: string;
  source: "POS" | "Booking";
  outlet: string;
  bid: string;
  invoice_number: string;
  amount: number;
  status: string;
  channel: string | null;
  environment: string;
  created_at: string;
  paid_at: string | null;
}

export function dokuTransactionMethod(row: Pick<DokuTransaction, "channel">) {
  return row.channel?.trim() || "QRIS";
}

export function formatDokuPaidAt(value: string | null) {
  return value ? `${formatDokuTransactionTime(value)} WIB` : "-";
}

export function matchesDokuTransactionSearch(row: Pick<DokuTransaction, "outlet" | "bid" | "invoice_number">, query: string) {
  const needle = query.trim().toLowerCase();
  return !needle || [row.outlet, row.bid, row.invoice_number].some(value => value.toLowerCase().includes(needle));
}

/** Waktu selalu ditampilkan dalam zona referensi DOKU, bukan zona perangkat pengguna. */
export function formatDokuTransactionTime(value: string) {
  // PostgreSQL dapat mengirim mikrodetik; Date JavaScript hanya menerima milidetik.
  const normalized = value
    .replace(/\.(\d{3})\d+(?=Z|[+-]\d{2}(?::?\d{2})?$)/, ".$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(normalized));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || "";
  return `${part("day")} ${part("month")} ${part("year")} ${part("hour")}:${part("minute")}`;
}
