import { addDays, format, startOfDay } from "date-fns";

interface CalendarStay {
  room_id: string;
  date: string;
  duration?: number | null;
  status?: string | null;
}

// Count rooms, not bookings; completed stays still occupy their historical nights.
export function calendarRoomOccupancy(
  rooms: readonly { id: string }[],
  bookings: readonly CalendarStay[],
  date: Date,
) {
  const roomIds = new Set(rooms.map(room => room.id));
  const day = format(date, "yyyy-MM-dd");
  const occupied = new Set<string>();
  for (const booking of bookings) {
    if (!roomIds.has(booking.room_id) || !["BO", "CI", "CO"].includes(booking.status || "BO")) continue;
    const start = startOfDay(new Date(`${booking.date}T00:00:00`));
    const end = format(addDays(start, Math.max(1, booking.duration || 1)), "yyyy-MM-dd");
    if (booking.date <= day && day < end) occupied.add(booking.room_id);
  }
  return { occupied: occupied.size, total: roomIds.size };
}