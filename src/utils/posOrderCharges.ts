/**
 * Perhitungan Service Charge & PPN pesanan POS yang dipakai bersama oleh
 * kasir, detail pesanan, dan nota, supaya angka yang dilihat kasir sama
 * dengan yang tersimpan dan yang tercetak.
 *
 * Aturan:
 * - Service Charge persen dihitung dari subtotal setelah diskon (sebelum PPN).
 * - PPN exclude ditambahkan per produk kena pajak; PPN include sudah di harga.
 * - Total = subtotal setelah diskon + PPN exclude + Service Charge.
 */
export interface ServiceChargeConfig {
  enabled: boolean;
  apply: boolean;
  type: "percent" | "nominal";
  value: number;
}

export function computeServiceCharge(base: number, cfg: ServiceChargeConfig): number {
  if (!cfg.enabled || !cfg.apply) return 0;
  const value = Number(cfg.value) || 0;
  if (value <= 0) return 0;
  if (cfg.type === "percent") return Math.round((Math.max(0, Number(base) || 0) * value) / 100);
  return Math.round(value);
}

export function posOrderTotal(netAfterDiscount: number, excludeTax: number, serviceCharge: number): number {
  return Math.max(0, Number(netAfterDiscount) || 0) + (Number(excludeTax) || 0) + (Number(serviceCharge) || 0);
}

export interface ReceiptOrderRow {
  total_amount?: number | null;
  service_charge?: number | null;
  tax_amount?: number | null;
}

/** Rincian biaya tambahan pesanan untuk nota: service, PPN, dan selisih lain (diskon/ongkir/pembulatan). */
export function receiptOrderBreakdown(orders: ReceiptOrderRow[], itemsSubtotal: number) {
  const total = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const service = orders.reduce((s, o) => s + (Number(o.service_charge) || 0), 0);
  const tax = orders.reduce((s, o) => s + (Number(o.tax_amount) || 0), 0);
  const other = total - (Number(itemsSubtotal) || 0) - service - tax;
  return { total, service, tax, other };
}

const AUTO_NOTE_PATTERNS = [/\[Service Charge:[^\]]*\]/g, /\[Diskon Transaksi:[^\]]*\]/g, /\(Pelanggan:[^)]*\)/g];

/** Hapus catatan otomatis sistem agar tidak menumpuk setiap kali pesanan disimpan ulang. */
export function stripAutoOrderNotes(note: string | null | undefined): string {
  let text = String(note || "");
  for (const pattern of AUTO_NOTE_PATTERNS) text = text.replace(pattern, " ");
  return text.replace(/\s+/g, " ").trim();
}
