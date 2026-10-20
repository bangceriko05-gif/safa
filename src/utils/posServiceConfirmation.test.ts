/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { canConfirmPosService, withPosServiceNote } from "./posServiceConfirmation";

describe("POS service confirmation", () => {
  test("requires a named attendant before proceeding to payment", () => {
    expect(canConfirmPosService("   ")).toBe(false);
    expect(canConfirmPosService("ABI BISMA")).toBe(true);
  });
  test("preserves transaction notes and records the confirmed attendant once", () => {
    expect(withPosServiceNote("Tanpa pedas [Dilayani oleh: Lama]", "ABI BISMA"))
      .toBe("Tanpa pedas [Dilayani oleh: ABI BISMA]");
  });
});