import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StoreFeatureData {
  is_enabled: boolean;
  activation_price: string | null;
  activation_description: string | null;
}

interface StoreFeatureMap {
  [key: string]: StoreFeatureData;
}

const FEATURE_CACHE_TTL_MS = 10 * 60 * 1000;

function readFeatureCache(key: string | null): StoreFeatureMap {
  if (!key) return {};
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed?.map || Date.now() - (parsed.at || 0) > FEATURE_CACHE_TTL_MS) return {};
    return parsed.map as StoreFeatureMap;
  } catch {
    return {};
  }
}

export function useStoreFeatures(storeId: string | undefined) {
  const cacheKey = storeId ? `anka_store_features_${storeId}` : null;
  const [features, setFeatures] = useState<StoreFeatureMap>(() => readFeatureCache(cacheKey));
  const [loading, setLoading] = useState(() => Object.keys(readFeatureCache(cacheKey)).length === 0);

  useEffect(() => {
    if (!storeId) {
      setFeatures({});
      setLoading(false);
      return;
    }

    // Paint instantly from cache, then silently revalidate in the background.
    const cached = readFeatureCache(`anka_store_features_${storeId}`);
    if (Object.keys(cached).length > 0) {
      setFeatures(cached);
      setLoading(false);
    }

    const fetchFeatures = async () => {
      try {
        const { data, error } = await supabase
          .from("store_features")
          .select("feature_key, is_enabled, activation_price, activation_description")
          .eq("store_id", storeId);

        if (error) throw error;

        const map: StoreFeatureMap = {};
        (data || []).forEach((f: any) => {
          map[f.feature_key] = {
            is_enabled: f.is_enabled,
            activation_price: f.activation_price,
            activation_description: f.activation_description,
          };
        });
        setFeatures(map);
        try {
          sessionStorage.setItem(
            `anka_store_features_${storeId}`,
            JSON.stringify({ at: Date.now(), map })
          );
        } catch { /* ignore quota errors */ }
      } catch (error) {
        console.error("Error fetching store features:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [storeId]);

  const isFeatureEnabled = (key: string): boolean => {
    return features[key]?.is_enabled !== false;
  };

  const getFeatureInfo = (key: string): { price: string | null; description: string | null } => {
    const f = features[key];
    return {
      price: f?.activation_price || null,
      description: f?.activation_description || null,
    };
  };

  return { features, loading, isFeatureEnabled, getFeatureInfo };
}
