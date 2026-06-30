import { supabase } from "@/integrations/supabase/client";

export interface CachedRoomVariant {
  id: string;
  room_id: string;
  store_id: string;
  variant_name: string;
  duration: number;
  price: number;
  description: string | null;
  is_active: boolean;
  visibility_type: string | null;
  visible_days: number[] | null;
  booking_duration_type: string | null;
  booking_duration_value: number | null;
  [key: string]: any;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; data: CachedRoomVariant[] }>();
const inflight = new Map<string, Promise<CachedRoomVariant[]>>();

export async function fetchRoomVariantsCached(storeId: string): Promise<CachedRoomVariant[]> {
  const now = Date.now();
  const hit = cache.get(storeId);
  if (hit && now - hit.at < TTL_MS) return hit.data;

  const existing = inflight.get(storeId);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase
      .from("room_variants")
      .select("*")
      .eq("store_id", storeId)
      .order("variant_name");
    const rows = (data || []) as CachedRoomVariant[];
    cache.set(storeId, { at: Date.now(), data: rows });
    return rows;
  })().finally(() => inflight.delete(storeId));

  inflight.set(storeId, p);
  return p;
}

export async function fetchRoomVariantsByIds(
  storeId: string,
  ids: string[]
): Promise<CachedRoomVariant[]> {
  if (!ids.length) return [];
  const all = await fetchRoomVariantsCached(storeId);
  const set = new Set(ids);
  return all.filter((v) => set.has(v.id));
}

export async function fetchRoomVariantsByRoom(
  storeId: string,
  roomId: string,
  activeOnly = true
): Promise<CachedRoomVariant[]> {
  const all = await fetchRoomVariantsCached(storeId);
  return all.filter(
    (v) => v.room_id === roomId && (!activeOnly || v.is_active)
  );
}

export function invalidateRoomVariantCache(storeId?: string) {
  if (storeId) cache.delete(storeId);
  else cache.clear();
}
