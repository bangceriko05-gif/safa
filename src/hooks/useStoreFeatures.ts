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
      } catch (error) {
        console.error("Error fetching store features:", error);
        setFeatures({});
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
