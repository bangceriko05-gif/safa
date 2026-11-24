import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const sessionFile = process.env.TEST_HOUSEKEEPING_SESSION_FILE;
const integrationTest = sessionFile ? test : test.skip;

integrationTest('315 historical dirty status cannot be started or completed and remains unchanged', async () => {
  if (!sessionFile) throw new Error('Test session missing');
  const url = process.env.VITE_SUPABASE_URL;
  const apikey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apikey) throw new Error('Test configuration missing');
  const { session } = JSON.parse(readFileSync(sessionFile, 'utf8'));
  const headers = { apikey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  const id = '95dd006e-be54-4379-b384-4eb567cdd5d5';
  const read = async () => {
    const response = await fetch(`${url}/rest/v1/room_daily_status?id=eq.${id}&select=*`, { headers });
    expect(response.ok).toBe(true);
    return response.json();
  };
  const before = await read();
  expect(before[0]?.date).toBe('2026-11-21');
  expect(before[0]?.status).toBe('Kotor');
  for (const action of ['start', 'complete']) {
    const response = await fetch(`${url}/rest/v1/rpc/housekeeping_action`, {
      method: 'POST', headers, body: JSON.stringify({ p_status_id: id, p_action: action }),
    });
    expect(response.ok).toBe(false);
    const error = await response.json();
    expect(error.message).toBe('Room no longer dirty today');
  }
  expect(await read()).toEqual(before);
});