import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Coalesce transaction bursts and keep retained report data current. */
export function useReportRefresh(storeId: string | undefined, tables: string[], refresh: () => void) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const tableKey = tables.join(",");
  useEffect(() => {
    if (!storeId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 300);
    };
    let channel = supabase.channel(`retained-report:${storeId}:${tableKey}`);
    for (const table of tableKey.split(",")) {
      channel = channel.on("postgres_changes", {
        event: "*", schema: "public", table,
        filter: `store_id=eq.${storeId}`,
      }, schedule);
    }
    channel.subscribe();
    window.addEventListener("focus", schedule);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", schedule);
      void supabase.removeChannel(channel);
    };
  }, [storeId, tableKey]);
}