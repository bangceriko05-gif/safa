import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, MapPin, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface StoreData {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
}

export default function SelectStore() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentStore } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      let storeData: StoreData[] = [];

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        storeData = data || [];
      } else {
        const { data, error } = await supabase
          .from("user_store_access")
          .select(`
            store_id,
            role,
            stores (*)
          `)
          .eq("user_id", user.id);

        if (error) throw error;

        storeData = data
          ?.map((access: any) => access.stores)
          .filter((store: any) => store && store.is_active) || [];
      }

      setStores(storeData);

      // Auto-select if only one store
      if (storeData.length === 1) {
        handleSelectStore(storeData[0]);
      } else if (storeData.length === 0) {
        toast.error("Anda tidak memiliki akses ke cabang manapun");
        await supabase.auth.signOut();
        navigate("/auth");
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Gagal memuat data cabang");
      setLoading(false);
    }
  };

  const handleSelectStore = (store: StoreData) => {
    setCurrentStore(store);
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-main)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-main)" }}>
      <Card className="w-full max-w-2xl shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Pilih Cabang</CardTitle>
          <CardDescription>Silakan pilih cabang yang ingin Anda akses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {stores.map((store) => (
              <Button
                key={store.id}
                variant="outline"
                className="h-auto p-4 justify-start text-left hover:bg-accent/50 transition-colors"
                onClick={() => handleSelectStore(store)}
              >
                <div className="flex items-start gap-3 w-full">
                  {store.image_url ? (
                    <img
                      src={store.image_url}
                      alt={store.name}
                      className="w-12 h-12 object-cover rounded-md shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center shrink-0">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base">{store.name}</div>
                    {store.description && (
                      <div className="text-sm text-muted-foreground mt-1">{store.description}</div>
                    )}
                    {store.location && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {store.location}
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
