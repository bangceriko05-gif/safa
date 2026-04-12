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
import { Loader2, Plus, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

interface Receivable {
  id: string;
  customer_name: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  received_amount: number;
  status: string;
  created_at: string;
}

export default function AccountsReceivable() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Receivable[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Receivable | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveBank, setReceiveBank] = useState("");
  const [bankAccounts, setBankAccounts] = useState<{ id: string; bank_name: string; account_name: string }[]>([]);
  const [form, setForm] = useState({
    customer_name: "", description: "", amount: "", due_date: "",
  });
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
    fetchBankAccounts();
  }, [currentStore, timeRange, customDateRange]);

  const fetchBankAccounts = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from("bank_accounts")
      .select("id, bank_name, account_name")
      .eq("store_id", currentStore.id)
      .eq("is_active", true)
      .order("bank_name");
    setBankAccounts(data || []);
  };

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("*")
        .eq("store_id", currentStore.id)
        .gte("created_at", format(startDate, "yyyy-MM-dd'T'00:00:00"))
        .lte("created_at", format(endDate, "yyyy-MM-dd'T'23:59:59"))
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Receivable[]) || []);
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
      const { error } = await supabase.from("accounts_receivable").insert({
        store_id: currentStore.id,
        customer_name: form.customer_name,
        description: form.description || null,
        amount: Number(form.amount),
        due_date: form.due_date || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Piutang berhasil ditambahkan");
      setShowForm(false);
      setForm({ customer_name: "", description: "", amount: "", due_date: "" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan piutang");
    }
  };

  const handleReceive = async () => {
    if (!selectedItem) return;
    const amount = Number(receiveAmount);
    if (amount <= 0) return;
    if (!receiveBank) {
      toast.error("Pilih sumber rekening terlebih dahulu");
      return;
    }
    try {
      const newReceived = Number(selectedItem.received_amount) + amount;
      const newStatus = newReceived >= Number(selectedItem.amount) ? "paid" : "partial";
      const { error } = await supabase
        .from("accounts_receivable")
        .update({ received_amount: newReceived, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedItem.id);
      if (error) throw error;
      toast.success("Penerimaan berhasil dicatat");
      setShowReceiveForm(false);
      setReceiveAmount("");
      setReceiveBank("");
      setSelectedItem(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal mencatat penerimaan");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const statusLabel: Record<string, string> = { unpaid: "Belum Terima", partial: "Sebagian", paid: "Lunas" };
  const statusVariant = (s: string) => s === "paid" ? "default" : s === "partial" ? "secondary" : "destructive";

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalOutstanding = items.filter(i => i.status !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.received_amount)), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Piutang</h3>
          <p className="text-sm text-muted-foreground">Total belum diterima: <span className="font-semibold text-amber-600">{formatCurrency(totalOutstanding)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button onClick={() => setShowForm(true)} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Piutang</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Diterima</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada data piutang</TableCell></TableRow>
              ) : items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.customer_name}</TableCell>
                  <TableCell className="text-sm">{item.description || "-"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.amount))}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(item.received_amount))}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-amber-600">{formatCurrency(Number(item.amount) - Number(item.received_amount))}</TableCell>
                  <TableCell className="text-sm">{item.due_date ? format(new Date(item.due_date), "d MMM yyyy", { locale: localeId }) : "-"}</TableCell>
                  <TableCell><Badge variant={statusVariant(item.status) as any}>{statusLabel[item.status]}</Badge></TableCell>
                  <TableCell>
                    {item.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedItem(item); setShowReceiveForm(true); }}>
                        <DollarSign className="h-3.5 w-3.5 mr-1" /> Terima
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
          <DialogHeader><DialogTitle>Tambah Piutang</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Pelanggan</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Keterangan</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Jumlah</Label><Input value={form.amount ? Number(form.amount).toLocaleString("id-ID") : ""} onChange={e => { const raw = e.target.value.replace(/\./g, "").replace(/[^0-9]/g, ""); setForm({ ...form, amount: raw }); }} required placeholder="0" /></div>
            <div className="space-y-2"><Label>Jatuh Tempo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiveForm} onOpenChange={setShowReceiveForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terima Piutang - {selectedItem?.customer_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Sisa: <span className="font-bold text-amber-600">{formatCurrency(Number(selectedItem?.amount || 0) - Number(selectedItem?.received_amount || 0))}</span></p>
            <div className="space-y-2"><Label>Jumlah Penerimaan</Label><Input value={receiveAmount ? Number(receiveAmount).toLocaleString("id-ID") : ""} onChange={e => { const raw = e.target.value.replace(/\./g, "").replace(/[^0-9]/g, ""); setReceiveAmount(raw); }} required /></div>
            <div className="space-y-2">
              <Label>Masuk ke Rekening</Label>
              <Select value={receiveBank} onValueChange={setReceiveBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rekening tujuan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Kas (Cash)</SelectItem>
                  {bankAccounts.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.bank_name} - {bank.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleReceive} className="w-full">Konfirmasi Penerimaan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
