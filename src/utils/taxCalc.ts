/**
 * Helper perhitungan PPN.
 * - mode "include": harga sudah termasuk PPN. DPP = price / (1 + rate). PPN = price - DPP.
 * - mode "exclude": PPN ditambahkan ke harga. DPP = price. PPN = price * rate.
 *
 * `lineTotal` adalah harga jual yang muncul ke pelanggan (atau subtotal),
 * untuk produk yang dijual dengan PPN.
 */
export interface TaxResult {
  dpp: number;
  tax: number;
  /** total yang dibayar pelanggan (untuk exclude = price + tax, untuk include = price) */
  total: number;
}

export function computeTax(
  lineTotal: number,
  enabled: boolean,
  mode: "include" | "exclude",
  ratePercent: number,
): TaxResult {
  const price = Number(lineTotal) || 0;
  if (!enabled || !ratePercent) {
    return { dpp: price, tax: 0, total: price };
  }
  const r = Number(ratePercent) / 100;
  if (mode === "include") {
    const dpp = price / (1 + r);
    const tax = price - dpp;
    return { dpp, tax, total: price };
  }
  // exclude
  const tax = price * r;
  return { dpp: price, tax, total: price + tax };
}