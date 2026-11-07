export interface BookingDokuTimerRow {
  booking_id: string;
  created_at: string;
  due_minutes: number;
}

/** Hanya tagihan yang belum melewati batas waktunya boleh dilanjutkan. */
export function activeBookingDokuTimer(rows: BookingDokuTimerRow[] | null, now = Date.now()) {
  return (rows || []).find(row => {
    const startedAt = new Date(row.created_at).getTime();
    const dueMinutes = Number(row.due_minutes);
    return Number.isFinite(startedAt) && Number.isFinite(dueMinutes) && dueMinutes > 0 && now < startedAt + dueMinutes * 60_000;
  }) || null;
}
