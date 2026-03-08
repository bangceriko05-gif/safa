import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { format } from "date-fns";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

export default function CashFlow() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [data, setData] = useState({
    cashIn: [] as { source: string; amount: number }[],
    cashOut: [] as { source: string; amount: number }[],
    totalIn: 0,
    totalOut: 0,
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

      const [bookingsRes, incomesRes, expensesRes, receivablesRes, payablesRes] = await Promise.all([
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
          .select("amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("accounts_receivable")
          .select("received_amount")
          .eq("store_id", currentStore.id)
          .gte("created_at", format(startDate, "yyyy-MM-dd'T'00:00:00"))
          .lte("created_at", format(endDate, "yyyy-MM-dd'T'23:59:59")),
        supabase
          .from("accounts_payable")
          .select("paid_amount")
          .eq("store_id", currentStore.id)
          .gte("created_at", format(startDate, "yyyy-MM-dd'T'00:00:00"))
          .lte("created_at", format(endDate, "yyyy-MM-dd'T'23:59:59")),
      ]);

      const bookingTotal = (bookingsRes.data || []).reduce(
        (sum, b) => sum + (Number(b.price) || 0) + (Number(b.price_2) || 0), 0
      );
      const incomeTotal = (incomesRes.data || []).reduce(
        (sum, i) => sum + (Number(i.amount) || 0), 0
      );
      const expenseTotal = (expensesRes.data || []).reduce(
        (sum, e) => sum + (Number(e.amount) || 0), 0
      );
      const receivedTotal = (receivablesRes.data || []).reduce(
        (sum, r) => sum + (Number(r.received_amount) || 0), 0
      );
      const paidTotal = (payablesRes.data || []).reduce(
        (sum, p) => sum + (Number(p.paid_amount) || 0), 0
      );

      const cashIn = [
        { source: "Pendapatan Booking", amount: bookingTotal },
        { source: "Pemasukan Lain", amount: incomeTotal },
        { source: "Penerimaan Piutang", amount: receivedTotal },
      ].filter(i => i.amount > 0);

      const cashOut = [
        { source: "Pengeluaran Operasional", amount: expenseTotal },
        { source: "Pembayaran Hutang", amount: paidTotal },
      ].filter(i => i.amount > 0);

      setData({
        cashIn,
        cashOut,
        totalIn: cashIn.reduce((s, i) => s + i.amount, 0),
        totalOut: cashOut.reduce((s, i) => s + i.amount, 0),
      });
    } catch (error) {
      console.error("Error fetching cash flow:", error);
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

  const netCashFlow = data.totalIn - data.totalOut;

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-green-600 flex items-center gap-1">
              <ArrowUpCircle className="h-3.5 w-3.5" /> Kas Masuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.totalIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-red-600 flex items-center gap-1">
              <ArrowDownCircle className="h-3.5 w-3.5" /> Kas Keluar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.totalOut)}</p>
          </CardContent>
        </Card>
        <Card className={netCashFlow >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Arus Kas Bersih
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(netCashFlow)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" /> Kas Masuk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.cashIn.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada kas masuk</p>
            ) : (
              <>
                {data.cashIn.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.source}</span>
                    <span className="font-medium text-green-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-600" /> Kas Keluar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.cashOut.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada kas keluar</p>
            ) : (
              <>
                {data.cashOut.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.source}</span>
                    <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
