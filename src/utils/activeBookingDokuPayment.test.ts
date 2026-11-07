import { describe, expect, it } from "bun:test";
import { activeBookingDokuTimer } from "./activeBookingDokuPayment";

const startedAt = "2026-11-07T03:00:00.000Z";
const now = new Date("2026-11-07T03:30:00.000Z").getTime();
const row = { booking_id: "booking-1", created_at: startedAt, due_minutes: 60 };

describe("QRIS booking yang sedang berjalan", () => {
  it("melanjutkan QR selama batas waktunya belum habis", () => {
    expect(activeBookingDokuTimer([row], now)).toEqual(row);
  });

  it("tidak melanjutkan QR yang sudah kedaluwarsa", () => {
    expect(activeBookingDokuTimer([row], new Date("2026-11-07T04:00:00.000Z").getTime())).toBeNull();
  });

  it("menampilkan formulir biasa jika tidak ada QR yang menunggu", () => {
    expect(activeBookingDokuTimer([], now)).toBeNull();
    expect(activeBookingDokuTimer(null, now)).toBeNull();
  });
});
