import { describe, expect, test } from 'bun:test';
import { housekeepingRooms, jakartaDate, type HousekeepingStatus } from './housekeeping';

const row: HousekeepingStatus = { id: 'dirty', room_id: 'room-1', date: '2026-11-23', status: 'Kotor', updated_at: '2026-11-23T01:05:00Z', updated_by: null, cleaning_started_at: null, cleaning_started_by: null };
describe('Housekeeping room lifecycle', () => {
  test('dirty rooms appear as needing cleaning', () => {
    expect(housekeepingRooms([row], '2026-11-23')[0]?.stage).toBe('dirty');
  });
  test('starting keeps a room dirty but moves it to process', () => {
    expect(housekeepingRooms([{ ...row, cleaning_started_at: '2026-11-23T01:10:00Z' }], '2026-11-23')[0]?.stage).toBe('process');
  });
  test('completed cleaning becomes ready and counts in today progress', () => {
    expect(housekeepingRooms([{ ...row, status: 'Aktif', cleaning_started_at: '2026-11-23T01:10:00Z' }], '2026-11-23')[0]?.stage).toBe('done');
  });
  test('historical dirty cells do not override today Ready on the calendar', () => {
    expect(housekeepingRooms([{ ...row, date: '2026-11-22' }], '2026-11-23')).toHaveLength(0);
  });
  test('315 dirty on November 21 is not dirty on November 24; 317 dirty today remains', () => {
    const tasks = housekeepingRooms([
      { ...row, room_id: '315', date: '2026-11-21' },
      { ...row, room_id: '317', date: '2026-11-24', updated_at: '2026-11-24T02:37:00Z' },
    ], '2026-11-24');
    expect(tasks.map(task => task.room_id)).toEqual(['317']);
    expect(tasks[0]?.stage).toBe('dirty');
  });
  test('latest ready status supersedes older dirty status', () => {
    expect(housekeepingRooms([{ ...row, date: '2026-11-22' }, { ...row, id: 'ready', status: 'Aktif' }], '2026-11-23')).toHaveLength(0);
  });
  test('previous completions and future dirty statuses do not count today', () => {
    expect(housekeepingRooms([{ ...row, status: 'Aktif', cleaning_started_at: '2026-11-22T01:00:00Z', updated_at: '2026-11-22T01:30:00Z' }, { ...row, room_id: 'future', date: '2026-11-24' }], '2026-11-23')).toHaveLength(0);
  });
  test('day boundaries use WIB', () => {
    expect(jakartaDate(new Date('2026-11-22T17:01:00Z'))).toBe('2026-11-23');
  });
});