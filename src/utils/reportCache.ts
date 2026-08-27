// Cache sederhana untuk data laporan agar kembali dari halaman lain terasa instan.
// Data cache ditampilkan langsung (tanpa loading), lalu di-refresh diam-diam.

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, { at: number; data: unknown }>();

export function getReportCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setReportCache<T>(key: string, data: T) {
  store.set(key, { at: Date.now(), data });
}

export function invalidateReportCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  Array.from(store.keys()).forEach((k) => {
    if (k.startsWith(prefix)) store.delete(k);
  });
}
