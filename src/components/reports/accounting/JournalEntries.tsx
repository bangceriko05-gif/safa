import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, BookOpen, Search, FileSpreadsheet, ChevronDown, ArrowUpDown, CalendarIcon, ChevronsLeft, ChevronsRight, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { exportMultipleSheets } from "@/utils/reportExport";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import BookingModal from "@/components/BookingModal";

type JournalType = "penjualan" | "pemasukan" | "pengeluaran";
type SortDirection = "asc" | "desc";
type DateFilterMode = "today" | "custom" | "month";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

interface JournalRow {
  id: string;
  bid: string;
  type: JournalType;
  date: string;
  description: string;
  paymentMethod: string;
  amountIn: number;
  amountOut: number;
  rawData?: any;
}

const TYPE_LABELS: Record<JournalType, string> = {
  penjualan: "Penjualan",
  pemasukan: "Pemasukan",
  pengeluaran: "Pengeluaran",
};

const TYPE_COLORS: Record<JournalType, string> = {
  penjualan: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pemasukan: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  pengeluaran: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

function MonthPickerButton({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const currentMonth = value.getMonth();
  const currentYear = value.getFullYear();
  const now = new Date();

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(currentYear); }}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm" className="gap-2">
          Bulan ({format(value, "MMM yyyy", { locale: localeId })})
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3 pointer-events-auto" align="center">
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
                onClick={() => {
                  onChange(new Date(viewYear, idx, 1));
                  setOpen(false);
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Determine if booking is nightly (daily) based on heuristics */
function isNightlyBooking(b: any): boolean {
  // Check variant booking_duration_type if available
  if (b.variant?.booking_duration_type === 'days') return true;
  // OTA bookings are typically nightly
  if (b.ota_source) return true;
  // Standard PMS pattern: 14:00 check-in, 12:00 check-out
  const start = b.start_time?.substring(0, 5);
  const end = b.end_time?.substring(0, 5);
  if (start === '14:00' && end === '12:00') return true;
  return false;
}

function buildBookingDescription(b: any): string {
  if (isNightlyBooking(b)) {
    const checkIn = format(new Date(b.date), "dd/MM/yyyy");
    const duration = Number(b.duration) || 1;
    const checkOutDate = addDays(new Date(b.date), duration);
    const checkOut = format(checkOutDate, "dd/MM/yyyy");
    return `Booking ${b.customer_name} (${checkIn} - ${checkOut}, ${duration} malam)`;
  }
  // Hourly booking - show time
  const timeStr = b.start_time && b.end_time
    ? ` (${b.start_time?.substring(0, 5)} - ${b.end_time?.substring(0, 5)}, ${b.duration} jam)`
    : "";
  return `Booking ${b.customer_name}${timeStr}`;
}

export default function JournalEntries() {
  const { currentStore } = useStore();
  const { methods: paymentMethods } = usePaymentMethods();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterMode, setFilterMode] = useState<DateFilterMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>();
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Edit states
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editingIncome, setEditingIncome] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "", payment_method: "" });
  const [incomeForm, setIncomeForm] = useState({ description: "", amount: "", customer_name: "", payment_method: "" });
  const [userId, setUserId] = useState<string>("");
  const [expenseCategories, setExpenseCategories] = useState<{id: string; name: string}[]>([]);

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Fetch expense categories
  useEffect(() => {
    if (!currentStore) return;
    supabase.from("expense_categories").select("id, name").eq("store_id", currentStore.id)
      .then(({ data }) => { if (data) setExpenseCategories(data); });
  }, [currentStore]);

  const paymentMethodOptions = useMemo(() => {
    return paymentMethods.filter(m => m.is_active).map(m => m.name);
  }, [paymentMethods]);

  // Compute date range based on filter mode
  const { startDate, endDate } = useMemo(() => {
    if (filterMode === "today") {
      const today = new Date();
      return { startDate: today, endDate: today };
    }
    if (filterMode === "custom" && customDateRange?.from) {
      return { startDate: customDateRange.from, endDate: customDateRange.to || customDateRange.from };
    }
    return { startDate: startOfMonth(selectedMonth), endDate: endOfMonth(selectedMonth) };
  }, [filterMode, selectedMonth, customDateRange]);

  const dateDisplay = useMemo(() => {
    if (filterMode === "today") return format(new Date(), "d MMMM yyyy", { locale: localeId });
    if (filterMode === "custom" && customDateRange?.from) {
      if (customDateRange.to) {
        return `${format(customDateRange.from, "dd MMM", { locale: localeId })} - ${format(customDateRange.to, "dd MMM yyyy", { locale: localeId })}`;
      }
      return format(customDateRange.from, "d MMMM yyyy", { locale: localeId });
    }
    return `${format(startOfMonth(selectedMonth), "dd MMM", { locale: localeId })} - ${format(endOfMonth(selectedMonth), "dd MMM yyyy", { locale: localeId })}`;
  }, [filterMode, selectedMonth, customDateRange]);

  useEffect(() => {
    if (!currentStore) return;
    fetchAll();
  }, [currentStore, startDate, endDate]);

  const fetchAll = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [bookingsRes, incomesRes, expensesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, bid, date, customer_name, phone, start_time, end_time, duration, variant_id, ota_source, payment_method, price, reference_no, status, room_id, store_id, note, payment_status, discount_type, discount_value, discount_applies_to, dual_payment, payment_method_2, price_2, reference_no_2, checked_in_at, checked_in_by, checked_out_at, checked_out_by, confirmed_at, confirmed_by, created_by, payment_proof_url, ota_booking_id")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .in("status", ["CI", "CO"]),
        supabase
          .from("incomes")
          .select("id, bid, date, description, customer_name, payment_method, amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("expenses")
          .select("id, bid, date, description, category, payment_method, amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
      ]);

      // Fetch variant info for bookings to determine duration type
      const variantIds = (bookingsRes.data || []).map((b: any) => b.variant_id).filter(Boolean);
      let variantMap: Record<string, any> = {};
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from("room_variants")
          .select("id, booking_duration_type")
          .in("id", variantIds);
        if (variants) {
          variants.forEach((v: any) => { variantMap[v.id] = v; });
        }
      }

      const journalRows: JournalRow[] = [];

      (bookingsRes.data || []).forEach((b: any) => {
        const enriched = { ...b, variant: b.variant_id ? variantMap[b.variant_id] : null };
        journalRows.push({
          id: b.id,
          bid: b.bid || b.reference_no || "-",
          type: "penjualan",
          date: b.date,
          description: buildBookingDescription(enriched),
          paymentMethod: b.payment_method || "-",
          amountIn: Number(b.price) || 0,
          amountOut: 0,
          rawData: b,
        });
      });

      (incomesRes.data || []).forEach((i: any) => {
        journalRows.push({
          id: i.id,
          bid: i.bid || "-",
          type: "pemasukan",
          date: i.date,
          description: i.description || `Pemasukan ${i.customer_name || ""}`.trim(),
          paymentMethod: i.payment_method || "-",
          amountIn: Number(i.amount) || 0,
          amountOut: 0,
          rawData: i,
        });
      });

      (expensesRes.data || []).forEach((e: any) => {
        journalRows.push({
          id: e.id,
          bid: e.bid || "-",
          type: "pengeluaran",
          date: e.date,
          description: e.description || `Pengeluaran ${e.category || ""}`.trim(),
          paymentMethod: e.payment_method || "-",
          amountIn: 0,
          amountOut: Number(e.amount) || 0,
          rawData: e,
        });
      });

      setRows(journalRows);
    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle BID click
  const handleBidClick = (row: JournalRow) => {
    if (row.type === "penjualan" && row.rawData) {
      setEditingBooking(row.rawData);
      setBookingModalOpen(true);
    } else if (row.type === "pengeluaran" && row.rawData) {
      const e = row.rawData;
      setEditingExpense(e);
      setExpenseForm({
        description: e.description || "",
        amount: String(e.amount || ""),
        category: e.category || "",
        payment_method: e.payment_method || "",
      });
    } else if (row.type === "pemasukan" && row.rawData) {
      const i = row.rawData;
      setEditingIncome(i);
      setIncomeForm({
        description: i.description || "",
        amount: String(i.amount || ""),
        customer_name: i.customer_name || "",
        payment_method: i.payment_method || "",
      });
    }
  };

  // Save expense
  const handleSaveExpense = async () => {
    if (!editingExpense) return;
    try {
      const amount = parseFloat(expenseForm.amount.replace(/[^0-9.-]/g, ""));
      const { error } = await supabase.from("expenses").update({
        description: expenseForm.description,
        amount,
        category: expenseForm.category,
        payment_method: expenseForm.payment_method,
      }).eq("id", editingExpense.id);
      if (error) throw error;
      toast.success("Pengeluaran berhasil diperbarui");
      setEditingExpense(null);
      fetchAll();
    } catch (error) {
      toast.error("Gagal menyimpan perubahan");
    }
  };

  // Save income
  const handleSaveIncome = async () => {
    if (!editingIncome) return;
    try {
      const amount = parseFloat(incomeForm.amount.replace(/[^0-9.-]/g, ""));
      const { error } = await supabase.from("incomes").update({
        description: incomeForm.description,
        amount,
        customer_name: incomeForm.customer_name,
        payment_method: incomeForm.payment_method,
      }).eq("id", editingIncome.id);
      if (error) throw error;
      toast.success("Pemasukan berhasil diperbarui");
      setEditingIncome(null);
      fetchAll();
    } catch (error) {
      toast.error("Gagal menyimpan perubahan");
    }
  };

  // Delete expense
  const handleDeleteExpense = async () => {
    if (!editingExpense) return;
    if (!confirm("Yakin ingin menghapus pengeluaran ini?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", editingExpense.id);
      if (error) throw error;
      toast.success("Pengeluaran berhasil dihapus");
      setEditingExpense(null);
      fetchAll();
    } catch (error) {
      toast.error("Gagal menghapus");
    }
  };

  // Delete income
  const handleDeleteIncome = async () => {
    if (!editingIncome) return;
    if (!confirm("Yakin ingin menghapus pemasukan ini?")) return;
    try {
      const { error } = await supabase.from("incomes").delete().eq("id", editingIncome.id);
      if (error) throw error;
      toast.success("Pemasukan berhasil dihapus");
      setEditingIncome(null);
      fetchAll();
    } catch (error) {
      toast.error("Gagal menghapus");
    }
  };

  const formatAmountInput = (val: string) => {
    return val.replace(/[^0-9]/g, "");
  };

  // Filter + sort
  const filteredRows = useMemo(() => {
    let result = rows;
    if (typeFilter !== "all") {
      result = result.filter((r) => r.type === typeFilter);
    }
    if (paymentMethodFilter !== "all") {
      result = result.filter((r) => r.paymentMethod.toLowerCase() === paymentMethodFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.bid.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.paymentMethod.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.bid.localeCompare(b.bid);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return result;
  }, [rows, searchQuery, sortDirection, paymentMethodFilter, typeFilter]);

  // Running balance
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return filteredRows.map((r) => {
      balance += r.amountIn - r.amountOut;
      return { ...r, balance };
    });
  }, [filteredRows]);

  // Summary
  const totalIn = filteredRows.reduce((s, r) => s + r.amountIn, 0);
  const totalOut = filteredRows.reduce((s, r) => s + r.amountOut, 0);
  const finalBalance = totalIn - totalOut;
  const totalTransactions = filteredRows.length;

  // Unique payment methods from data
  const uniquePaymentMethods = useMemo(() => {
    const set = new Set(rows.map((r) => r.paymentMethod).filter((m) => m && m !== "-"));
    return Array.from(set).sort();
  }, [rows]);

  // Export
  const handleExport = (type: "all" | "penjualan" | "pemasukan" | "pengeluaran") => {
    const dataToExport = type === "all" ? rowsWithBalance : rowsWithBalance.filter((r) => r.type === type);
    const periodLabel = `${format(startDate, "dd-MM-yyyy")} s/d ${format(endDate, "dd-MM-yyyy")}`;

    const summarySheet = [
      { Keterangan: "Total Uang Masuk", Nilai: totalIn },
      { Keterangan: "Total Uang Keluar", Nilai: totalOut },
      { Keterangan: "Saldo Akhir", Nilai: finalBalance },
      { Keterangan: "Jumlah Transaksi", Nilai: totalTransactions },
      { Keterangan: "Periode", Nilai: periodLabel },
    ];

    const detailSheet = dataToExport.map((r, idx) => ({
      No: idx + 1,
      BID: r.bid,
      Tipe: TYPE_LABELS[r.type],
      Tanggal: format(new Date(r.date), "dd/MM/yyyy"),
      Keterangan: r.description,
      "Metode Bayar": r.paymentMethod,
      "Uang Masuk": r.amountIn || "",
      "Uang Keluar": r.amountOut || "",
      Saldo: r.balance,
    }));

    const sheets = [
      { name: "Ringkasan", data: summarySheet },
      { name: type === "all" ? "Jurnal Umum" : TYPE_LABELS[type], data: detailSheet },
    ];

    const typeName = type === "all" ? "Jurnal-Umum" : TYPE_LABELS[type];
    exportMultipleSheets(sheets, `${typeName}_${format(startDate, "yyyyMMdd")}-${format(endDate, "yyyyMMdd")}`);
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
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Jurnal Umum
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("all")}>Semua</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("penjualan")}>Penjualan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pemasukan")}>Pemasukan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pengeluaran")}>Pengeluaran</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Date filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-sm text-muted-foreground border rounded-md px-3 py-1.5">
              <CalendarIcon className="h-4 w-4" />
              <span>{dateDisplay}</span>
            </div>

            <Button
              variant={filterMode === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("today")}
            >
              Hari ini
            </Button>

            <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={filterMode === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterMode("custom");
                    setPendingDateRange(customDateRange);
                    setShowCustomPicker(true);
                  }}
                >
                  Sesuaikan
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col">
                  <Calendar
                    mode="range"
                    selected={pendingDateRange}
                    onSelect={setPendingDateRange}
                    defaultMonth={pendingDateRange?.from || new Date()}
                    initialFocus
                    numberOfMonths={2}
                    locale={localeId}
                    className={cn("p-3 pointer-events-auto")}
                  />
                  <div className="flex justify-end p-3 pt-0 border-t">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (pendingDateRange?.from) {
                          setCustomDateRange(pendingDateRange);
                          setFilterMode("custom");
                          setShowCustomPicker(false);
                        }
                      }}
                      disabled={!pendingDateRange?.from}
                    >
                      OK
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <MonthPickerButton
              value={selectedMonth}
              onChange={(d) => {
                setSelectedMonth(d);
                setFilterMode("month");
              }}
            />
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari BID, keterangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Uang Masuk</p>
              <p className="text-sm font-bold text-green-600">{formatCurrency(totalIn)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Uang Keluar</p>
              <p className="text-sm font-bold text-destructive">{formatCurrency(totalOut)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Saldo Akhir</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(finalBalance)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Jumlah Transaksi</p>
              <p className="text-sm font-bold">{totalTransactions}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <TableHead className="text-primary-foreground w-12">#</TableHead>
                  <TableHead className="text-primary-foreground">
                    <button
                      className="flex items-center gap-1 hover:opacity-80"
                      onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                    >
                      BID <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-primary-foreground">Tanggal</TableHead>
                  <TableHead className="text-primary-foreground">Keterangan</TableHead>
                  <TableHead className="text-primary-foreground">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 hover:opacity-80">
                          Metode Bayar
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[180px] p-1 pointer-events-auto" align="start">
                        <button
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent",
                            paymentMethodFilter === "all" && "font-semibold bg-accent"
                          )}
                          onClick={() => setPaymentMethodFilter("all")}
                        >
                          Semua Metode
                        </button>
                        {uniquePaymentMethods.map((m) => (
                          <button
                            key={m}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent",
                              paymentMethodFilter === m && "font-semibold bg-accent"
                            )}
                            onClick={() => setPaymentMethodFilter(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                  <TableHead className="text-primary-foreground text-right">Uang Masuk</TableHead>
                  <TableHead className="text-primary-foreground text-right">Uang Keluar</TableHead>
                  <TableHead className="text-primary-foreground text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithBalance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Tidak ada transaksi pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  rowsWithBalance.map((row, idx) => (
                    <TableRow key={`${row.type}-${row.id}`}>
                      <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <button
                            className="text-xs font-mono leading-tight break-all text-primary hover:underline cursor-pointer text-left"
                            onClick={() => handleBidClick(row)}
                          >
                            {row.bid}
                          </button>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[row.type]}`}>
                            {TYPE_LABELS[row.type]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(row.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        <p className="truncate">{row.description}</p>
                      </TableCell>
                      <TableCell className="text-sm">{row.paymentMethod}</TableCell>
                      <TableCell className="text-sm text-right font-medium text-green-600">
                        {row.amountIn > 0 ? formatCurrency(row.amountIn) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium text-destructive">
                        {row.amountOut > 0 ? formatCurrency(row.amountOut) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium whitespace-nowrap">
                        {formatCurrency(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Booking Edit Modal */}
      {userId && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => {
            setBookingModalOpen(false);
            setEditingBooking(null);
            fetchAll();
          }}
          selectedDate={editingBooking ? new Date(editingBooking.date) : new Date()}
          selectedSlot={null}
          editingBooking={editingBooking}
          userId={userId}
        />
      )}

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengeluaran {editingExpense?.bid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: formatAmountInput(e.target.value) })} />
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
                  {paymentMethodOptions.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveExpense}>Simpan</Button>
              <Button variant="destructive" onClick={handleDeleteExpense}>
                <Trash2 className="h-4 w-4 mr-1" /> Hapus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Income Dialog */}
      <Dialog open={!!editingIncome} onOpenChange={(open) => !open && setEditingIncome(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pemasukan {editingIncome?.bid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Pelanggan</Label>
              <Input value={incomeForm.customer_name} onChange={(e) => setIncomeForm({ ...incomeForm, customer_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: formatAmountInput(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Metode Bayar</Label>
              <Select value={incomeForm.payment_method} onValueChange={(v) => setIncomeForm({ ...incomeForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Input value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveIncome}>Simpan</Button>
              <Button variant="destructive" onClick={handleDeleteIncome}>
                <Trash2 className="h-4 w-4 mr-1" /> Hapus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
