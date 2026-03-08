import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, GripVertical } from "lucide-react";

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export default function PaymentMethodSettings() {
  const { currentStore } = useStore();
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
          { name: "Cash", store_id: currentStore.id, sort_order: 0 },
          { name: "Transfer Bank", store_id: currentStore.id, sort_order: 1 },
          { name: "QRIS", store_id: currentStore.id, sort_order: 2 },
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

  const handleDelete = async (id: string, name: string) => {
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
          Kelola daftar metode pembayaran yang tersedia. Hanya metode yang aktif yang akan muncul di form booking dan pemasukan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada metode pembayaran</p>
        ) : (
          <div className="space-y-2">
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{method.name}</span>
                  {!method.is_active && (
                    <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={method.is_active}
                    onCheckedChange={(checked) => handleToggle(method.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(method.id, method.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
