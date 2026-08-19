import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const DEFAULT_CUSTOMER_TYPES = ["Reguler", "Member", "VIP", "Korporat", "OTA", "Grup"];

export interface CustomerTypeRow {
  id: string;
  name: string;
  sort_order: number;
}

export async function fetchCustomerTypes(storeId: string): Promise<CustomerTypeRow[]> {
  const { data } = await supabase
    .from("customer_types")
    .select("id,name,sort_order")
    .eq("store_id", storeId)
    .order("sort_order")
    .order("name");

  if (data && data.length > 0) return data as CustomerTypeRow[];

  // Seed defaults once per store so users can edit/delete them freely
  await supabase.from("customer_types").insert(
    DEFAULT_CUSTOMER_TYPES.map((name, i) => ({ store_id: storeId, name, sort_order: i })),
  );
  const { data: seeded } = await supabase
    .from("customer_types")
    .select("id,name,sort_order")
    .eq("store_id", storeId)
    .order("sort_order")
    .order("name");
  return (seeded || []) as CustomerTypeRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeId?: string;
  onChanged?: () => void;
}

export default function CustomerTypeManager({ open, onOpenChange, storeId, onChanged }: Props) {
  const [types, setTypes] = useState<CustomerTypeRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    const rows = await fetchCustomerTypes(storeId);
    setTypes(rows);
    setLoading(false);
    const { data: custs } = await supabase
      .from("customers")
      .select("customer_type")
      .eq("store_id", storeId)
      .limit(20000);
    const map: Record<string, number> = {};
    (custs || []).forEach((c: any) => {
      const key = (c.customer_type || "Reguler").trim();
      map[key] = (map[key] || 0) + 1;
    });
    setCounts(map);
  };

  useEffect(() => {
    if (open) load();
  }, [open, storeId]);

  const add = async () => {
    const clean = name.trim();
    if (!clean || !storeId) return;
    if (types.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      toast({ title: "Tipe sudah ada", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("customer_types")
      .insert({ store_id: storeId, name: clean, sort_order: types.length });
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menambah tipe", description: error.message, variant: "destructive" });
      return;
    }
    setName("");
    await load();
    onChanged?.();
    toast({ title: `Tipe "${clean}" ditambahkan` });
  };

  const remove = async (t: CustomerTypeRow) => {
    const { error } = await supabase.from("customer_types").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Gagal menghapus tipe", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
    toast({ title: `Tipe "${t.name}" dihapus` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola Tipe Pelanggan</DialogTitle>
          <DialogDescription>
            Tambah atau hapus tipe pelanggan untuk outlet ini. Pelanggan lama dengan tipe yang dihapus tetap tersimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nama tipe baru, mis. Langganan"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button onClick={add} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Memuat...</p>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Belum ada tipe pelanggan.</p>
          ) : (
            types.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {counts[t.name] || 0} pelanggan
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
