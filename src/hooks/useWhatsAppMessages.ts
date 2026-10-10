import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { defaultWhatsAppMessages } from "@/utils/bookingWhatsApp";

export function useWhatsAppMessages(storeId?: string) {
  return useQuery({
    queryKey: ["whatsapp-messages", storeId],
    enabled: !!storeId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!storeId) return defaultWhatsAppMessages;
      const { data, error } = await supabase.from("whatsapp_message_settings").select("booking_message,check_in_message,check_out_message").eq("store_id", storeId).maybeSingle();
      if (error) throw error;
      return data || defaultWhatsAppMessages;
    },
  });
}