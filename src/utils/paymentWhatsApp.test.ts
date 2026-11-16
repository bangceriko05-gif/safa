import { expect, test } from "bun:test";
import { paymentWhatsAppLink } from "./paymentWhatsApp";

test("tautan pembayaran menuju nomor pelanggan tanpa koneksi WhatsApp Business", () => {
  const url = paymentWhatsAppLink({ phone: "0812-3456-7890", name: "Bisma", bid: "BO-001" }, "https://checkout.doku.com/pay/current-invoice", 140000);
  expect(url?.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
  expect(decodeURIComponent(url || "")).toContain("https://checkout.doku.com/pay/current-invoice");
  expect(decodeURIComponent(url || "")).toContain("Rp 140.000");
  expect(decodeURIComponent(url || "")).toContain("BO-001");
});
test("nomor pelanggan dan link pembayaran harus tersedia serta valid", () => {
  expect(paymentWhatsAppLink({}, "https://checkout.doku.com/pay/1", 1)).toBeNull();
  expect(paymentWhatsAppLink({ phone: "081234567890" }, null, 1)).toBeNull();
  expect(paymentWhatsAppLink({ phone: "081234567890" }, "https://example.com/pay", 1)).toBeNull();
});
test("link invoice terbaru dikirim tanpa membuat invoice lain", () => {
  expect(decodeURIComponent(paymentWhatsAppLink({ phone: "+6281234567890" }, "https://checkout.doku.com/pay/renewed", 1) || "")).toContain("/pay/renewed");
});
test("pesan memuat nama hotel serta tanggal check-in dan check-out", () => {
  const message = decodeURIComponent(paymentWhatsAppLink({
    phone: "081234567890", name: "ADAM PRIYO", bid: "BO-STR-20261115-007",
    storeName: "SAFA Kost and Guest House",
    checkIn: new Date(2026, 10, 15, 14, 0), checkOut: new Date(2026, 10, 16, 12, 0),
  }, "https://checkout.doku.com/pay/current-invoice", 140000) || "");
  expect(message).toContain("Hotel: SAFA Kost and Guest House");
  expect(message).toContain("Check-in: 15 Nov 2026");
  expect(message).toContain("Check-out: 16 Nov 2026");
  expect(message).not.toContain("14:00");
});
test("menginap per jam mencantumkan jam check-in dan check-out", () => {
  const message = decodeURIComponent(paymentWhatsAppLink({
    phone: "081234567890", storeName: "FunFury Rageroom",
    checkIn: new Date(2026, 10, 15, 23, 0), checkOut: new Date(2026, 10, 16, 1, 0), withTime: true,
  }, "https://checkout.doku.com/pay/renewed", 1) || "");
  expect(message).toContain("Hotel: FunFury Rageroom");
  expect(message).toContain("Check-in: 15 Nov 2026 23:00");
  expect(message).toContain("Check-out: 16 Nov 2026 01:00");
});
test("nama hotel dan tanggal yang tidak ada tidak membuat pesan rusak", () => {
  const message = decodeURIComponent(paymentWhatsAppLink({ phone: "081234567890", storeName: null, checkIn: null, checkOut: "bukan-tanggal" }, "https://checkout.doku.com/pay/renewed", 1) || "");
  expect(message).not.toContain("Hotel:");
  expect(message).not.toContain("Check-in:");
  expect(message).not.toContain("Check-out:");
  expect(message).toContain("https://checkout.doku.com/pay/renewed");
});