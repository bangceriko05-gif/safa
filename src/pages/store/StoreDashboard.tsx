import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStoreBySlug } from "@/hooks/useStoreBySlug";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/Dashboard";

export default function StoreDashboard() {
  const { store, isLoading: storeLoading, error: storeError, storeSlug } = useStoreBySlug();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [store]);

  const checkAuth = async () => {
    if (!store) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate(`/${storeSlug}/auth`);
        return;
      }

      setIsAuthenticated(true);

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      if (isSuperAdmin) {
        setHasAccess(true);
        // Set current store in localStorage
        localStorage.setItem("current_store_id", store.id);
        setIsCheckingAuth(false);
        return;
      }

      // Check if user has access to this store
      const { data: access } = await supabase
        .from("user_store_access")
        .select("role")
        .eq("user_id", user.id)
        .eq("store_id", store.id)
        .single();

      if (access) {
        setHasAccess(true);
        localStorage.setItem("current_store_id", store.id);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  if (storeLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold mb-2">Toko Tidak Ditemukan</h2>
            <p className="text-muted-foreground mb-4">
              URL "{storeSlug}" tidak valid atau toko tidak aktif.
            </p>
            <Button onClick={() => navigate("/")}>
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
            <p className="text-muted-foreground mb-4">
              Anda tidak memiliki akses ke toko "{store.name}".
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate(`/${storeSlug}/auth`)}>
                Login dengan akun lain
              </Button>
              <Button onClick={() => supabase.auth.signOut().then(() => navigate(`/${storeSlug}/auth`))}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the existing Dashboard component
  // The Dashboard will read currentStore from localStorage/StoreContext
  return <Dashboard />;
}
