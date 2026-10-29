// Halaman pembayaran DOKU selalu membuka dengan zona branding (bar hitung mundur,
// pemilih bahasa, logo serta nama outlet pemilik Client ID) lalu kartu "Order
// Summary". Kasir tidak butuh bagian itu — ringkasan pesanan sudah ditampilkan
// ANKA sendiri di bawah QR — jadi panel POS memotong semuanya dan langsung
// menampilkan bagian "Scan QR Code to Pay".
//
// Nilai di bawah diukur langsung dari halaman DOKU (checkout-link-v2 v1.6.112):
// potongannya adalah tepat titik bagian "Scan QR Code to Pay" mulai, sehingga
// branding dan Order Summary hilang tanpa memotong QR. Bila DOKU mengubah tata
// letak halamannya, cukup perbarui angka di sini.
export function dokuBrandingCrop(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 590;
  if (width <= 420) return 640;
  if (width <= 768) return 600;
  if (width <= 992) return 575;
  return 590;
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
