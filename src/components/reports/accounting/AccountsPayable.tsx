import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Pencil, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

interface Payable {
  id: string;
  supplier_name: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  paid_amount: number;
  status: string;
  created_at: string;
}

export default function AccountsPayable() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Payable[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Payable | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({
    supplier_name: "", description: "", amount: "", due_date: "",
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
        .from("accounts_payable")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Payable[]) || []);
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
      const { error } = await supabase.from("accounts_payable").insert({
        store_id: currentStore.id,
        supplier_name: form.supplier_name,
        description: form.description || null,
        amount: Number(form.amount),
        due_date: form.due_date || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Hutang berhasil ditambahkan");
      setShowForm(false);
      setForm({ supplier_name: "", description: "", amount: "", due_date: "" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan hutang");
    }
  };

  const handlePay = async () => {
    if (!selectedItem) return;
    const amount = Number(payAmount);
    if (amount <= 0) return;
    try {
      const newPaid = Number(selectedItem.paid_amount) + amount;
      const newStatus = newPaid >= Number(selectedItem.amount) ? "paid" : "partial";
      const { error } = await supabase
        .from("accounts_payable")
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedItem.id);
      if (error) throw error;
      toast.success("Pembayaran berhasil dicatat");
      setShowPayForm(false);
      setPayAmount("");
      setSelectedItem(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal mencatat pembayaran");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const statusLabel: Record<string, string> = { unpaid: "Belum Bayar", partial: "Sebagian", paid: "Lunas" };
  const statusVariant = (s: string) => s === "paid" ? "default" : s === "partial" ? "secondary" : "destructive";

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalUnpaid = items.filter(i => i.status !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Hutang</h3>
          <p className="text-sm text-muted-foreground">Total belum dibayar: <span className="font-semibold text-red-600">{formatCurrency(totalUnpaid)}</span></p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Hutang</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Dibayar</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada data hutang</TableCell></TableRow>
              ) : items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.supplier_name}</TableCell>
                  <TableCell className="text-sm">{item.description || "-"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.amount))}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.paid_amount))}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-red-600">{formatCurrency(Number(item.amount) - Number(item.paid_amount))}</TableCell>
                  <TableCell className="text-sm">{item.due_date ? format(new Date(item.due_date), "d MMM yyyy", { locale: localeId }) : "-"}</TableCell>
                  <TableCell><Badge variant={statusVariant(item.status) as any}>{statusLabel[item.status]}</Badge></TableCell>
                  <TableCell>
                    {item.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedItem(item); setShowPayForm(true); }}>
                        <DollarSign className="h-3.5 w-3.5 mr-1" /> Bayar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Hutang</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Supplier</Label><Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Keterangan</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Jumlah</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Jatuh Tempo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayForm} onOpenChange={setShowPayForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bayar Hutang - {selectedItem?.supplier_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Sisa: <span className="font-bold text-red-600">{formatCurrency(Number(selectedItem?.amount || 0) - Number(selectedItem?.paid_amount || 0))}</span></p>
            <div className="space-y-2"><Label>Jumlah Pembayaran</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required /></div>
            <Button onClick={handlePay} className="w-full">Konfirmasi Pembayaran</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
