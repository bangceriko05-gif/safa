import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, MapPin, ExternalLink } from "lucide-react";

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
}

export default function StoreSelector() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setStores((data as StoreData[]) || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Pilih Outlet</h1>
          <p className="text-muted-foreground">
            Pilih outlet yang ingin Anda akses
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((store) => (
            <Card key={store.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/${store.slug}`)}>
              {store.image_url ? (
                <div className="h-40 overflow-hidden">
                  <img 
                    src={store.image_url} 
                    alt={store.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-40 bg-muted flex items-center justify-center">
                  <Store className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{store.name}</CardTitle>
                {store.location && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {store.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {store.description || "Klik untuk masuk ke outlet ini"}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/${store.slug}/auth`); }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Masuk
                  </Button>
                  <Button variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/${store.slug}/booking`); }}>
                    Booking
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {stores.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Tidak ada outlet tersedia</h3>
              <p className="text-muted-foreground">
                Belum ada outlet yang aktif saat ini.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
