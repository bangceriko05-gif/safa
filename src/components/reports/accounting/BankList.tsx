import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Landmark, Pencil, Trash2, CreditCard, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, addMonths, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const currentMonth = value.getMonth();
  const currentYear = value.getFullYear();
  const now = new Date();

  const handlePrev = () => onChange(subMonths(value, 1));
  const handleNext = () => onChange(addMonths(value, 1));

  const selectMonth = (monthIdx: number) => {
    onChange(new Date(viewYear, monthIdx, 1));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(currentYear); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[160px] justify-center gap-2 font-medium">
            <Calendar className="h-4 w-4" />
            {format(value, "MMMM yyyy", { locale: localeId })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-3" align="center">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y - 1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">{viewYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y + 1)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const isSelected = viewYear === currentYear && idx === currentMonth;
              const isCurrent = viewYear === now.getFullYear() && idx === now.getMonth();
              return (
                <Button
                  key={name}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={`text-xs h-8 ${isCurrent && !isSelected ? "text-primary font-bold" : ""}`}
                  onClick={() => selectMonth(idx)}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
}

interface DisplayItem {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  balance: number;
  is_active: boolean;
  notes: string | null;
  source: "payment_method" | "bank_account";
}

export default function BankList() {
  const { currentStore } = useStore();
  const [pmBalances, setPmBalances] = useState<Record<string, { income: number; expense: number }>>({});
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BankAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    bank_name: "", account_name: "", account_number: "", balance: "", notes: "",
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore]);

  useEffect(() => {
    if (!currentStore) return;
    fetchPaymentMethodBalances();
  }, [currentStore, selectedDate]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [bankRes, pmRes] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select("*")
          .eq("store_id", currentStore.id)
          .order("bank_name", { ascending: true }),
        supabase
          .from("payment_methods")
          .select("*")
          .eq("store_id", currentStore.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      if (bankRes.error) throw bankRes.error;
      if (pmRes.error) throw pmRes.error;
      setBankAccounts((bankRes.data as BankAccount[]) || []);
      setPaymentMethods((pmRes.data as PaymentMethod[]) || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethodBalances = async () => {
    if (!currentStore) return;
    const startStr = format(startOfMonth(selectedDate), "yyyy-MM-dd");
    const endStr = format(endOfMonth(selectedDate), "yyyy-MM-dd");

    try {
      const [bookingsRes, incomesRes, expensesRes] = await Promise.all([
        supabase.from("bookings").select("payment_method, price, dual_payment, payment_method_2, price_2")
          .eq("store_id", currentStore.id).gte("date", startStr).lte("date", endStr).in("status", ["CI", "CO"]),
        supabase.from("incomes").select("payment_method, amount")
          .eq("store_id", currentStore.id).gte("date", startStr).lte("date", endStr),
        supabase.from("expenses").select("payment_method, amount")
          .eq("store_id", currentStore.id).gte("date", startStr).lte("date", endStr),
      ]);

      const balances: Record<string, { income: number; expense: number }> = {};
      const ensure = (key: string) => { if (!balances[key]) balances[key] = { income: 0, expense: 0 }; };

      (bookingsRes.data || []).forEach((b: any) => {
        const pm = (b.payment_method || "").trim();
        if (pm) { ensure(pm); balances[pm].income += Number(b.price) || 0; }
        if (b.dual_payment && b.payment_method_2) {
          const pm2 = b.payment_method_2.trim();
          ensure(pm2); balances[pm2].income += Number(b.price_2) || 0;
        }
      });
      (incomesRes.data || []).forEach((i: any) => {
        const pm = (i.payment_method || "").trim();
        if (pm) { ensure(pm); balances[pm].income += Number(i.amount) || 0; }
      });
      (expensesRes.data || []).forEach((e: any) => {
        const pm = (e.payment_method || "").trim();
        if (pm) { ensure(pm); balances[pm].expense += Number(e.amount) || 0; }
      });

      setPmBalances(balances);
    } catch (error) {
      console.error("Error fetching payment method balances:", error);
    }
  };

  // Combine: payment methods first (read-only), then extra bank accounts
  const displayItems: DisplayItem[] = [
    ...paymentMethods.map((pm) => ({
      id: pm.id,
      bank_name: pm.name,
      account_name: "-",
      account_number: "-",
      balance: 0,
      is_active: pm.is_active,
      notes: null,
      source: "payment_method" as const,
    })),
    ...bankAccounts.map((ba) => ({
      id: ba.id,
      bank_name: ba.bank_name,
      account_name: ba.account_name,
      account_number: ba.account_number,
      balance: ba.balance,
      is_active: ba.is_active,
      notes: ba.notes,
      source: "bank_account" as const,
    })),
  ];

  const openEdit = (item: BankAccount) => {
    setEditItem(item);
    setForm({
      bank_name: item.bank_name,
      account_name: item.account_name,
      account_number: item.account_number,
      balance: String(item.balance),
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ bank_name: "", account_name: "", account_number: "", balance: "", notes: "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editItem) {
        const { error } = await supabase.from("bank_accounts").update({
          bank_name: form.bank_name,
          account_name: form.account_name,
          account_number: form.account_number,
          balance: Number(form.balance) || 0,
          notes: form.notes || null,
          updated_at: new Date().toISOString(),
        }).eq("id", editItem.id);
        if (error) throw error;
        toast.success("Bank berhasil diperbarui");
      } else {
        const { error } = await supabase.from("bank_accounts").insert({
          store_id: currentStore.id,
          bank_name: form.bank_name,
          account_name: form.account_name,
          account_number: form.account_number,
          balance: Number(form.balance) || 0,
          notes: form.notes || null,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("Bank berhasil ditambahkan");
      }
      setShowForm(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan data bank");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Bank berhasil dihapus");
      setDeleteId(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus bank");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalBalance = displayItems.filter(i => i.is_active).reduce((s, i) => s + Number(i.balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Landmark className="h-5 w-5" /> List Bank</h3>
          <p className="text-sm text-muted-foreground">Total saldo: <span className="font-semibold text-primary">{formatCurrency(totalBalance)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker value={selectedDate} onChange={setSelectedDate} />
          <Button onClick={openAdd} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Bank</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Bank</TableHead>
                <TableHead>Nama Rekening</TableHead>
                <TableHead>No. Rekening</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data bank.</TableCell></TableRow>
              ) : displayItems.map(item => (
                <TableRow key={`${item.source}-${item.id}`}>
                  <TableCell className="font-medium text-sm">{item.bank_name}</TableCell>
                  <TableCell className="text-sm">{item.account_name}</TableCell>
                  <TableCell className="text-sm font-mono">{item.account_number}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(item.balance))}</TableCell>
                  <TableCell>
                    {item.source === "payment_method" ? (
                      <Badge variant="outline" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Metode Bayar</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1"><Landmark className="h-3 w-3" /> Akuntansi</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes || "-"}</TableCell>
                  <TableCell>
                    {item.source === "bank_account" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(bankAccounts.find(b => b.id === item.id)!)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Auto</span>
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
          <DialogHeader><DialogTitle>{editItem ? "Edit Bank" : "Tambah Bank"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Bank</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} required placeholder="contoh: BCA, BRI, Mandiri" /></div>
            <div className="space-y-2"><Label>Nama Rekening</Label><Input value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} required placeholder="Nama pemilik rekening" /></div>
            <div className="space-y-2"><Label>No. Rekening</Label><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} required placeholder="Nomor rekening" /></div>
            <div className="space-y-2"><Label>Saldo</Label><Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="0" /></div>
            <div className="space-y-2"><Label>Catatan</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" /></div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bank?</AlertDialogTitle>
            <AlertDialogDescription>Data bank ini akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
