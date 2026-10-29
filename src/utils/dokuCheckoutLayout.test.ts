import { describe, expect, test } from "bun:test";
import { DOKU_IFRAME_MAX_WIDTH, DOKU_QR_TTL_MS, dokuBrandingCrop, formatDokuQrCountdown } from "./dokuCheckoutLayout";

describe("Potongan branding halaman DOKU", () => {
  test("panel sempit memotong branding dan Order Summary tepat sebelum QR", () => {
    expect(dokuBrandingCrop(360)).toBe(545);
    expect(dokuBrandingCrop(420)).toBe(545);
  });
  test("lebar menengah memotong tepat sebelum bagian Scan QR Code to Pay", () => {
    expect(dokuBrandingCrop(440)).toBe(510);
    expect(dokuBrandingCrop(480)).toBe(510);
    expect(dokuBrandingCrop(520)).toBe(510);
  });
  test("lebar maksimal iframe memotong tepat sebelum QR", () => {
    expect(dokuBrandingCrop(560)).toBe(485);
    expect(dokuBrandingCrop(640)).toBe(485);
    expect(dokuBrandingCrop(DOKU_IFRAME_MAX_WIDTH)).toBe(485);
  });
  test("lebar tidak valid tidak membuat halaman bergeser", () => {
    expect(dokuBrandingCrop(0)).toBe(485);
    expect(dokuBrandingCrop(Number.NaN)).toBe(485);
  });
  test("QR DOKU berlaku 60 menit", () => {
    expect(DOKU_QR_TTL_MS).toBe(3_600_000);
  });
  test("sisa waktu QR ditampilkan sebagai menit:detik", () => {
    expect(formatDokuQrCountdown(DOKU_QR_TTL_MS)).toBe("60:00");
    expect(formatDokuQrCountdown(61_000)).toBe("1:01");
    expect(formatDokuQrCountdown(-5_000)).toBe("0:00");
    expect(formatDokuQrCountdown(0)).toBe("0:00");
  });
});
