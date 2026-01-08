import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Store, Plus, Settings, LogOut, MapPin, ExternalLink } from "lucide-react";
import StoreManagement from "@/components/StoreManagement";

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [showManagement, setShowManagement] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to first available store auth or show store selection
        navigate("/");
        return;
      }

      // Check if super admin
      const { data: isSuperAdminResult } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      if (!isSuperAdminResult) {
        toast.error("Hanya Super Admin yang dapat mengakses halaman ini");
        navigate("/");
        return;
      }

      setIsSuperAdmin(true);
      await fetchStores();
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) throw error;
      setStores((data as StoreData[]) || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Gagal memuat daftar toko");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil logout");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showManagement) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Kelola Outlet</h1>
              <p className="text-muted-foreground">Tambah, edit, atau hapus outlet</p>
            </div>
            <Button variant="outline" onClick={() => { setShowManagement(false); fetchStores(); }}>
              Kembali
            </Button>
          </div>
          <StoreManagement />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">Kelola semua outlet dari sini</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowManagement(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Kelola Outlet
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Store List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Card key={store.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {store.image_url ? (
                <div className="h-32 overflow-hidden">
                  <img 
                    src={store.image_url} 
                    alt={store.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-muted flex items-center justify-center">
                  <Store className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    store.is_active 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }`}>
                    {store.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                {store.location && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {store.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {store.description || "Tidak ada deskripsi"}
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/${store.slug}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Buka Dashboard
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(`/${store.slug}/booking`, '_blank')}
                  >
                    Booking
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  URL: /{store.slug}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {stores.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Belum ada outlet</h3>
              <p className="text-muted-foreground mb-4">
                Tambahkan outlet pertama untuk memulai
              </p>
              <Button onClick={() => setShowManagement(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Outlet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
