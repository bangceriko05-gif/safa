import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Copy, FileText, CalendarIcon, ClipboardList } from "lucide-react";
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
  onOpenAddExpense?: () => void;
  onOpenCategoryManagement?: () => void;
}

export default function ExpenseTransactionView({ onOpenAddExpense, onOpenCategoryManagement }: ExpenseTransactionViewProps) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions();
  const { activeMethodNames } = usePaymentMethods();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [processTab, setProcessTab] = useState("proses");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string }[]>([]);
  const [noteDialogExpenseId, setNoteDialogExpenseId] = useState<string | null>(null);
  const [noteDialogData, setNoteDialogData] = useState<Expense | null>(null);

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
      const { error } = await supabase
        .from("expenses")
        .update({ [field]: value } as any)
        .eq("id", id);
      if (error) throw error;
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
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
              <span className="text-lg font-semibold text-red-500">Total: {formatCurrency(total)}</span>
              {onOpenCategoryManagement && (
                <Button variant="outline" onClick={onOpenCategoryManagement}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Kategori Pengeluaran
                </Button>
              )}
              {onOpenAddExpense && hasPermission("report_expense_add") && (
                <Button onClick={onOpenAddExpense} className="bg-primary">
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

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan deskripsi, kategori, BID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(total)}</span>
            <ReportDateFilter
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              customDateRange={customDateRange}
              onCustomDateRangeChange={setCustomDateRange}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <CalendarIcon className="h-4 w-4" />
              {dateRangeLabel}
            </div>
          </div>

          {/* Secondary filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Semua Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                {uniquePaymentMethods.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Semua Verifikasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Verifikasi</SelectItem>
                <SelectItem value="Verified">Verified</SelectItem>
                <SelectItem value="Unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                    <TableHead>Kategori</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Bukti Bayar</TableHead>
                    <TableHead>Verifikasi</TableHead>
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
                          <Badge variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
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
                                  : expense.status === "ditolak"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {expense.status === "selesai" ? "Selesai" : expense.status === "ditolak" ? "Ditolak" : expense.status === "disetujui" ? "Disetujui" : "Tunda"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tunda">Tunda</SelectItem>
                            <SelectItem value="disetujui">Disetujui</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                            <SelectItem value="ditolak">Ditolak</SelectItem>
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
