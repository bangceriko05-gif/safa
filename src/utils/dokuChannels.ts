// Grup metode pembayaran DOKU yang tampil sebagai satu tombol di POS.
// Kode channel mengikuti daftar resmi DOKU Checkout (payment_method_types).
export interface DokuMethodGroup {
  name: string;
  codes: string[];
}

export const DOKU_METHOD_GROUPS: DokuMethodGroup[] = [
  { name: "Virtual Account DOKU", codes: ["VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_BANK_MANDIRI", "VIRTUAL_ACCOUNT_BNI", "VIRTUAL_ACCOUNT_BRI", "VIRTUAL_ACCOUNT_BANK_PERMATA", "VIRTUAL_ACCOUNT_BANK_CIMB", "VIRTUAL_ACCOUNT_BANK_DANAMON", "VIRTUAL_ACCOUNT_BSI", "VIRTUAL_ACCOUNT_DOKU"] },
  { name: "QRIS DOKU", codes: ["QRIS"] },
  { name: "E-Wallet DOKU", codes: ["EMONEY_OVO", "EMONEY_DANA", "EMONEY_SHOPEE_PAY", "EMONEY_LINKAJA", "EMONEY_DOKU"] },
  { name: "Kartu Kredit/Debit DOKU", codes: ["CREDIT_CARD"] },
  { name: "Gerai Retail DOKU", codes: ["ONLINE_TO_OFFLINE_ALFA", "ONLINE_TO_OFFLINE_INDOMARET"] },
  { name: "Paylater DOKU", codes: ["PEER_TO_PEER_AKULAKU", "PEER_TO_PEER_KREDIVO", "PEER_TO_PEER_INDODANA"] },
];

export function dokuGroupForMethod(name: string): DokuMethodGroup | null {
  return DOKU_METHOD_GROUPS.find((group) => group.name === name) || null;
}

// Hanya channel yang diaktifkan outlet pada Pengaturan DOKU yang boleh dipakai.
export function enabledDokuCodes(group: DokuMethodGroup, enabled: string[]): string[] {
  return group.codes.filter((code) => enabled.includes(code));
}

export function bookingPaymentMethods(manualMethods: string[], dokuEnabled: boolean, channels: string[]): string[] {
  const manual = manualMethods.filter((name) => !dokuGroupForMethod(name));
  const doku = dokuEnabled
    ? DOKU_METHOD_GROUPS.filter((group) => enabledDokuCodes(group, channels).length > 0).map((group) => group.name)
    : [];
  return [...new Set([...manual, ...doku])];
}

export function opensDokuOnSelection(method: string): boolean {
  return method === "QRIS DOKU";
}

export function isVerifiedDokuCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "doku.com" || url.hostname.endsWith(".doku.com"));
  } catch {
    return false;
  }
}
