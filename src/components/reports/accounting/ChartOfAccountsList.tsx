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
import { Loader2, Plus, Search, Filter, MoreHorizontal, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const ACCOUNT_TYPES = [
  { value: "kas_bank", label: "Kas & Bank" },
  { value: "investasi", label: "Investasi" },
  { value: "piutang", label: "Piutang" },
  { value: "persediaan", label: "Persediaan" },
  { value: "perlengkapan", label: "Perlengkapan" },
  { value: "aset_tetap", label: "Aset Tetap" },
  { value: "hutang", label: "Hutang" },
  { value: "modal", label: "Modal" },
  { value: "pendapatan", label: "Pendapatan" },
  { value: "beban", label: "Beban" },
  { value: "lainnya", label: "Lainnya" },
];

const typeColors: Record<string, string> = {
  kas_bank: "bg-blue-100 text-blue-700 border-blue-200",
  investasi: "bg-indigo-100 text-indigo-700 border-indigo-200",
  piutang: "bg-cyan-100 text-cyan-700 border-cyan-200",
  persediaan: "bg-emerald-100 text-emerald-700 border-emerald-200",
  perlengkapan: "bg-teal-100 text-teal-700 border-teal-200",
  aset_tetap: "bg-violet-100 text-violet-700 border-violet-200",
  hutang: "bg-orange-100 text-orange-700 border-orange-200",
  modal: "bg-pink-100 text-pink-700 border-pink-200",
  pendapatan: "bg-green-100 text-green-700 border-green-200",
  beban: "bg-red-100 text-red-700 border-red-200",
  lainnya: "bg-gray-100 text-gray-700 border-gray-200",
};

function getTypeLabel(value: string) {
  return ACCOUNT_TYPES.find(t => t.value === value)?.label || value;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_active: boolean;
  parent_id: string | null;
}

export default function ChartOfAccountsList() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", account_type: "kas_bank" });

  useEffect(() => {
    if (currentStore) fetchAccounts();
  }, [currentStore]);

  const fetchAccounts = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("code", { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ code: "", name: "", account_type: "kas_bank" });
    setShowForm(true);
  };

  const openEdit = (item: Account) => {
    setEditItem(item);
    setForm({ code: item.code, name: item.name, account_type: item.account_type });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    try {
      if (editItem) {
        const { error } = await supabase.from("chart_of_accounts").update({
          code: form.code, name: form.name, account_type: form.account_type,
          updated_at: new Date().toISOString(),
        }).eq("id", editItem.id);
        if (error) throw error;
        toast.success("Akun berhasil diperbarui");
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert({
          store_id: currentStore.id,
          code: form.code, name: form.name, account_type: form.account_type,
        });
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
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Akun berhasil dihapus");
      setDeleteId(null);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus akun");
    }
  };

  const filtered = accounts.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search);
    const matchType = filterType === "all" || a.account_type === filterType;
    return matchSearch && matchType;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "decimal", minimumFractionDigits: 2 }).format(amount);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Daftar Akun (Chart of Accounts)
        </h3>
        <Button onClick={openAdd} size="sm"><Plus className="mr-2 h-4 w-4" /> Tambah Akun</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau nomor akun..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Semua Klasifikasi" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Klasifikasi</SelectItem>
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                <TableHead className="w-[160px]">Klasifikasi</TableHead>
                <TableHead className="text-right w-[160px]">Saldo</TableHead>
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
              ) : filtered.map(account => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-primary text-sm">{account.code}</TableCell>
                  <TableCell className="text-primary text-sm">{account.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${typeColors[account.account_type] || typeColors.lainnya}`}>
                      {getTypeLabel(account.account_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(0)}</TableCell>
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
                        <DropdownMenuItem onClick={() => setDeleteId(account.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Akun" : "Tambah Akun"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nomor Akun</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="contoh: 11101" />
            </div>
            <div className="space-y-2">
              <Label>Nama Akun</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="contoh: Kas" />
            </div>
            <div className="space-y-2">
              <Label>Klasifikasi</Label>
              <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun?</AlertDialogTitle>
            <AlertDialogDescription>Data akun ini akan dihapus permanen.</AlertDialogDescription>
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
