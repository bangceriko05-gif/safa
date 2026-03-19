import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Package, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";
import { logAccountingActivity } from "@/utils/accountingActivityLogger";

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
  created_at: string;
  bid: string | null;
}

export default function AssetManagement() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState({
    name: "", category: "", purchase_date: "", purchase_price: "", current_value: "", depreciation_rate: "0", notes: "", status: "active",
  });
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, timeRange, customDateRange]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("store_id", currentStore.id)
        .or(`purchase_date.is.null,and(purchase_date.gte.${startStr},purchase_date.lte.${endStr})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Asset[]) || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", category: "", purchase_date: "", purchase_price: "", current_value: "", depreciation_rate: "0", notes: "", status: "active" });
    setEditingAsset(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      category: asset.category || "",
      purchase_date: asset.purchase_date || "",
      purchase_price: String(asset.purchase_price),
      current_value: String(asset.current_value),
      depreciation_rate: String(asset.depreciation_rate || 0),
      notes: asset.notes || "",
      status: asset.status,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const purchasePrice = Number(form.purchase_price);

      if (editingAsset) {
        // Update existing asset
        const { error } = await supabase.from("assets").update({
          name: form.name,
          category: form.category || null,
          purchase_date: form.purchase_date || null,
          purchase_price: purchasePrice,
          current_value: Number(form.current_value) || purchasePrice,
          depreciation_rate: Number(form.depreciation_rate) || 0,
          notes: form.notes || null,
          status: form.status,
        }).eq("id", editingAsset.id);
        if (error) throw error;
        toast.success("Aset berhasil diperbarui");
        await logAccountingActivity({
          actionType: "updated",
          entityType: "Aset",
          entityId: editingAsset.id,
          description: `Memperbarui aset: ${form.name}`,
          storeId: currentStore.id,
        });
      } else {
        // Generate BID for accounting-sourced assets
        const { data: bidData } = await supabase.rpc("generate_asset_bid", { p_store_id: currentStore.id });

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
          bid: bidData || null,
        });
        if (error) throw error;
        toast.success("Aset berhasil ditambahkan");
        await logAccountingActivity({
          actionType: "created",
          entityType: "Aset",
          description: `Menambahkan aset baru: ${form.name} (BID: ${bidData || "-"})`,
          storeId: currentStore.id,
        });
      }

      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan aset");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || !currentStore) return;
    try {
      const { error } = await supabase.from("assets").delete().eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Aset berhasil dihapus");
      await logAccountingActivity({
        actionType: "deleted",
        entityType: "Aset",
        entityId: confirmDelete.id,
        description: `Menghapus aset: ${confirmDelete.name}`,
        storeId: currentStore.id,
      });
      setConfirmDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus aset");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const statusLabel: Record<string, string> = { active: "Aktif", disposed: "Dibuang", sold: "Dijual" };
  const statusVariant = (s: string) => s === "active" ? "default" as const : "secondary" as const;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalValue = items.filter(i => i.status === "active").reduce((s, i) => s + Number(i.current_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Aset</h3>
          <p className="text-sm text-muted-foreground">Total nilai aset aktif: <span className="font-semibold text-blue-600">{formatCurrency(totalValue)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button onClick={openCreateForm} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Aset</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BID</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data aset</TableCell></TableRow>
              ) : items.map(item => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/70" onClick={() => openEditForm(item)}>
                  <TableCell className="text-sm font-mono text-muted-foreground">{item.bid || "-"}</TableCell>
                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                  <TableCell className="text-sm">{item.category || "-"}</TableCell>
                  <TableCell className="text-sm">{item.purchase_date ? format(new Date(item.purchase_date), "d MMM yyyy", { locale: localeId }) : "-"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.purchase_price))}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(item.current_value))}</TableCell>
                  <TableCell><Badge variant={statusVariant(item.status)}>{statusLabel[item.status] || item.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingAsset?.bid && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                BID: <span className="font-mono font-medium">{editingAsset.bid}</span>
              </div>
            )}
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
            {editingAsset && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="sold">Dijual</SelectItem>
                    <SelectItem value="disposed">Dibuang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Catatan</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter className="flex gap-2">
              {editingAsset && (
                <Button type="button" variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); setShowForm(false); setConfirmDelete(editingAsset); }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus
                </Button>
              )}
              <Button type="submit" className="flex-1">{editingAsset ? "Simpan Perubahan" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Hapus</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus aset <strong>{confirmDelete?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
