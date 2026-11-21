import { describe, expect, test } from "bun:test";
import { calendarRoomOccupancy } from "./calendarRoomOccupancy";

const date = new Date(2026, 10, 20);
const rooms = Array.from({ length: 10 }, (_, i) => ({ id: `room-${i}` }));
const stays = Array.from({ length: 8 }, (_, i) => ({ room_id: `room-${i}`, date: "2026-11-20", duration: 1, status: "BO" }));

describe("calendar room occupancy", () => {
  test("eight occupied rooms out of ten", () => {
    expect(calendarRoomOccupancy(rooms, stays, date)).toEqual({ occupied: 8, total: 10 });
  });
  test("checked-out rooms keep their historical occupancy", () => {
    expect(calendarRoomOccupancy(rooms, stays.map(stay => ({ ...stay, status: "CO" })), date)).toEqual({ occupied: 8, total: 10 });
  });
  test("the denominator follows each hotel's room inventory", () => {
    expect(calendarRoomOccupancy(rooms.slice(0, 5), stays, date)).toEqual({ occupied: 5, total: 5 });
  });
  test("multiple stays in one room count as one room", () => {
    expect(calendarRoomOccupancy(rooms, [...stays, ...stays], date).occupied).toBe(8);
  });
  test("cancelled bookings do not fill rooms", () => {
    expect(calendarRoomOccupancy(rooms, stays.map(stay => ({ ...stay, status: "BATAL" })), date).occupied).toBe(0);
  });
  test("counts every occupied night but not the departure day", () => {
    const stay = [{ room_id: "room-0", date: "2026-11-18", duration: 3, status: "CO" }];
    expect(calendarRoomOccupancy(rooms, stay, date).occupied).toBe(1);
    expect(calendarRoomOccupancy(rooms, stay, new Date(2026, 10, 21)).occupied).toBe(0);
    expect(calendarRoomOccupancy(rooms, stay, new Date(2026, 10, 17)).occupied).toBe(0);
  });
});