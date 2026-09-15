import AnkaLoader from "@/components/AnkaLoader";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, GripVertical, Globe, AlertTriangle, LayoutDashboard } from "lucide-react";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  is_default: boolean;
  show_on_website?: boolean;
}

const WEBSITE_INACTIVE_MESSAGE =
  "Mohon maaf, fitur website di outlet anda tidak aktif. Lakukan pembayaran tambahan untuk mengaktifkan fitur ini. Terima kasih";

export default function PaymentMethodSettings() {
  const { currentStore } = useStore();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const websiteEnabled = isFeatureEnabled("website") && isFeatureEnabled("website.storefront");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMethodName, setNewMethodName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (currentStore) fetchMethods();
  }, [currentStore]);

  const fetchMethods = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Seed default methods
        const defaults = [
          { name: "Cash", store_id: currentStore.id, sort_order: 0, is_default: true },
          { name: "Transfer Bank", store_id: currentStore.id, sort_order: 1, is_default: true },
          { name: "Hutang", store_id: currentStore.id, sort_order: 2, is_default: true },
        ];
        const { data: seeded, error: seedErr } = await supabase
          .from("payment_methods")
          .insert(defaults)
          .select();
        if (seedErr) throw seedErr;
        setMethods(seeded || []);
      } else {
        setMethods(data);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast.error("Gagal memuat metode pembayaran");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!currentStore || !newMethodName.trim()) return;
    setAdding(true);
    try {
      const maxOrder = methods.length > 0 ? Math.max(...methods.map(m => m.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          name: newMethodName.trim(),
          store_id: currentStore.id,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Metode pembayaran dengan nama ini sudah ada");
        } else {
          throw error;
        }
        return;
      }

      setMethods(prev => [...prev, data]);
      setNewMethodName("");
      toast.success("Metode pembayaran berhasil ditambahkan");
    } catch (error) {
      console.error("Error adding payment method:", error);
      toast.error("Gagal menambahkan metode pembayaran");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setMethods(prev => prev.map(m => m.id === id ? { ...m, is_active: isActive } : m));
      toast.success(isActive ? "Metode pembayaran diaktifkan" : "Metode pembayaran dinonaktifkan");
    } catch (error) {
      console.error("Error toggling payment method:", error);
      toast.error("Gagal mengubah status metode pembayaran");
    }
  };

  const handleToggleWebsite = async (id: string, show: boolean) => {
    if (show && !websiteEnabled) {
      toast.error(WEBSITE_INACTIVE_MESSAGE);
      return;
    }
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ show_on_website: show })
        .eq("id", id);

      if (error) throw error;

      setMethods(prev => prev.map(m => m.id === id ? { ...m, show_on_website: show } : m));
      toast.success(show ? "Metode pembayaran aktif di website" : "Metode pembayaran dinonaktifkan di website");
    } catch (error) {
      console.error("Error toggling website payment method:", error);
      toast.error("Gagal mengubah metode pembayaran website");
    }
  };

  const handleBulkDashboard = async () => {
    if (!currentStore || methods.length === 0) return;
    const allActive = methods.every(m => m.is_active);
    const target = !allActive;
    try {
      const ids = methods.map(m => m.id);
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: target })
        .in("id", ids);
      if (error) throw error;
      setMethods(prev => prev.map(m => ({ ...m, is_active: target })));
      toast.success(target ? "Semua metode diaktifkan di dashboard" : "Semua metode dinonaktifkan di dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengubah status metode pembayaran");
    }
  };

  const handleBulkWebsite = async () => {
    if (!currentStore || methods.length === 0) return;
    const allActive = methods.every(m => m.show_on_website);
    const target = !allActive;
    if (target && !websiteEnabled) {
      toast.error(WEBSITE_INACTIVE_MESSAGE);
      return;
    }
    try {
      const ids = methods.map(m => m.id);
      const { error } = await supabase
        .from("payment_methods")
        .update({ show_on_website: target })
        .in("id", ids);
      if (error) throw error;
      setMethods(prev => prev.map(m => ({ ...m, show_on_website: target })));
      toast.success(target ? "Semua metode aktif di website" : "Semua metode dinonaktifkan di website");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengubah metode pembayaran website");
    }
  };

  const handleDelete = async (id: string, name: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("Metode pembayaran bawaan tidak bisa dihapus");
      return;
    }
    if (!confirm(`Hapus metode pembayaran "${name}"?`)) return;
    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMethods(prev => prev.filter(m => m.id !== id));
      toast.success("Metode pembayaran berhasil dihapus");
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast.error("Gagal menghapus metode pembayaran");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Metode Pembayaran
        </CardTitle>
        <CardDescription>
          Kelola daftar metode pembayaran yang tersedia. Hanya metode yang aktif yang akan muncul di form booking dan pemasukan. Aktifkan "Website" agar metode dipakai di toko online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!websiteEnabled && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive font-medium">{WEBSITE_INACTIVE_MESSAGE}</p>
          </div>
        )}

        {/* Add new method */}
        <div className="flex gap-2">
          <Input
            placeholder="Nama metode pembayaran baru..."
            value={newMethodName}
            onChange={(e) => setNewMethodName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding || !newMethodName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <AnkaLoader />
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada metode pembayaran</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            {/* Header kolom */}
            <div className="grid grid-cols-[1fr_140px_140px_44px] items-start gap-2 bg-muted/50 px-3 py-2.5 border-b">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground self-center">
                Metode
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" /> Website
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => handleBulkWebsite(true)}>
                    Aktifkan semua
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => handleBulkWebsite(false)}>
                    Matikan
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => handleBulkDashboard(true)}>
                    Aktifkan semua
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => handleBulkDashboard(false)}>
                    Matikan
                  </Button>
                </div>
              </div>
              <span className="sr-only">Aksi</span>
            </div>

            {/* Baris metode */}
            <div className="divide-y">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="grid grid-cols-[1fr_140px_140px_44px] items-center gap-2 px-3 py-3 bg-card"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{method.name}</span>
                    {method.is_default && (
                      <Badge variant="outline" className="text-xs shrink-0">Bawaan</Badge>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={!!method.show_on_website && websiteEnabled}
                      onCheckedChange={(checked) => handleToggleWebsite(method.id, checked)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={method.is_active}
                      onCheckedChange={(checked) => handleToggle(method.id, checked)}
                    />
                  </div>
                  <div className="flex justify-end">
                    {!method.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(method.id, method.name, method.is_default)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
