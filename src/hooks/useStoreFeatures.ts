import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StoreFeatureMap {
  [key: string]: boolean;
}

export function useStoreFeatures(storeId: string | undefined) {
  const [features, setFeatures] = useState<StoreFeatureMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setFeatures({});
      setLoading(false);
      return;
    }

    const fetchFeatures = async () => {
      try {
        const { data, error } = await supabase
          .from("store_features")
          .select("feature_key, is_enabled")
          .eq("store_id", storeId);

        if (error) throw error;

        const map: StoreFeatureMap = {};
        (data || []).forEach((f: any) => {
          map[f.feature_key] = f.is_enabled;
        });
        setFeatures(map);
      } catch (error) {
        console.error("Error fetching store features:", error);
        // Default all to true if fetch fails
        setFeatures({});
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [storeId]);

  const isFeatureEnabled = (key: string): boolean => {
    // If not in the map, default to true (enabled)
    return features[key] !== false;
  };

  return { features, loading, isFeatureEnabled };
}
