import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Search, Filter, MoreHorizontal, Pencil, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const CLASSIFICATIONS = [
  "Kas & Bank",
  "Investasi",
  "Piutang",
  "Persediaan",
  "Biaya dibayar dimuka",
  "Perlengkapan",
  "Akumulasi penyusutan perlengkapan",
  "Aset tetap",
  "Akumulasi penyusutan aset tetap",
  "Aset lainnya",
  "Kewajiban jangka pendek",
  "Kewajiban jangka panjang",
  "Ekuitas",
  "Pendapatan",
  "Beban",
  "Pendapatan lain-lain",
  "Beban lain-lain",
];

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  classification: string;
  opening_balance: number;
  opening_balance_date: string | null;
  is_cash_account: boolean;
  is_active: boolean;
  parent_id: string | null;
  created_by: string;
}

export default function ChartOfAccountsList() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dynamicBalances, setDynamicBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [deleteItem, setDeleteItem] = useState<Account | null>(null);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    classification: "Kas & Bank",
    opening_balance: 0,
    opening_balance_date: "",
  });

  useEffect(() => {
    if (currentStore) fetchAccounts();
  }, [currentStore]);

  const fetchAccounts = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [accountsRes, assetsRes, payablesRes, receivablesRes] = await Promise.all([
        supabase
          .from("chart_of_accounts")
          .select("*")
          .eq("store_id", currentStore.id)
          .order("account_code", { ascending: true }),
        supabase
          .from("assets")
          .select("current_value, status, category")
          .eq("store_id", currentStore.id)
          .eq("status", "active"),
        supabase
          .from("accounts_payable")
          .select("amount, paid_amount, status")
          .eq("store_id", currentStore.id)
          .neq("status", "paid"),
        supabase
          .from("accounts_receivable")
          .select("amount, received_amount, status")
          .eq("store_id", currentStore.id)
          .neq("status", "paid"),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      let accountsList = (accountsRes.data as unknown as Account[]) || [];

      // Auto-seed "Hutang Usaha" account if no Kewajiban jangka pendek account exists
      const hasLiabilityAccount = accountsList.some(a => a.classification === "Kewajiban jangka pendek");
      if (!hasLiabilityAccount) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: newAccount } = await supabase
            .from("chart_of_accounts")
            .insert({
              store_id: currentStore.id,
              account_code: "21000",
              account_name: "Hutang Usaha",
              classification: "Kewajiban jangka pendek",
              created_by: user.id,
            })
            .select()
            .single();
          if (newAccount) {
            accountsList = [...accountsList, newAccount as unknown as Account];
          }
        }
      }

      setAccounts(accountsList);

      // Calculate dynamic balances by classification
      const balances: Record<string, number> = {};

      // Assets → Aset tetap & Perlengkapan
      const totalAsetTetap = (assetsRes.data || []).reduce((s, a) => s + (Number(a.current_value) || 0), 0);
      balances["Aset tetap"] = totalAsetTetap;
      balances["Perlengkapan"] = totalAsetTetap;

      // Payables → Kewajiban jangka pendek
      const totalPayable = (payablesRes.data || []).reduce(
        (s, p) => s + (Number(p.amount) - Number(p.paid_amount || 0)), 0
      );
      balances["Kewajiban jangka pendek"] = totalPayable;

      // Receivables → Piutang
      const totalReceivable = (receivablesRes.data || []).reduce(
        (s, r) => s + (Number(r.amount) - Number(r.received_amount || 0)), 0
      );
      balances["Piutang"] = totalReceivable;

      setDynamicBalances(balances);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ account_code: "", account_name: "", classification: "Kas & Bank", opening_balance: 0, opening_balance_date: "" });
    setShowForm(true);
  };

  const openEdit = (item: Account) => {
    setEditItem(item);
    setForm({
      account_code: item.account_code,
      account_name: item.account_name,
      classification: item.classification,
      opening_balance: item.opening_balance,
      opening_balance_date: item.opening_balance_date || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;

    // Check duplicate account_code
    const duplicate = accounts.find(
      (a) => a.account_code === form.account_code && a.id !== editItem?.id
    );
    if (duplicate) {
      toast.error("Nomor akun sudah digunakan di store ini");
      return;
    }

    const isCash = form.classification === "Kas & Bank";

    try {
      if (editItem) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update({
            account_code: form.account_code,
            account_name: form.account_name,
            classification: form.classification,
            opening_balance: form.opening_balance,
            opening_balance_date: form.opening_balance_date || null,
            is_cash_account: isCash,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Akun berhasil diperbarui");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("chart_of_accounts").insert({
          store_id: currentStore.id,
          account_code: form.account_code,
          account_name: form.account_name,
          classification: form.classification,
          opening_balance: form.opening_balance,
          opening_balance_date: form.opening_balance_date || null,
          is_cash_account: isCash,
          created_by: userData.user?.id,
        } as any);
        if (error) throw error;
        toast.success("Akun berhasil ditambahkan");
      }
      setShowForm(false);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan akun");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", deleteItem.id);
      if (error) throw error;
      toast.success("Akun berhasil dihapus");
      setDeleteItem(null);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus akun");
    }
  };

  const filtered = accounts.filter((a) => {
    const matchSearch =
      !search ||
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      a.account_code.includes(search);
    const matchType = filterType === "all" || a.classification === filterType;
    return matchSearch && matchType;
  });

  const getAccountBalance = (account: Account): number => {
    // For classifications with dynamic data, show opening_balance + dynamic total
    const dynamicClassifications = ["Aset tetap", "Perlengkapan", "Kewajiban jangka pendek", "Piutang"];
    if (dynamicClassifications.includes(account.classification)) {
      return account.opening_balance + (dynamicBalances[account.classification] || 0);
    }
    return account.opening_balance;
  };

  const isDepreciation = (classification: string) =>
    classification.toLowerCase().includes("penyusutan");

  const formatCurrency = (amount: number, classification: string) => {
    const displayAmount = isDepreciation(classification) ? -Math.abs(amount) : amount;
    return new Intl.NumberFormat("id-ID", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayAmount);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Daftar Akun (Chart of Accounts)
        </h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Akun
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau nomor akun..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[240px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Semua Klasifikasi" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Klasifikasi</SelectItem>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Nomor Akun</TableHead>
                <TableHead>Nama Akun</TableHead>
                <TableHead className="w-[220px]">Klasifikasi</TableHead>
                <TableHead className="text-right w-[180px]">Saldo</TableHead>
                <TableHead className="w-[60px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Belum ada data akun.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium text-primary text-sm cursor-pointer" onClick={() => openEdit(account)}>
                      {account.account_code}
                    </TableCell>
                    <TableCell className="text-primary text-sm">{account.account_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {account.classification}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${isDepreciation(account.classification) ? "text-destructive" : ""}`}>
                      {formatCurrency(getAccountBalance(account), account.classification)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(account)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteItem(account)} className="text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Akun" : "Tambah Akun"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nomor Akun</Label>
              <Input
                value={form.account_code}
                onChange={(e) => setForm({ ...form, account_code: e.target.value })}
                required
                placeholder="contoh: 11101"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Akun</Label>
              <Input
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                required
                placeholder="contoh: Kas"
              />
            </div>
            <div className="space-y-2">
              <Label>Klasifikasi</Label>
              <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo Awal</Label>
              <Input
                type="number"
                value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Saldo Awal</Label>
              <Input
                type="date"
                value={form.opening_balance_date}
                onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Simpan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong>{deleteItem?.account_name}</strong> ({deleteItem?.account_code}) akan dihapus permanen.
            </AlertDialogDescription>
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
