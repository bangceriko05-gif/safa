import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Calendar, Receipt, Users, FileText, Settings, Package, History, UserCog, Inbox, Shield, List, TrendingDown, TrendingUp, Monitor, Palette, Bell, Printer, Bed, Store, ShoppingCart, Tags, LayoutGrid, DollarSign, ChevronDown, ChevronRight, Scale, Globe } from "lucide-react";

interface StoreFeature {
  id: string;
  store_id: string;
  feature_key: string;
  is_enabled: boolean;
}

interface FeatureConfig {
  label: string;
  description: string;
  icon: React.ElementType;
  children?: Record<string, { label: string; icon: React.ElementType }>;
}

const FEATURE_TREE: Record<string, FeatureConfig> = {
  calendar: { label: "Kalender / Booking", description: "Jadwal dan pemesanan kamar", icon: Calendar },
  transactions: {
    label: "Transaksi", description: "Pemasukan & pengeluaran", icon: Receipt,
    children: {
      "transactions.list_booking": { label: "List Booking", icon: List },
      "transactions.expenses": { label: "Pengeluaran", icon: TrendingDown },
      "transactions.incomes": { label: "Pemasukan", icon: TrendingUp },
      "transactions.deposits": { label: "Deposit", icon: Shield },
    },
  },
  customers: { label: "Pelanggan", description: "Data pelanggan", icon: Users },
  reports: {
    label: "Laporan", description: "Laporan penjualan & okupansi", icon: FileText,
    children: {
      "reports.overview": { label: "Overview", icon: LayoutGrid },
      "reports.sales": { label: "Penjualan", icon: DollarSign },
      "reports.income_expense": { label: "Pemasukan & Pengeluaran", icon: TrendingDown },
      "reports.purchase": { label: "Pembelian", icon: ShoppingCart },
      "reports.employee": { label: "Performa Karyawan", icon: UserCog },
      "reports.accounting": { label: "Akuntansi", icon: Scale },
    },
  },
  settings: {
    label: "Pengaturan", description: "Konfigurasi outlet", icon: Settings,
    children: {
      "settings.display": { label: "Tampilan", icon: Monitor },
      "settings.colors": { label: "Warna", icon: Palette },
      "settings.notifications": { label: "Notifikasi", icon: Bell },
      "settings.print": { label: "Nota", icon: Printer },
      "settings.rooms": { label: "Kamar", icon: Bed },
      "settings.outlet": { label: "Outlet", icon: Store },
      "settings.ota": { label: "OTA", icon: Globe },
    },
  },
  products_inventory: {
    label: "Produk & Inventori", description: "Kelola produk dan kamar", icon: Package,
    children: {
      "products_inventory.rooms": { label: "Kamar", icon: Bed },
      "products_inventory.products": { label: "Produk", icon: ShoppingCart },
      "products_inventory.categories": { label: "Kategori", icon: Tags },
    },
  },
  activity_log: { label: "Log Aktivitas", description: "Riwayat aktivitas pengguna", icon: History },
  user_management: { label: "Manajemen Pengguna", description: "Kelola user dan permission", icon: UserCog },
  booking_requests: { label: "Booking Request", description: "Permintaan booking online", icon: Inbox },
  deposit: { label: "Deposit", description: "Kelola deposit kamar", icon: Shield },
};

const FEATURE_ORDER = [
  "calendar", "transactions", "customers", "reports",
  "settings", "products_inventory", "activity_log",
  "user_management", "booking_requests", "deposit",
];

interface StoreFeatureToggleProps {
  storeId: string;
  storeName: string;
}

export default function StoreFeatureToggle({ storeId, storeName }: StoreFeatureToggleProps) {
  const [features, setFeatures] = useState<StoreFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFeatures();
  }, [storeId]);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_features")
        .select("*")
        .eq("store_id", storeId);

      if (error) throw error;
      setFeatures((data as StoreFeature[]) || []);
    } catch (error) {
      console.error("Error fetching features:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFeature = (key: string) => features.find(f => f.feature_key === key);
  const isEnabled = (key: string) => getFeature(key)?.is_enabled !== false;

  const handleToggle = async (feature: StoreFeature) => {
    setUpdating(feature.id);
    try {
      const newValue = !feature.is_enabled;
      const { error } = await supabase
        .from("store_features")
        .update({ is_enabled: newValue, updated_at: new Date().toISOString() })
        .eq("id", feature.id);

      if (error) throw error;

      // If toggling a parent OFF, also disable all children
      const config = FEATURE_TREE[feature.feature_key];
      if (config?.children && !newValue) {
        const childKeys = Object.keys(config.children);
        const childFeatures = features.filter(f => childKeys.includes(f.feature_key));
        for (const child of childFeatures) {
          if (child.is_enabled) {
            await supabase
              .from("store_features")
              .update({ is_enabled: false, updated_at: new Date().toISOString() })
              .eq("id", child.id);
          }
        }
        setFeatures(prev =>
          prev.map(f => {
            if (f.id === feature.id) return { ...f, is_enabled: newValue };
            if (childKeys.includes(f.feature_key)) return { ...f, is_enabled: false };
            return f;
          })
        );
      } else {
        setFeatures(prev =>
          prev.map(f => f.id === feature.id ? { ...f, is_enabled: newValue } : f)
        );
      }

      // Find label
      let label = feature.feature_key;
      if (FEATURE_TREE[feature.feature_key]) {
        label = FEATURE_TREE[feature.feature_key].label;
      } else {
        // It's a sub-feature
        for (const [, parentConfig] of Object.entries(FEATURE_TREE)) {
          if (parentConfig.children?.[feature.feature_key]) {
            label = parentConfig.children[feature.feature_key].label;
            break;
          }
        }
      }

      toast.success(`${label} ${newValue ? "diaktifkan" : "dinonaktifkan"} untuk ${storeName}`);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah fitur");
    } finally {
      setUpdating(null);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mainFeatures = features.filter(f => !f.feature_key.includes("."));
  const enabledCount = mainFeatures.filter(f => f.is_enabled).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">
          {enabledCount}/{mainFeatures.length} fitur utama aktif
        </span>
      </div>
      <div className="space-y-1">
        {FEATURE_ORDER.map(key => {
          const config = FEATURE_TREE[key];
          if (!config) return null;
          const feature = getFeature(key);
          if (!feature) return null;
          const Icon = config.icon;
          const hasChildren = !!config.children;
          const isExpanded = expandedParents.has(key);

          return (
            <div key={key}>
              {/* Parent feature row */}
              <div
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  feature.is_enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => hasChildren && toggleExpand(key)}>
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <div className="w-4" />
                  )}
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

              {/* Sub-features */}
              {hasChildren && isExpanded && feature.is_enabled && (
                <div className="ml-8 mt-1 space-y-1 border-l-2 border-primary/20 pl-4">
                  {Object.entries(config.children!).map(([childKey, childConfig]) => {
                    const childFeature = getFeature(childKey);
                    if (!childFeature) return null;
                    const ChildIcon = childConfig.icon;

                    return (
                      <div
                        key={childKey}
                        className={`flex items-center justify-between p-2.5 rounded-md border transition-colors ${
                          childFeature.is_enabled
                            ? "bg-primary/5 border-primary/10"
                            : "bg-muted/20 border-border opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ChildIcon className={`h-3.5 w-3.5 ${childFeature.is_enabled ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-sm">{childConfig.label}</span>
                        </div>
                        <Switch
                          checked={childFeature.is_enabled}
                          onCheckedChange={() => handleToggle(childFeature)}
                          disabled={updating === childFeature.id}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
