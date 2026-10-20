/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { canConfirmPosService } from "./posServiceConfirmation";

describe("POS service confirmation", () => {
  test("requires a named attendant before proceeding to payment", () => {
    expect(canConfirmPosService("   ")).toBe(false);
    expect(canConfirmPosService("ABI BISMA")).toBe(true);
  });
});