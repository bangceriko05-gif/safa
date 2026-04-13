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
import { Loader2, Plus, Filter, Search, ChevronLeft, ChevronRight, MoreHorizontal, DollarSign, XCircle } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

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

type StatusFilter = "all" | "unpaid" | "partial" | "paid";

const statusLabel: Record<string, string> = { unpaid: "Belum Terima", partial: "Sebagian", paid: "Lunas" };
const statusColor: Record<string, string> = {
  unpaid: "text-orange-600 bg-orange-50 border-orange-200",
  partial: "text-blue-600 bg-blue-50 border-blue-200",
  paid: "text-green-600 bg-green-50 border-green-200",
};

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
  const [editItem, setEditItem] = useState<Receivable | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: "", description: "", amount: "", due_date: "",
  });
  const [form, setForm] = useState({
    customer_name: "", description: "", amount: "", due_date: "",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState("1");

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
    fetchBankAccounts();
  }, [currentStore]);

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
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Receivable[]) || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      item.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const totalUnreceived = filteredItems.filter(i => i.status !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.received_amount)), 0);
  const totalReceived = filteredItems.reduce((s, i) => s + Number(i.received_amount), 0);

  useEffect(() => { setCurrentPage(1); setGoToPage("1"); }, [statusFilter, searchQuery, pageSize]);

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
      toast.error("Pilih rekening tujuan terlebih dahulu");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus piutang ini?")) return;
    try {
      const { error } = await supabase.from("accounts_receivable").delete().eq("id", id);
      if (error) throw error;
      toast.success("Piutang berhasil dihapus");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus piutang");
    }
  };

  const openEditForm = (item: Receivable) => {
    setEditItem(item);
    setEditForm({
      customer_name: item.customer_name,
      description: item.description || "",
      amount: String(item.amount),
      due_date: item.due_date || "",
    });
    setShowEditForm(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      const { error } = await supabase
        .from("accounts_receivable")
        .update({
          customer_name: editForm.customer_name,
          description: editForm.description || null,
          amount: Number(editForm.amount),
          due_date: editForm.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editItem.id);
      if (error) throw error;
      toast.success("Piutang berhasil diperbarui");
      setShowEditForm(false);
      setEditItem(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui piutang");
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
        <h3 className="text-lg font-semibold">Semua Piutang</h3>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Tambah Piutang
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
            placeholder="Pelanggan/Keterangan"
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
              {status === "unpaid" ? "Belum Terima" : status === "partial" ? "Sebagian" : "Lunas"}
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
                <TableHead>Pelanggan</TableHead>
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
                const sisa = Number(item.amount) - Number(item.received_amount);
                const overdue = isDueDateOverdue(item.due_date) && item.status !== "paid";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm py-4">
                      {format(new Date(item.created_at), "dd MMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="py-4">
                      {(() => {
                        const bidMatch = item.description?.match(/([A-Z]{2,}-[A-Z]+-\d{8}-\d+)/);
                        const bid = bidMatch ? bidMatch[1] : item.id.slice(0, 8).toUpperCase();
                        const descWithoutBid = item.description
                          ? item.description.replace(/\s*[A-Z]{2,}-[A-Z]+-\d{8}-\d+/, '').trim()
                          : null;
                        return (
                          <>
                            <div className="text-sm font-medium text-blue-600">{bid}</div>
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded border ${statusColor[item.status]}`}>
                              {statusLabel[item.status]}
                            </span>
                            {descWithoutBid && (
                              <div className="text-xs text-muted-foreground mt-1">{descWithoutBid}</div>
                            )}
                          </>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium">{item.customer_name}</div>
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
                            <DropdownMenuItem onClick={() => { setSelectedItem(item); setShowReceiveForm(true); }}>
                              <DollarSign className="h-4 w-4 mr-2" /> Terima
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(item.id)}>
                            <XCircle className="h-4 w-4 mr-2" /> Hapus
                          </DropdownMenuItem>
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
              <span>Belum diterima : <span className="font-semibold">{formatCurrency(totalUnreceived)}</span></span>
              <span>Diterima : <span className="font-semibold">{formatCurrency(totalReceived)}</span></span>
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

      {/* Receive Dialog */}
      <Dialog open={showReceiveForm} onOpenChange={setShowReceiveForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terima Piutang - {selectedItem?.customer_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Sisa: <span className="font-bold text-destructive">{formatCurrency(Number(selectedItem?.amount || 0) - Number(selectedItem?.received_amount || 0))}</span></p>
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
