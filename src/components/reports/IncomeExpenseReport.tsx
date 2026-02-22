import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { TrendingUp, TrendingDown, DollarSign, Download, Printer, Copy } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { 
  exportToExcel, 
  getExportFileName,
  formatCurrencyPlain
} from "@/utils/reportExport";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseData {
  id: string;
  bid: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string;
  payment_proof_url?: string;
  date: string;
  created_at: string;
  created_by: string;
  creator_name: string;
}

interface IncomeData {
  id: string;
  bid: string;
  description: string;
  amount: number;
  customer_name: string;
  payment_method: string;
  date: string;
  created_at: string;
  created_by: string;
  creator_name: string;
  products: { product_name: string; quantity: number; subtotal: number }[];
}

interface DetailPopup {
  type: 'expense_category' | 'expense_method' | 'income_method';
  label: string;
}

interface IncomeExpenseReportProps {
  initialTab?: "expenses" | "incomes";
}

export default function IncomeExpenseReport({ initialTab }: IncomeExpenseReportProps = {}) {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [incomes, setIncomes] = useState<IncomeData[]>([]);
  const [detailPopup, setDetailPopup] = useState<DetailPopup | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseData | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeData | null>(null);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "", payment_method: "" });
  const [incomeForm, setIncomeForm] = useState({ description: "", amount: "", customer_name: "", payment_method: "" });
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({
    totalExpenses: 0,
    totalIncomes: 0,
    netProfit: 0,
    expenseCategories: [] as { category: string; total: number; count: number }[],
    expensePaymentMethods: [] as { method: string; total: number }[],
    incomePaymentMethods: [] as { method: string; total: number }[],
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
    fetchExpenseCategories();
  }, [timeRange, customDateRange, currentStore]);

  const fetchExpenseCategories = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from("expense_categories")
      .select("id, name")
      .eq("store_id", currentStore.id)
      .order("name");
    setExpenseCategories(data || []);
  };

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const [expensesResult, incomesResult] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false }),
        supabase
          .from("incomes")
          .select("*")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false }),
      ]);

      if (expensesResult.error) throw expensesResult.error;
      if (incomesResult.error) throw incomesResult.error;

      const expensesData = expensesResult.data || [];
      const incomesData = incomesResult.data || [];

      // Get creator profiles
      const creatorIds = Array.from(
        new Set([
          ...expensesData.map((e) => e.created_by),
          ...incomesData.map((i) => i.created_by),
        ].filter(Boolean))
      );

      let profilesById: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", creatorIds);
        if (profiles) {
          profilesById = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        }
      }

      // Fetch income products for all incomes
      const incomeIds = incomesData.map(i => i.id);
      let incomeProductsMap: Record<string, { product_name: string; quantity: number; subtotal: number }[]> = {};
      
      if (incomeIds.length > 0) {
        const { data: incomeProducts } = await supabase
          .from("income_products")
          .select("income_id, product_name, quantity, subtotal")
          .in("income_id", incomeIds);
        
        if (incomeProducts) {
          incomeProducts.forEach(ip => {
            if (!incomeProductsMap[ip.income_id]) {
              incomeProductsMap[ip.income_id] = [];
            }
            incomeProductsMap[ip.income_id].push({
              product_name: ip.product_name,
              quantity: ip.quantity,
              subtotal: ip.subtotal,
            });
          });
        }
      }

      const mappedExpenses: ExpenseData[] = expensesData.map((e) => ({
        id: e.id,
        bid: e.bid || '-',
        description: e.description,
        amount: Number(e.amount) || 0,
        category: e.category || "Lainnya",
        payment_method: e.payment_method || "-",
        payment_proof_url: e.payment_proof_url || undefined,
        date: e.date,
        created_at: e.created_at,
        created_by: e.created_by,
        creator_name: profilesById[e.created_by] || "Unknown",
      }));

      const mappedIncomes: IncomeData[] = incomesData.map((i) => ({
        id: i.id,
        bid: i.bid || '-',
        description: i.description || "",
        amount: Number(i.amount) || 0,
        customer_name: i.customer_name || "",
        payment_method: i.payment_method || "Lainnya",
        date: i.date,
        created_at: i.created_at,
        created_by: i.created_by,
        creator_name: profilesById[i.created_by] || "Unknown",
        products: incomeProductsMap[i.id] || [],
      }));

      // Calculate stats
      const totalExpenses = mappedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalIncomes = mappedIncomes.reduce((sum, i) => sum + i.amount, 0);

      // Expense categories
      const expenseByCategory: { [key: string]: number } = {};
      mappedExpenses.forEach((e) => {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
      });

      // Expense by payment method
      const expenseByMethod: { [key: string]: number } = {};
      mappedExpenses.forEach((e) => {
        expenseByMethod[e.payment_method] = (expenseByMethod[e.payment_method] || 0) + e.amount;
      });

      // Income by payment method
      const incomeByMethod: { [key: string]: number } = {};
      mappedIncomes.forEach((i) => {
        incomeByMethod[i.payment_method] = (incomeByMethod[i.payment_method] || 0) + i.amount;
      });

      setExpenses(mappedExpenses);
      setIncomes(mappedIncomes);
      setStats({
        totalExpenses,
        totalIncomes,
        netProfit: totalIncomes - totalExpenses,
        expenseCategories: Object.entries(expenseByCategory).map(([category, total]) => ({
          category,
          total,
          count: mappedExpenses.filter(e => e.category === category).length,
        })).sort((a, b) => b.total - a.total),
        expensePaymentMethods: Object.entries(expenseByMethod).map(([method, total]) => ({ method, total })),
        incomePaymentMethods: Object.entries(incomeByMethod).map(([method, total]) => ({ method, total })),
      });
    } catch (error) {
      console.error("Error fetching income/expense data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatExpenseAmount = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleEditExpenseClick = (expense: ExpenseData) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      category: expense.category,
      payment_method: expense.payment_method === '-' ? '' : expense.payment_method,
    });
  };

  const handleSaveExpense = async () => {
    if (!editingExpense) return;
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount.replace(/\./g, "")) || 0,
          category: expenseForm.category,
          payment_method: expenseForm.payment_method || null,
        })
        .eq("id", editingExpense.id);
      if (error) throw error;
      toast.success("Pengeluaran berhasil diperbarui");
      setEditingExpense(null);
      fetchData();
    } catch (error) {
      toast.error("Gagal memperbarui pengeluaran");
    }
  };

  const handleEditIncomeClick = (income: IncomeData) => {
    setEditingIncome(income);
    setIncomeForm({
      description: income.description,
      amount: income.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      customer_name: income.customer_name,
      payment_method: income.payment_method === 'Lainnya' ? '' : income.payment_method,
    });
  };

  const handleSaveIncome = async () => {
    if (!editingIncome) return;
    try {
      const { error } = await supabase
        .from("incomes")
        .update({
          description: incomeForm.description || null,
          amount: parseFloat(incomeForm.amount.replace(/\./g, "")) || 0,
          customer_name: incomeForm.customer_name,
          payment_method: incomeForm.payment_method || null,
        })
        .eq("id", editingIncome.id);
      if (error) throw error;
      toast.success("Pemasukan berhasil diperbarui");
      setEditingIncome(null);
      fetchData();
    } catch (error) {
      toast.error("Gagal memperbarui pemasukan");
    }
  };

  const handlePrintExpense = (expense: ExpenseData) => {
    window.open(`/receipt/transaction?id=${expense.id}&type=expense`, '_blank');
  };

  const handlePrintIncome = (income: IncomeData) => {
    window.open(`/receipt/transaction?id=${income.id}&type=income`, '_blank');
  };

  const handleExportIncomeDetail = () => {
    if (!currentStore || incomes.length === 0) return;
    
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    
    // Export pemasukan detail: BID, jam & tanggal pembuatan, nama pelanggan, metode bayar, jumlah, produk, deskripsi
    const incomeDetailData: Record<string, unknown>[] = [];
    
    incomes.forEach(income => {
      const createdAtDate = new Date(income.created_at);
      const productsText = income.products.length > 0 
        ? income.products.map(p => `${p.product_name} (${p.quantity}x Rp ${formatCurrencyPlain(p.subtotal)})`).join(', ')
        : '-';
      
      incomeDetailData.push({
        'BID': income.bid,
        'Tanggal Dibuat': format(createdAtDate, 'dd/MM/yyyy', { locale: localeId }),
        'Jam Dibuat': format(createdAtDate, 'HH:mm', { locale: localeId }),
        'Nama Pelanggan': income.customer_name || '-',
        'Metode Bayar': income.payment_method || '-',
        'Jumlah': income.amount,
        'Produk': productsText,
        'Deskripsi': income.description || '-',
      });
    });
    
    exportToExcel(
      incomeDetailData, 
      'Pemasukan Detail', 
      getExportFileName('Pemasukan_Detail', currentStore.name, dateRangeStr)
    );
    toast.success("Export pemasukan detail berhasil!");
  };

  const handleExportExpense = () => {
    if (!currentStore || expenses.length === 0) return;
    
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    
    const expenseData = expenses.map(expense => {
      const createdAtDate = new Date(expense.created_at);
      return {
        'BID': expense.bid,
        'Tanggal Dibuat': format(createdAtDate, 'dd/MM/yyyy', { locale: localeId }),
        'Jam Dibuat': format(createdAtDate, 'HH:mm', { locale: localeId }),
        'Dibuat Oleh': expense.creator_name,
        'Deskripsi': expense.description,
        'Metode Bayar': expense.payment_method,
        'Jumlah': expense.amount,
        'Kategori': expense.category,
      };
    });
    
    exportToExcel(
      expenseData, 
      'Pengeluaran', 
      getExportFileName('Pengeluaran', currentStore.name, dateRangeStr)
    );
    toast.success("Export pengeluaran berhasil!");
  };

  const getDetailData = () => {
    if (!detailPopup) return { items: [] as any[], title: '' };
    const { type, label } = detailPopup;
    
    if (type === 'expense_category') {
      return {
        title: `Pengeluaran - Kategori: ${label}`,
        items: expenses.filter(e => e.category === label),
      };
    }
    if (type === 'expense_method') {
      return {
        title: `Pengeluaran - Metode: ${label}`,
        items: expenses.filter(e => e.payment_method === label),
      };
    }
    // income_method
    return {
      title: `Pemasukan - Metode: ${label}`,
      items: incomes.filter(i => i.payment_method === label),
    };
  };

  const handleExportDetail = () => {
    if (!detailPopup || !currentStore) return;
    const { type, label } = detailPopup;
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    
    if (type === 'income_method') {
      const filtered = incomes.filter(i => i.payment_method === label);
      const data = filtered.map(income => {
        const createdAt = new Date(income.created_at);
        const productsText = income.products.length > 0 
          ? income.products.map(p => `${p.product_name} (${p.quantity}x Rp ${formatCurrencyPlain(p.subtotal)})`).join(', ')
          : '-';
        return {
          'BID': income.bid,
          'Tanggal': format(createdAt, 'dd/MM/yyyy', { locale: localeId }),
          'Jam': format(createdAt, 'HH:mm'),
          'Pelanggan': income.customer_name || '-',
          'Metode Bayar': income.payment_method,
          'Jumlah': income.amount,
          'Produk': productsText,
          'Deskripsi': income.description || '-',
        };
      });
      exportToExcel(data, `Pemasukan_${label}`, getExportFileName(`Pemasukan_${label}`, currentStore.name, dateRangeStr));
    } else {
      const filtered = expenses.filter(e => 
        type === 'expense_category' ? e.category === label : e.payment_method === label
      );
      const data = filtered.map(expense => {
        const createdAt = new Date(expense.created_at);
        return {
          'BID': expense.bid,
          'Tanggal': format(createdAt, 'dd/MM/yyyy', { locale: localeId }),
          'Jam': format(createdAt, 'HH:mm'),
          'Dibuat Oleh': expense.creator_name,
          'Deskripsi': expense.description,
          'Metode Bayar': expense.payment_method,
          'Jumlah': expense.amount,
          'Kategori': expense.category,
        };
      });
      const suffix = type === 'expense_category' ? `Kategori_${label}` : `Metode_${label}`;
      exportToExcel(data, `Pengeluaran_${suffix}`, getExportFileName(`Pengeluaran_${suffix}`, currentStore.name, dateRangeStr));
    }
    toast.success("Export berhasil!");
  };

  const detail = getDetailData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Laporan Pengeluaran / Pemasukan</h3>
          <p className="text-sm text-muted-foreground">
            {getDateRangeDisplay(timeRange, customDateRange)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalIncomes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Selisih Bersih</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(stats.netProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Expense Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pengeluaran per Kategori</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.expenseCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengeluaran</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.expenseCategories.map((item, index) => {
                      const ratio = stats.totalExpenses > 0 ? ((item.total / stats.totalExpenses) * 100).toFixed(1) : '0';
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => setDetailPopup({ type: 'expense_category', label: item.category })}
                        >
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium truncate">{item.category}</span>
                              <span className="text-sm font-bold text-red-600 shrink-0 ml-2">{formatCurrency(item.total)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-0.5">
                              <span className="text-xs text-muted-foreground">{ratio}%</span>
                              <span className="text-xs text-muted-foreground">{item.count} transaksi</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expense by Payment Method */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Pengeluaran per Metode Bayar</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExpense}
                  disabled={loading || expenses.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {stats.expensePaymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengeluaran</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.expensePaymentMethods.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => setDetailPopup({ type: 'expense_method', label: item.method })}
                      >
                        <span className="text-sm font-medium">{item.method}</span>
                        <span className="text-sm font-bold text-red-600">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Income by Payment Method */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Pemasukan per Metode Bayar</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportIncomeDetail}
                  disabled={loading || incomes.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {stats.incomePaymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pemasukan</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.incomePaymentMethods.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => setDetailPopup({ type: 'income_method', label: item.method })}
                      >
                        <span className="text-sm font-medium">{item.method}</span>
                        <span className="text-sm font-bold text-green-600">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Expense List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Daftar Pengeluaran</CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengeluaran</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-start p-2 bg-muted/50 rounded text-sm">
                        <div>
                          {expense.bid && expense.bid !== '-' && (
                            <div className="flex items-center gap-1 mb-0.5">
                              <div 
                                className="text-[10px] font-mono text-primary font-bold cursor-pointer hover:underline"
                                onClick={() => handleEditExpenseClick(expense)}
                                title="Klik untuk edit"
                              >
                                {expense.bid}
                              </div>
                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => { navigator.clipboard.writeText(expense.bid); toast.success("BID disalin"); }} title="Salin BID">
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => handlePrintExpense(expense)} title="Print">
                                <Printer className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                          <div className="font-medium">{expense.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {expense.category} • {format(new Date(expense.date), "d MMM yyyy", { locale: localeId })}
                          </div>
                          <div className="text-xs text-muted-foreground">oleh: {expense.creator_name}</div>
                        </div>
                        <div className="font-bold text-red-600">{formatCurrency(expense.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Income List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Daftar Pemasukan</CardTitle>
              </CardHeader>
              <CardContent>
                {incomes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pemasukan</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {incomes.map((income) => (
                      <div key={income.id} className="flex justify-between items-start p-2 bg-muted/50 rounded text-sm">
                        <div>
                          {income.bid && income.bid !== '-' && (
                            <div className="flex items-center gap-1 mb-0.5">
                              <div 
                                className="text-[10px] font-mono text-primary font-bold cursor-pointer hover:underline"
                                onClick={() => handleEditIncomeClick(income)}
                                title="Klik untuk edit"
                              >
                                {income.bid}
                              </div>
                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => { navigator.clipboard.writeText(income.bid); toast.success("BID disalin"); }} title="Salin BID">
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => handlePrintIncome(income)} title="Print">
                                <Printer className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                          <div className="font-medium">{income.customer_name || income.description || "Pemasukan"}</div>
                          <div className="text-xs text-muted-foreground">
                            {income.payment_method} • {format(new Date(income.date), "d MMM yyyy", { locale: localeId })}
                          </div>
                          <div className="text-xs text-muted-foreground">oleh: {income.creator_name}</div>
                        </div>
                        <div className="font-bold text-green-600">{formatCurrency(income.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Detail Popup Dialog */}
      <Dialog open={!!detailPopup} onOpenChange={(open) => !open && setDetailPopup(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-base">{detail.title}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDetail}
              disabled={detail.items.length === 0}
              className="mr-6"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-2">
            {detail.items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data</p>
            ) : detailPopup?.type === 'income_method' ? (
              detail.items.map((income: IncomeData) => (
                <div key={income.id} className="flex justify-between items-start p-3 bg-muted/50 rounded text-sm border">
                  <div className="space-y-1">
                    <div className="font-medium">{income.customer_name || income.description || "Pemasukan"}</div>
                    <div className="text-xs text-muted-foreground">
                      BID: {income.bid} • {format(new Date(income.created_at), "d MMM yyyy HH:mm", { locale: localeId })}
                    </div>
                    <div className="text-xs text-muted-foreground">oleh: {income.creator_name}</div>
                    {income.products.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Produk: {income.products.map(p => `${p.product_name} (${p.quantity}x)`).join(', ')}
                      </div>
                    )}
                    {income.description && <div className="text-xs text-muted-foreground">Ket: {income.description}</div>}
                  </div>
                  <div className="font-bold text-green-600 whitespace-nowrap ml-4">{formatCurrency(income.amount)}</div>
                </div>
              ))
            ) : (
              detail.items.map((expense: ExpenseData) => (
                <div key={expense.id} className="flex justify-between items-start p-3 bg-muted/50 rounded text-sm border">
                  <div className="space-y-1">
                    <div className="font-medium">{expense.description}</div>
                    <div className="text-xs text-muted-foreground">
                      BID: {expense.bid} • {format(new Date(expense.created_at), "d MMM yyyy HH:mm", { locale: localeId })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Kategori: {expense.category} • Metode: {expense.payment_method}
                    </div>
                    <div className="text-xs text-muted-foreground">oleh: {expense.creator_name}</div>
                  </div>
                  <div className="font-bold text-red-600 whitespace-nowrap ml-4">{formatCurrency(expense.amount)}</div>
                </div>
              ))
            )}
          </div>
          {detail.items.length > 0 && (
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-medium">Total ({detail.items.length} transaksi)</span>
              <span className={`text-lg font-bold ${detailPopup?.type === 'income_method' ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(detail.items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0))}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: formatExpenseAmount(e.target.value) })} />
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
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="Debit">Debit</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveExpense}>Simpan</Button>
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
              <Input value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: formatExpenseAmount(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Metode Bayar</Label>
              <Select value={incomeForm.payment_method} onValueChange={(v) => setIncomeForm({ ...incomeForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Input value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSaveIncome}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
