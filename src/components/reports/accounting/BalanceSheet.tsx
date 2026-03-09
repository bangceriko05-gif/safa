import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

interface BalanceData {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  assetDetails: { name: string; amount: number }[];
  liabilityDetails: { name: string; amount: number }[];
}

export default function BalanceSheet() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [data, setData] = useState<BalanceData>({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    assetDetails: [],
    liabilityDetails: [],
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
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch assets purchased up to end date
      const { data: assets } = await supabase
        .from("assets")
        .select("name, current_value, status, purchase_date")
        .eq("store_id", currentStore.id)
        .eq("status", "active")
        .or(`purchase_date.is.null,purchase_date.lte.${endStr}`);

      const totalAssets = (assets || []).reduce((sum, a) => sum + Number(a.current_value || 0), 0);
      const assetDetails = (assets || []).map(a => ({ name: a.name, amount: Number(a.current_value || 0) }));

      // Fetch payables created up to end date
      const { data: payables } = await supabase
        .from("accounts_payable")
        .select("supplier_name, amount, paid_amount, status")
        .eq("store_id", currentStore.id)
        .neq("status", "paid")
        .lte("created_at", format(endDate, "yyyy-MM-dd'T'23:59:59"));

      const totalLiabilities = (payables || []).reduce((sum, p) => sum + (Number(p.amount) - Number(p.paid_amount || 0)), 0);
      const liabilityDetails = (payables || []).map(p => ({
        name: p.supplier_name,
        amount: Number(p.amount) - Number(p.paid_amount || 0),
      }));

      const totalEquity = totalAssets - totalLiabilities;

      setData({ totalAssets, totalLiabilities, totalEquity, assetDetails, liabilityDetails });
    } catch (error) {
      console.error("Error fetching balance sheet:", error);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Per {getDateRangeDisplay(timeRange, customDateRange)}</p>
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
            <CardTitle className="text-sm font-medium text-blue-600">Total Aset</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalAssets)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Total Kewajiban</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalLiabilities)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Ekuitas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalEquity)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aset</CardTitle>
          </CardHeader>
          <CardContent>
            {data.assetDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data aset</p>
            ) : (
              <div className="space-y-2">
                {data.assetDetails.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kewajiban (Hutang)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.liabilityDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data hutang</p>
            ) : (
              <div className="space-y-2">
                {data.liabilityDetails.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
