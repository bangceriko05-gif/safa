import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
}

export function useStoreBySlug() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStore() {
      if (!storeSlug) {
        setError("Store slug tidak ditemukan");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("stores")
          .select("*")
          .eq("slug", storeSlug)
          .eq("is_active", true)
          .single();

        if (fetchError || !data) {
          setError("Toko tidak ditemukan");
          setIsLoading(false);
          return;
        }

        setStore(data as Store);
      } catch (err) {
        console.error("Error fetching store:", err);
        setError("Gagal memuat data toko");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStore();
  }, [storeSlug]);

  return { store, isLoading, error, storeSlug };
}
