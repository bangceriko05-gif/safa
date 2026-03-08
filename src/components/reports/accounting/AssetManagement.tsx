import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Package } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  category: string | null;
  purchase_date: string | null;
  purchase_price: number;
  current_value: number;
  depreciation_rate: number;
  status: string;
  notes: string | null;
}

export default function AssetManagement() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "", purchase_date: "", purchase_price: "", current_value: "", depreciation_rate: "0", notes: "",
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Asset[]) || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const purchasePrice = Number(form.purchase_price);
      const { error } = await supabase.from("assets").insert({
        store_id: currentStore.id,
        name: form.name,
        category: form.category || null,
        purchase_date: form.purchase_date || null,
        purchase_price: purchasePrice,
        current_value: Number(form.current_value) || purchasePrice,
        depreciation_rate: Number(form.depreciation_rate) || 0,
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Aset berhasil ditambahkan");
      setShowForm(false);
      setForm({ name: "", category: "", purchase_date: "", purchase_price: "", current_value: "", depreciation_rate: "0", notes: "" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan aset");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const statusLabel: Record<string, string> = { active: "Aktif", disposed: "Dibuang", sold: "Dijual" };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalValue = items.filter(i => i.status === "active").reduce((s, i) => s + Number(i.current_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Aset</h3>
          <p className="text-sm text-muted-foreground">Total nilai aset aktif: <span className="font-semibold text-blue-600">{formatCurrency(totalValue)}</span></p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Aset</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Aset</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tanggal Beli</TableHead>
                <TableHead className="text-right">Harga Beli</TableHead>
                <TableHead className="text-right">Nilai Saat Ini</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada data aset</TableCell></TableRow>
              ) : items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                  <TableCell className="text-sm">{item.category || "-"}</TableCell>
                  <TableCell className="text-sm">{item.purchase_date ? format(new Date(item.purchase_date), "d MMM yyyy", { locale: localeId }) : "-"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.purchase_price))}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(item.current_value))}</TableCell>
                  <TableCell><Badge variant={item.status === "active" ? "default" : "secondary"}>{statusLabel[item.status]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Aset</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Aset</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="contoh: AC Kamar 101" /></div>
            <div className="space-y-2"><Label>Kategori</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="contoh: Elektronik" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tanggal Beli</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Harga Beli</Label><Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nilai Saat Ini</Label><Input type="number" value={form.current_value} onChange={e => setForm({ ...form, current_value: e.target.value })} placeholder="Kosongkan = sama dengan harga beli" /></div>
              <div className="space-y-2"><Label>Depresiasi (%/tahun)</Label><Input type="number" value={form.depreciation_rate} onChange={e => setForm({ ...form, depreciation_rate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Catatan</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
