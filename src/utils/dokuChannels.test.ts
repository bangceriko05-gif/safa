import { describe, expect, test } from "bun:test";
import { DOKU_METHOD_GROUPS, dokuGroupForMethod, enabledDokuCodes } from "./dokuChannels";

describe("DOKU channel groups", () => {
  test("hanya channel yang diaktifkan outlet yang dipakai untuk satu metode", () => {
    const va = dokuGroupForMethod("Virtual Account DOKU")!;
    expect(enabledDokuCodes(va, ["VIRTUAL_ACCOUNT_BCA", "QRIS"])).toEqual(["VIRTUAL_ACCOUNT_BCA"]);
  });
  test("metode QRIS tidak tersedia tanpa channel QRIS aktif", () => {
    const qris = dokuGroupForMethod("QRIS DOKU")!;
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
});
