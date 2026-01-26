import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, MapPin, Loader2, AlertTriangle, Copy, Check, Phone } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/utils/activityLogger";

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
  const [inactiveStores, setInactiveStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { setCurrentStore } = useStore();
  const navigate = useNavigate();
  
  const bankAccount = "0241003956";

  useEffect(() => {
    fetchStores();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bankAccount);
      setCopied(true);
      toast.success("Nomor rekening berhasil disalin!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Gagal menyalin nomor rekening");
    }
  };

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

      let activeStores: StoreData[] = [];
      let inactiveStoresList: StoreData[] = [];

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        activeStores = data || [];
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

        const allStores = data
          ?.map((access: any) => access.stores)
          .filter((store: any) => store) || [];
        
        // Separate active and inactive stores
        activeStores = allStores.filter((store: any) => store.is_active);
        inactiveStoresList = allStores.filter((store: any) => !store.is_active);
      }

      setStores(activeStores);
      setInactiveStores(inactiveStoresList);

      // Auto-select if only one active store and no inactive
      if (activeStores.length === 1 && inactiveStoresList.length === 0) {
        handleSelectStore(activeStores[0]);
      } else if (activeStores.length === 0 && inactiveStoresList.length === 0) {
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

  const handleSelectStore = async (store: StoreData) => {
    if (!store.is_active) {
      toast.error("Outlet ini sedang dinonaktifkan karena jatuh tempo pembayaran");
      return;
    }
    
    setCurrentStore(store);
    
    // Log login activity for this specific store
    await logActivity({
      actionType: 'login',
      entityType: 'System',
      description: `Login ke ${store.name}`,
      storeId: store.id,
    });
    
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-main)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If only inactive stores, show the payment notice
  if (stores.length === 0 && inactiveStores.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-main)" }}>
        <Card className="w-full max-w-lg shadow-lg border-destructive/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl text-destructive">Akses PMS Dinonaktifkan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="font-medium text-foreground">
                Outlet: {inactiveStores.map(s => s.name).join(", ")}
              </p>
              <p className="text-muted-foreground">
                Jatuh tempo pembayaran PMS Anda berlaku hari ini. Segera lakukan pembayaran dan hubungi administrator untuk mengaktifkan kembali PMS di outlet Anda.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Silakan transfer ke rekening berikut:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-bold text-lg text-primary">BCA</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-3">
                <code className="text-2xl font-bold tracking-wider bg-background px-4 py-2 rounded-md border">
                  {bankAccount}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-green-500" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Salin
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                a.n. ANKA Management
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Hubungi Administrator</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Setelah melakukan pembayaran, hubungi administrator untuk konfirmasi dan pengaktifan kembali.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth");
              }} 
              variant="outline" 
              className="w-full mt-4"
            >
              Logout
            </Button>
          </CardContent>
        </Card>
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
        <CardContent className="space-y-4">
          {/* Active stores */}
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
          
          {/* Inactive stores warning */}
          {inactiveStores.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Outlet Dinonaktifkan</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Outlet berikut dinonaktifkan karena jatuh tempo pembayaran:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside">
                      {inactiveStores.map(store => (
                        <li key={store.id}>{store.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3 mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Transfer ke rekening BCA:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-bold tracking-wider bg-background px-2 py-1 rounded border">
                      {bankAccount}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-7 px-2"
                    >
                      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <span className="text-xs text-muted-foreground">a.n. ANKA Management</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
