export interface HousekeepingStatus {
  id: string;
  room_id: string;
  date: string;
  status: string;
  updated_at: string;
  updated_by: string | null;
  cleaning_started_at: string | null;
  cleaning_started_by: string | null;
}

export type CleaningStage = 'dirty' | 'process' | 'done';

export function jakartaDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function housekeepingRooms(rows: HousekeepingStatus[], today: string) {
  const latest = new Map<string, HousekeepingStatus>();
  for (const row of rows) {
    if (row.date > today) continue;
    const previous = latest.get(row.room_id);
    if (!previous || row.date > previous.date || (row.date === previous.date && row.updated_at > previous.updated_at)) latest.set(row.room_id, row);
  }
  return [...latest.values()].flatMap(row => {
    let stage: CleaningStage;
    if (row.status === 'Kotor') stage = row.cleaning_started_at ? 'process' : 'dirty';
    else if (row.status === 'Aktif' && row.cleaning_started_at && jakartaDate(new Date(row.updated_at)) === today) stage = 'done';
    else return [];
    return [{ ...row, stage }];
  }).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
}