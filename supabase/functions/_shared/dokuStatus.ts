export interface DokuRemotePayment {
  invoiceNumber: string;
  amount: number;
  status: string;
  channel: string | null;
  transactionAt: string | null;
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};

/** DOKU Non-SNAP transaction.date is UTC, including responses without a zone suffix. */
export function parseDokuTransactionDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value)) return null;
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Normalisasi respons Check Status Non-SNAP; amount DOKU dapat berupa angka atau string. */
export function parseDokuRemotePayment(value: unknown): DokuRemotePayment | null {
  const root = record(value);
  const order = record(root.order);
  const transaction = record(root.transaction);
  const channel = record(root.channel);
  const invoiceNumber = typeof order.invoice_number === "string" ? order.invoice_number : "";
  const amount = Number(order.amount);
  const status = typeof transaction.status === "string" ? transaction.status.toUpperCase() : "";
  if (!invoiceNumber || !Number.isSafeInteger(amount) || amount <= 0 || !status) return null;
  return { invoiceNumber, amount, status, channel: typeof channel.id === "string" ? channel.id : null, transactionAt: parseDokuTransactionDate(transaction.date) };
}

export function isMatchingDokuPayment(payment: DokuRemotePayment, invoiceNumber: string, amount: number) {
  return payment.invoiceNumber === invoiceNumber && payment.amount === amount;
}
