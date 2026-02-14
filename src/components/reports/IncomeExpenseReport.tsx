import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { TrendingUp, TrendingDown, DollarSign, Download } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { 
  exportToExcel, 
  getExportFileName,
  formatCurrencyPlain
} from "@/utils/reportExport";
import { toast } from "sonner";

interface ExpenseData {
  id: string;
  bid: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
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
  creator_name: string;
  products: { product_name: string; quantity: number; subtotal: number }[];
}

export default function IncomeExpenseReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [incomes, setIncomes] = useState<IncomeData[]>([]);
  const [stats, setStats] = useState({
    totalExpenses: 0,
    totalIncomes: 0,
    netProfit: 0,
    expenseCategories: [] as { category: string; total: number }[],
    incomePaymentMethods: [] as { method: string; total: number }[],
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [timeRange, customDateRange, currentStore]);

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
        date: e.date,
        created_at: e.created_at,
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
        expenseCategories: Object.entries(expenseByCategory).map(([category, total]) => ({ category, total })),
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
    
    // Export pengeluaran: deskripsi, jumlah, kategori
    const expenseData = expenses.map(expense => ({
      'Deskripsi': expense.description,
      'Jumlah': expense.amount,
      'Kategori': expense.category,
    }));
    
    exportToExcel(
      expenseData, 
      'Pengeluaran', 
      getExportFileName('Pengeluaran', currentStore.name, dateRangeStr)
    );
    toast.success("Export pengeluaran berhasil!");
  };

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

          <div className="grid gap-4 md:grid-cols-2">
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
                    {stats.expenseCategories.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm font-medium">{item.category}</span>
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
                  Export Pemasukan
                </Button>
              </CardHeader>
              <CardContent>
                {stats.incomePaymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pemasukan</p>
                ) : (
                  <div className="space-y-2">
                    {stats.incomePaymentMethods.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Daftar Pengeluaran</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExpense}
                  disabled={loading || expenses.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Pengeluaran
                </Button>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengeluaran</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-start p-2 bg-muted/50 rounded text-sm">
                        <div>
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
    </div>
  );
}
