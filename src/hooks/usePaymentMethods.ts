import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function usePaymentMethods() {
  const { currentStore } = useStore();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) return;

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setMethods(data);
      }
      setLoading(false);
    };

    fetch();
  }, [currentStore]);

  // Returns active method names
  const activeMethodNames = methods.map(m => m.name);

  return { methods, activeMethodNames, loading };
}
