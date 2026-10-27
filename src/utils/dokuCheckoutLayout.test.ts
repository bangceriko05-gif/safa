import { describe, expect, test } from "bun:test";
import { DOKU_QR_TTL_MS, dokuBrandingCrop, formatDokuQrCountdown } from "./dokuCheckoutLayout";

describe("Potongan branding halaman DOKU", () {
  test("panel sempit tetap memotong logo dan nama outlet", () => {
    expect(dokuBrandingCrop(360)).toBe(335);
    expect(dokuBrandingCrop(420)).toBe(335);
  });
  test("lebar menengah dan lebar panel POS memotong tepat sebelum nominal bayar", () => {
    expect(dokuBrandingCrop(480)).toBe(298);
    expect(dokuBrandingCrop(640)).toBe(298);
    expect(dokuBrandingCrop(768)).toBe(298);
    expect(dokuBrandingCrop(769)).toBe(285);
    expect(dokuBrandingCrop(992)).toBe(285);
  });
  test("panel lebar memakai potongan tata letak dua kolom", () => {
    expect(dokuBrandingCrop(993)).toBe(309);
    expect(dokuBrandingCrop(1280)).toBe(309);
  });
  test("lebar tidak valid tidak membuat halaman bergeser", () => {
    expect(dokuBrandingCrop(0)).toBe(298);
    expect(dokuBrandingCrop(Number.NaN)).toBe(298);
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
