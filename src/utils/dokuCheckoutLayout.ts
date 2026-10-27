// Halaman pembayaran DOKU selalu membuka dengan zona branding: bar hitung mundur,
// pemilih bahasa, lalu logo serta nama outlet pemilik Client ID. Kasir tidak butuh
// bagian itu, jadi panel POS memotongnya dan langsung menampilkan ringkasan bayar
// beserta QRIS.
//
// Nilai di bawah diukur langsung dari halaman DOKU (checkout-link-v2 v1.6.112):
// potongannya adalah tepat titik kartu "Order Summary" mulai, sehingga logo/nama
// outlet hilang tanpa memotong nominal bayar. Bila DOKU mengubah tata letak
// halamannya, cukup perbarui angka di sini.
export function dokuBrandingCrop(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 298;
  if (width <= 420) return 335;
  if (width <= 768) return 298;
  if (width <= 992) return 285;
  return 309;
}

// QRIS DOKU berlaku 60 menit (payment_due_date: 60) sebelum tagihan diganti.
export const DOKU_QR_TTL_MS = 60 * 60 * 1000;

export function formatDokuQrCountdown(ms: number): string {
  const safe = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
