import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

export default function ProfitLoss() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [data, setData] = useState({
    bookingRevenue: 0,
    additionalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    expensesByCategory: [] as { category: string; amount: number }[],
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, timeRange, customDateRange]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [bookingsRes, incomesRes, expensesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("price, price_2, status")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .not("status", "in", '("Cancelled","BATAL")'),
        supabase
          .from("incomes")
          .select("amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("expenses")
          .select("amount, category")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
      ]);

      const bookingRevenue = (bookingsRes.data || []).reduce(
        (sum, b) => sum + (Number(b.price) || 0) + (Number(b.price_2) || 0), 0
      );
      const additionalIncome = (incomesRes.data || []).reduce(
        (sum, i) => sum + (Number(i.amount) || 0), 0
      );
      const totalExpenses = (expensesRes.data || []).reduce(
        (sum, e) => sum + (Number(e.amount) || 0), 0
      );

      // Group expenses by category
      const catMap: Record<string, number> = {};
      (expensesRes.data || []).forEach(e => {
        const cat = e.category || "Lainnya";
        catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
      });
      const expensesByCategory = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      setData({
        bookingRevenue,
        additionalIncome,
        totalExpenses,
        netProfit: bookingRevenue + additionalIncome - totalExpenses,
        expensesByCategory,
      });
    } catch (error) {
      console.error("Error fetching P&L:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalRevenue = data.bookingRevenue + data.additionalIncome;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Pendapatan Booking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(data.bookingRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Pemasukan Lain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(data.additionalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Total Pengeluaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(data.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={data.netProfit >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> Laba Bersih
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${data.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(data.netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Pendapatan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Pendapatan Booking</span>
              <span className="font-medium">{formatCurrency(data.bookingRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pemasukan Lain</span>
              <span className="font-medium">{formatCurrency(data.additionalIncome)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-bold">
              <span>Total Pendapatan</span>
              <span>{formatCurrency(totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rincian Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengeluaran</p>
            ) : (
              <>
                {data.expensesByCategory.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.category}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Total Pengeluaran</span>
                  <span>{formatCurrency(data.totalExpenses)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
