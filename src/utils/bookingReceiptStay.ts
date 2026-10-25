import { addDays, addHours } from "date-fns";

// Stored duration describes the stay, not the room variant's billing period.
export function bookingReceiptStay(booking: { date: string; duration: number; start_time: string; end_time: string; ota_source?: string | null; ota_booking_id?: string | null }, calendarType?: string | null) {
  const daily = calendarType === "pms" || Boolean(booking.ota_source || booking.ota_booking_id) || booking.start_time.startsWith("14:00") && booking.end_time.startsWith("12:00");
  const start = new Date(`${booking.date.slice(0, 10)}T${booking.start_time || "00:00:00"}`);
  return {
    unit: daily ? "hari" : "jam",
    checkout: daily ? addDays(start, booking.duration) : addHours(start, booking.duration),
  };
}