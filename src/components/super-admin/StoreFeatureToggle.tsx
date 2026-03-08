import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Calendar, Receipt, Users, FileText, Settings, Package, History, UserCog, Inbox, Shield } from "lucide-react";

interface StoreFeature {
  id: string;
  store_id: string;
  feature_key: string;
  is_enabled: boolean;
}

const FEATURE_CONFIG: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  calendar: { label: "Kalender / Booking", description: "Jadwal dan pemesanan kamar", icon: Calendar },
  transactions: { label: "Transaksi", description: "Pemasukan & pengeluaran", icon: Receipt },
  customers: { label: "Pelanggan", description: "Data pelanggan", icon: Users },
  reports: { label: "Laporan", description: "Laporan penjualan & okupansi", icon: FileText },
  settings: { label: "Pengaturan", description: "Konfigurasi outlet", icon: Settings },
  products_inventory: { label: "Produk & Inventori", description: "Kelola produk dan kamar", icon: Package },
  activity_log: { label: "Log Aktivitas", description: "Riwayat aktivitas pengguna", icon: History },
  user_management: { label: "Manajemen Pengguna", description: "Kelola user dan permission", icon: UserCog },
  booking_requests: { label: "Booking Request", description: "Permintaan booking online", icon: Inbox },
  deposit: { label: "Deposit", description: "Kelola deposit kamar", icon: Shield },
};

interface StoreFeatureToggleProps {
  storeId: string;
  storeName: string;
}

export default function StoreFeatureToggle({ storeId, storeName }: StoreFeatureToggleProps) {
  const [features, setFeatures] = useState<StoreFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, [storeId]);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_features")
        .select("*")
        .eq("store_id", storeId)
        .order("feature_key");

      if (error) throw error;
      setFeatures((data as StoreFeature[]) || []);
    } catch (error) {
      console.error("Error fetching features:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (feature: StoreFeature) => {
    setUpdating(feature.id);
    try {
      const { error } = await supabase
        .from("store_features")
        .update({ is_enabled: !feature.is_enabled, updated_at: new Date().toISOString() })
        .eq("id", feature.id);

      if (error) throw error;

      setFeatures(prev =>
        prev.map(f => f.id === feature.id ? { ...f, is_enabled: !f.is_enabled } : f)
      );

      const config = FEATURE_CONFIG[feature.feature_key];
      toast.success(`${config?.label || feature.feature_key} ${!feature.is_enabled ? "diaktifkan" : "dinonaktifkan"} untuk ${storeName}`);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah fitur");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = features.filter(f => f.is_enabled).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">
          {enabledCount}/{features.length} fitur aktif
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {features.map(feature => {
          const config = FEATURE_CONFIG[feature.feature_key];
          if (!config) return null;
          const Icon = config.icon;

          return (
            <div
              key={feature.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                feature.is_enabled
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/30 border-border opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${feature.is_enabled ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </div>
              <Switch
                checked={feature.is_enabled}
                onCheckedChange={() => handleToggle(feature)}
                disabled={updating === feature.id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
