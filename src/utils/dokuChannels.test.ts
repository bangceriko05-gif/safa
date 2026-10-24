import { describe, expect, test } from "bun:test";
import { DOKU_METHOD_GROUPS, dokuGroupForMethod, enabledDokuCodes, opensDokuOnSelection, isVerifiedDokuCheckoutUrl } from "./dokuChannels";

describe("DOKU channel groups", () => {
  test("hanya channel yang diaktifkan outlet yang dipakai untuk satu metode", () => {
    const va = dokuGroupForMethod("Virtual Account DOKU");
    if (!va) throw new Error("Missing VA group");
    expect(enabledDokuCodes(va, ["VIRTUAL_ACCOUNT_BCA", "QRIS"])).toEqual(["VIRTUAL_ACCOUNT_BCA"]);
  });
  test("metode QRIS tidak tersedia tanpa channel QRIS aktif", () => {
    const qris = dokuGroupForMethod("QRIS DOKU");
    if (!qris) throw new Error("Missing QRIS group");
    expect(enabledDokuCodes(qris, [])).toEqual([]);
    expect(enabledDokuCodes(qris, ["QRIS"])).toEqual(["QRIS"]);
  });
  test("metode manual outlet tidak pernah dianggap DOKU", () => {
    expect(dokuGroupForMethod("Cash")).toBeNull();
    expect(dokuGroupForMethod("Transfer")).toBeNull();
  });
  test("nama grup metode unik", () => {
    expect(new Set(DOKU_METHOD_GROUPS.map((g) => g.name)).size).toBe(DOKU_METHOD_GROUPS.length);
  });
  test("QRIS DOKU langsung membuka pembayaran saat dipilih", () => {
    expect(opensDokuOnSelection("QRIS DOKU")).toBe(true);
    expect(opensDokuOnSelection("QRIS")).toBe(false);
    expect(opensDokuOnSelection("Cash")).toBe(false);
    expect(opensDokuOnSelection("Virtual Account DOKU")).toBe(false);
  });
  test("halaman pembayaran hanya menerima alamat HTTPS DOKU", () => {
    expect(isVerifiedDokuCheckoutUrl("https://checkout.doku.com/payment/test")).toBe(true);
    expect(isVerifiedDokuCheckoutUrl("https://doku.com.evil.test/payment")).toBe(false);
    expect(isVerifiedDokuCheckoutUrl("http://checkout.doku.com/payment")).toBe(false);
    expect(isVerifiedDokuCheckoutUrl("javascript:alert(1)")).toBe(false);
  });
});
