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