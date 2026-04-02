import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { createAutoHutang, handleHutangOnEdit } from "@/utils/autoHutang";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Copy, FileText, CalendarIcon, ClipboardList, Settings, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "../reports/ReportDateFilter";
import { DateRange } from "react-day-picker";

interface Expense {
  id: string;
  bid: string;
  description: string;
  amount: number;
  category: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  verification_status: string;
  status: string;
  process_status: string;
  date: string;
  created_by: string;
  store_id: string;
}

const PROCESS_TABS = [
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
  { key: "batal", label: "Batal" },
  { key: "dihapus", label: "Dihapus" },
];

interface ExpenseTransactionViewProps {
  timeRange: ReportTimeRange;
  customDateRange?: DateRange;
  searchQuery: string;
}

export default function ExpenseTransactionView({ timeRange, customDateRange, searchQuery }: ExpenseTransactionViewProps) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const showVerification = isFeatureEnabled("reports.accounting");
  const { activeMethodNames } = usePaymentMethods();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [processTab, setProcessTab] = useState("proses");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string }[]>([]);
  const [noteDialogExpenseId, setNoteDialogExpenseId] = useState<string | null>(null);
  const [noteDialogData, setNoteDialogData] = useState<Expense | null>(null);

  // Add expense dialog state
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "", payment_method: "", date: format(new Date(), "yyyy-MM-dd") });
  const [managingCategories, setManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Edit expense dialog state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", category: "", payment_method: "", date: "" });

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setEditForm({
      description: expense.description || "",
      amount: formatAmountInput(String(expense.amount)),
      category: expense.category || "",
      payment_method: expense.payment_method || "",
      date: expense.date,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    if (!editForm.description.trim()) { toast.error("Deskripsi harus diisi"); return; }
    if (!editForm.amount) { toast.error("Jumlah harus diisi"); return; }
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          description: editForm.description,
          amount: parseFloat(editForm.amount.replace(/\./g, "")) || 0,
          category: editForm.category || null,
          payment_method: editForm.payment_method || null,
          date: editForm.date,
        })
        .eq("id", editingExpense.id);
      if (error) throw error;
      toast.success("Pengeluaran berhasil diperbarui");
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      toast.error("Gagal memperbarui pengeluaran");
    }
  };

  const formatAmountInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleAddExpense = async () => {
    if (!currentStore) return;
    if (!expenseForm.description.trim()) { toast.error("Deskripsi harus diisi"); return; }
    if (!expenseForm.amount) { toast.error("Jumlah harus diisi"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Anda harus login"); return; }
      const { error } = await supabase.from("expenses").insert([{
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount.replace(/\./g, "")) || 0,
        category: expenseForm.category || null,
        payment_method: expenseForm.payment_method || null,
        date: expenseForm.date,
        created_by: user.id,
        store_id: currentStore.id,
      }]);
      if (error) throw error;

      // Auto-create hutang if payment method is Hutang
      await createAutoHutang({
        paymentMethod: expenseForm.payment_method,
        amount: parseFloat(expenseForm.amount.replace(/\./g, "")) || 0,
        supplierName: expenseForm.description,
        description: `Pengeluaran - ${expenseForm.description}`,
        storeId: currentStore.id,
        userId: user.id,
      });

      toast.success("Pengeluaran berhasil ditambahkan");
      setAddingExpense(false);
      setExpenseForm({ description: "", amount: "", category: "", payment_method: "", date: format(new Date(), "yyyy-MM-dd") });
      fetchExpenses();
    } catch (error) {
      toast.error("Gagal menambahkan pengeluaran");
    }
  };

  const handleAddCategory = async () => {
    if (!currentStore || !newCategoryName.trim()) return;
    try {
      const { error } = await supabase.from("expense_categories").insert([{
        name: newCategoryName.trim(),
        store_id: currentStore.id,
      }]);
      if (error) throw error;
      toast.success("Kategori berhasil ditambahkan");
      setNewCategoryName("");
      fetchCategories();
    } catch (error) {
      toast.error("Gagal menambahkan kategori");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Kategori berhasil dihapus");
      fetchCategories();
    } catch (error) {
      toast.error("Gagal menghapus kategori");
    }
  };

  const fetchExpenses = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("store_id", currentStore.id)
        .eq("process_status", processTab)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (error) throw error;
      setExpenses((data as any[]) || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from("expense_categories")
      .select("id, name")
      .eq("store_id", currentStore.id)
      .order("name");
    setExpenseCategories(data || []);
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [currentStore, processTab, timeRange, customDateRange]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.bid?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter);
    }
    if (paymentFilter !== "all") {
      result = result.filter((e) => e.payment_method === paymentFilter);
    }
    if (verificationFilter !== "all") {
      result = result.filter((e) => e.verification_status === verificationFilter);
    }
    return result;
  }, [expenses, searchQuery, categoryFilter, paymentFilter, verificationFilter]);

  const total = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [filteredExpenses]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const updateField = async (id: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      // When status changes, also update process_status to move between tabs
      if (field === "status") {
        if (value === "tunda") updateData.process_status = "proses";
        else if (value === "selesai") updateData.process_status = "selesai";
        else if (value === "batal") updateData.process_status = "batal";
      }
      const { error } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      // If status changed, remove from current view since it moved tabs
      if (field === "status" && updateData.process_status && updateData.process_status !== processTab) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updateData } : e)));
      }
      toast.success("Data berhasil diperbarui");
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error("Gagal memperbarui data");
    }
  };

  const copyBid = (bid: string) => {
    navigator.clipboard.writeText(bid);
    toast.success("BID disalin!");
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set(expenses.map((e) => e.payment_method).filter(Boolean));
    return Array.from(methods) as string[];
  }, [expenses]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [expenses]);

  const dateRangeLabel = getDateRangeDisplay(timeRange, customDateRange);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-xl font-bold">Transaksi Pengeluaran</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-destructive">Total: {formatCurrency(total)}</span>
              <Button variant="outline" onClick={() => setManagingCategories(true)}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Kategori Pengeluaran
              </Button>
              {hasPermission("manage_expense") && (
                <Button onClick={() => setAddingExpense(true)} className="bg-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pengeluaran
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Process status tabs */}
          <Tabs value={processTab} onValueChange={setProcessTab}>
            <TabsList className="grid w-full grid-cols-4">
              {PROCESS_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>




          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Tidak ada data pengeluaran</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>BID</TableHead>
                    <TableHead>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="border-0 shadow-none p-0 h-auto font-medium text-muted-foreground hover:text-foreground">
                          <SelectValue placeholder="Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Kategori</SelectItem>
                          {uniqueCategories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>
                      <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                        <SelectTrigger className="border-0 shadow-none p-0 h-auto font-medium text-muted-foreground hover:text-foreground">
                          <SelectValue placeholder="Pembayaran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Pembayaran</SelectItem>
                          {uniquePaymentMethods.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>Bukti Bayar</TableHead>
                    {showVerification && (
                      <TableHead>
                        <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                          <SelectTrigger className="border-0 shadow-none p-0 h-auto font-medium text-muted-foreground hover:text-foreground">
                            <SelectValue placeholder="Verifikasi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Verifikasi</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Unverified">Unverified</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableHead>
                    )}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(expense.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => openEditDialog(expense)}
                          >
                            {expense.bid || '-'}
                          </Badge>
                          {expense.bid && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyBid(expense.bid)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{expense.category || '-'}</TableCell>
                      <TableCell>
                        {expense.description ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-blue-600"
                            onClick={() => {
                              setNoteDialogExpenseId(expense.id);
                              setNoteDialogData(expense);
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Lihat
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{expense.payment_method || '-'}</TableCell>
                      <TableCell>
                        {expense.payment_proof_url ? (
                          <a href={expense.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                            Lihat
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {showVerification && (
                        <TableCell>
                          <Select
                            value={expense.verification_status}
                            onValueChange={(val) => updateField(expense.id, "verification_status", val)}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <Badge
                                variant="outline"
                                className={
                                  expense.verification_status === "Verified"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-orange-50 text-orange-700 border-orange-200"
                                }
                              >
                                {expense.verification_status === "Verified" ? "✓" : "⚠"} {expense.verification_status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Unverified">Unverified</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={expense.status}
                          onValueChange={(val) => updateField(expense.id, "status", val)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <Badge
                              variant="outline"
                              className={
                                expense.status === "selesai"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : expense.status === "batal"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {expense.status === "selesai" ? "Selesai" : expense.status === "batal" ? "Batal" : "Tunda"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tunda">Tunda</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                            <SelectItem value="batal">Batal</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-500 whitespace-nowrap">
                        {formatCurrency(Number(expense.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note Dialog */}
      {noteDialogData && (
        <ExpenseNoteDialog
          expense={noteDialogData}
          onClose={() => { setNoteDialogExpenseId(null); setNoteDialogData(null); }}
        />
      )}

      {/* Add Expense Dialog */}
      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Tambah Pengeluaran</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => setManagingCategories(true)} className="mr-6">
              <Settings className="h-4 w-4 mr-1" />
              Kategori
            </Button>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Deskripsi pengeluaran" />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: formatAmountInput(e.target.value) })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {activeMethodNames.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAddExpense}>Tambah Pengeluaran</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={managingCategories} onOpenChange={setManagingCategories}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola Kategori Pengeluaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {expenseCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {expenseCategories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada kategori</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengeluaran - {editingExpense?.bid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Deskripsi pengeluaran" />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: formatAmountInput(e.target.value) })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {activeMethodNames.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>Simpan Perubahan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseNoteDialog({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Detail Pengeluaran</h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">BID:</span>
            <p className="font-mono text-sm">{expense.bid || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Deskripsi:</span>
            <p className="text-sm">{expense.description || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Kategori:</span>
            <p className="text-sm">{expense.category || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Tanggal:</span>
            <p className="text-sm">{format(new Date(expense.date), "dd MMMM yyyy", { locale: localeId })}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Total:</span>
            <p className="text-sm font-bold text-red-500">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(expense.amount)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}
