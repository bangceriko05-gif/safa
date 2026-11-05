/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { plainIndonesian } from "./toastLanguageGuard";

describe("plainIndonesian", () => {
  it("replaces foreign key delete errors with an Indonesian explanation", () => {
    const msg = plainIndonesian('update or delete on table "bookings" violates foreign key constraint "doku_booking_attempts_booking_id_fkey" on table "doku_booking_attempts"');
    expect(msg).toContain("belum bisa dihapus");
    expect(msg).not.toMatch(/violates|fkey/);
  });
  it("keeps Indonesian application messages unchanged", () => {
    expect(plainIndonesian("Booking berhasil dihapus")).toBe("Booking berhasil dihapus");
  });
  it("hides raw English service errors", () => {
    expect(plainIndonesian("Failed to fetch")).not.toMatch(/Failed/);
  });
});
