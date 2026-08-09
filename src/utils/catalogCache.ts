import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 60_000;

type Entry<T> = { at: number; data: T };
const cache = new Map<string, Entry<any>>();
const inflight = new Map<string, Promise<any>>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = loader()
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidateCatalogCache(storeId?: string) {
  if (!storeId) return cache.clear();
  Array.from(cache.keys())
    .filter((k) => k.includes(storeId))
    .forEach((k) => cache.delete(k));
}

/** Products of a store (superset of columns used across inventory/POS screens). */
export async function fetchProductsCached(storeId: string): Promise<any[]> {
  return cached(`products:${storeId}`, async () => {
    const { data } = await supabase
      .from("products")
      .select(
        "id, name, sku, price, purchase_price, stock_qty, material_id, unit_id, category_id, is_active"
      )
      .eq("store_id", storeId)
      .order("name");
    return (data || []) as any[];
  });
}

/** Map of material id -> material name. */
export async function fetchMaterialNamesCached(
  storeId: string
): Promise<Record<string, string>> {
  return cached(`materials:${storeId}`, async () => {
    const { data } = await supabase
      .from("product_materials")
      .select("id, name")
      .eq("store_id", storeId);
    const map: Record<string, string> = {};
    (data || []).forEach((m: any) => {
      map[m.id] = m.name;
    });
    return map;
  });
}

/** Active variants of a store's products, grouped by product id. */
export async function fetchActiveVariantsCached(
  storeId: string,
  productIds: string[]
): Promise<Record<string, any[]>> {
  if (!productIds.length) return {};
  return cached(`variants:${storeId}`, async () => {
    const { data } = await supabase
      .from("product_variants")
      .select("id, product_id, variant_name, sku, price, purchase_price, stock, is_active")
      .in("product_id", productIds)
      .eq("is_active", true);
    const byProduct: Record<string, any[]> = {};
    (data || []).forEach((v: any) => {
      (byProduct[v.product_id] ||= []).push(v);
    });
    return byProduct;
  });
}
