import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (!cancelled) setIsSuperAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, []);
  return isSuperAdmin;
}