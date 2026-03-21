import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Filter, Search, ChevronLeft, ChevronRight, MoreHorizontal, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

const CASHFLOW_CATEGORIES = [
  { value: "pembayaran_pemasok", label: "Pembayaran ke pemasok" },
  { value: "biaya_operasional", label: "Biaya operasional" },
  { value: "biaya_perawatan", label: "Biaya perawatan" },
  { value: "pengeluaran_lain", label: "Pengeluaran lain" },
];

interface Payable {
  id: string;
  supplier_name: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  paid_amount: number;
  status: string;
  created_at: string;
  cashflow_category: string;
}

type StatusFilter = "all" | "unpaid" | "partial" | "paid";

const statusLabel: Record<string, string> = { unpaid: "Belum dibayar", partial: "Sebagian", paid: "Lunas" };
const statusColor: Record<string, string> = {
  unpaid: "text-orange-600 bg-orange-50 border-orange-200",
  partial: "text-blue-600 bg-blue-50 border-blue-200",
  paid: "text-green-600 bg-green-50 border-green-200",
};

export default function AccountsPayable() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Payable[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Payable | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({
    supplier_name: "", description: "", amount: "", due_date: "", cashflow_category: "pembayaran_pemasok",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState("1");

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

  const filteredItems = items.filter(item => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      item.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const totalUnpaid = filteredItems.filter(i => i.status !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const totalPaid = filteredItems.reduce((s, i) => s + Number(i.paid_amount), 0);

  useEffect(() => { setCurrentPage(1); setGoToPage("1"); }, [statusFilter, searchQuery, pageSize]);

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
        cashflow_category: form.cashflow_category,
      });
      if (error) throw error;
      toast.success("Hutang berhasil ditambahkan");
      setShowForm(false);
      setForm({ supplier_name: "", description: "", amount: "", due_date: "", cashflow_category: "pembayaran_pemasok" });
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
    new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const handleGoToPage = () => {
    const page = parseInt(goToPage);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setGoToPage(String(safeCurrentPage));
    }
  };

  const isDueDateOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Semua Hutang</h3>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Tambah Hutang
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filter
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Transaksi/Supplier/Deskripsi"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 w-[220px] text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["unpaid", "partial", "paid"] as const).map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              {status === "unpaid" ? "Belum Bayar" : status === "partial" ? "Sebagian" : "Lunas"}
            </Button>
          ))}
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => { setStatusFilter("all"); setSearchQuery(""); }}
          >
            <Filter className="h-3.5 w-3.5 mr-1" /> Semua
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Tanggal</TableHead>
                <TableHead className="w-[180px]">Transaksi</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right w-[140px]">Jatuh Tempo</TableHead>
                <TableHead className="w-[50px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No Data</TableCell>
                </TableRow>
              ) : paginatedItems.map(item => {
                const sisa = Number(item.amount) - Number(item.paid_amount);
                const overdue = isDueDateOverdue(item.due_date) && item.status !== "paid";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm py-4">
                      {format(new Date(item.created_at), "dd MMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-blue-600">{item.id.slice(0, 8).toUpperCase()}</div>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded border ${statusColor[item.status]}`}>
                        {statusLabel[item.status]}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium">{item.supplier_name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <div className="text-sm font-medium">{formatCurrency(Number(item.amount))}</div>
                      {item.status !== "paid" && (
                        <div className="text-xs text-orange-600 mt-0.5">Sisa : {formatCurrency(sisa)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <span className={`text-sm ${overdue ? "text-red-500 font-medium" : ""}`}>
                        {item.due_date ? format(new Date(item.due_date), "dd MMM yyyy", { locale: localeId }) : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status !== "paid" && (
                            <DropdownMenuItem onClick={() => { setSelectedItem(item); setShowPayForm(true); }}>
                              <DollarSign className="h-4 w-4 mr-2" /> Bayar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Total Row */}
          <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30 text-sm">
            <span className="font-medium">Total</span>
            <div className="flex gap-12">
              <span>Belum dibayar : <span className="font-semibold">{formatCurrency(totalUnpaid)}</span></span>
              <span>Dibayar : <span className="font-semibold">{formatCurrency(totalPaid)}</span></span>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-sm">
            <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 item</SelectItem>
                <SelectItem value="30">30 item</SelectItem>
                <SelectItem value="50">50 item</SelectItem>
                <SelectItem value="100">100 item</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total {totalItems}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => { setCurrentPage(safeCurrentPage - 1); setGoToPage(String(safeCurrentPage - 1)); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="default" size="sm" className="h-8 min-w-[32px] rounded-full">{safeCurrentPage}</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => { setCurrentPage(safeCurrentPage + 1); setGoToPage(String(safeCurrentPage + 1)); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">Go to</span>
              <Input
                className="w-[50px] h-8 text-center text-sm"
                value={goToPage}
                onChange={e => setGoToPage(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGoToPage()}
                onBlur={handleGoToPage}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Form */}
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

      {/* Pay Dialog */}
      <Dialog open={showPayForm} onOpenChange={setShowPayForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bayar Hutang - {selectedItem?.supplier_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Sisa: <span className="font-bold text-destructive">{formatCurrency(Number(selectedItem?.amount || 0) - Number(selectedItem?.paid_amount || 0))}</span></p>
            <div className="space-y-2"><Label>Jumlah Pembayaran</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required /></div>
            <Button onClick={handlePay} className="w-full">Konfirmasi Pembayaran</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
