import { supabase } from "@/integrations/supabase/client";

export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; data: CachedCustomer[] }>();
const inflight = new Map<string, Promise<CachedCustomer[]>>();

export async function fetchCustomersCached(storeId: string): Promise<CachedCustomer[]> {
  const now = Date.now();
  const hit = cache.get(storeId);
  if (hit && now - hit.at < TTL_MS) return hit.data;

  const existing = inflight.get(storeId);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("store_id", storeId)
      .order("name");
    const rows = (data || []) as CachedCustomer[];
    cache.set(storeId, { at: Date.now(), data: rows });
    return rows;
  })()
    .finally(() => inflight.delete(storeId));

  inflight.set(storeId, p);
  return p;
}

export function invalidateCustomerCache(storeId?: string) {
  if (storeId) cache.delete(storeId);
  else cache.clear();
}