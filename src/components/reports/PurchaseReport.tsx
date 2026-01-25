import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { ShoppingCart, Package, Download } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { exportPurchaseReport, PurchaseExportData } from "@/utils/reportExport";
import { toast } from "sonner";

interface ProductSale {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

interface IncomeProductData {
  income_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  date: string;
  customer_name: string;
}

export default function PurchaseReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [transactions, setTransactions] = useState<IncomeProductData[]>([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalProductsSold: 0,
    totalRevenue: 0,
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

      // Get incomes in date range
      const { data: incomesData, error: incomesError } = await supabase
        .from("incomes")
        .select("id, date, customer_name")
        .eq("store_id", currentStore.id)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (incomesError) throw incomesError;

      if (!incomesData || incomesData.length === 0) {
        setProductSales([]);
        setTransactions([]);
        setStats({ totalTransactions: 0, totalProductsSold: 0, totalRevenue: 0 });
        setLoading(false);
        return;
      }

      const incomeIds = incomesData.map((i) => i.id);
      const incomeMap = Object.fromEntries(incomesData.map((i) => [i.id, i]));

      // Get income products
      const { data: productsData, error: productsError } = await supabase
        .from("income_products")
        .select("*")
        .in("income_id", incomeIds);

      if (productsError) throw productsError;

      const mappedTransactions: IncomeProductData[] = (productsData || []).map((p) => ({
        income_id: p.income_id,
        product_id: p.product_id,
        product_name: p.product_name,
        product_price: Number(p.product_price) || 0,
        quantity: p.quantity || 1,
        subtotal: Number(p.subtotal) || 0,
        date: incomeMap[p.income_id]?.date || "",
        customer_name: incomeMap[p.income_id]?.customer_name || "",
      }));

      // Aggregate by product
      const productAggregates: { [id: string]: ProductSale } = {};
      mappedTransactions.forEach((t) => {
        if (!productAggregates[t.product_id]) {
          productAggregates[t.product_id] = {
            product_id: t.product_id,
            product_name: t.product_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }
        productAggregates[t.product_id].total_quantity += t.quantity;
        productAggregates[t.product_id].total_revenue += t.subtotal;
      });

      const sortedProducts = Object.values(productAggregates).sort((a, b) => b.total_revenue - a.total_revenue);

      const totalProductsSold = mappedTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const totalRevenue = mappedTransactions.reduce((sum, t) => sum + t.subtotal, 0);

      setProductSales(sortedProducts);
      setTransactions(mappedTransactions);
      setStats({
        totalTransactions: mappedTransactions.length,
        totalProductsSold,
        totalRevenue,
      });
    } catch (error) {
      console.error("Error fetching purchase data:", error);
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

  const handleExport = () => {
    if (!currentStore) return;
    
    const exportData: PurchaseExportData = {
      transactions: transactions.map(t => ({
        product_name: t.product_name,
        quantity: t.quantity,
        product_price: t.product_price,
        subtotal: t.subtotal,
        customer_name: t.customer_name,
        date: t.date,
      })),
      productSales: productSales.map(p => ({
        product_name: p.product_name,
        total_quantity: p.total_quantity,
        total_revenue: p.total_revenue,
      })),
      summary: {
        total_transactions: stats.totalTransactions,
        total_products_sold: stats.totalProductsSold,
        total_revenue: stats.totalRevenue,
      },
    };

    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    exportPurchaseReport(exportData, currentStore.name, dateRangeStr);
    toast.success("Laporan berhasil di-export!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Laporan Pembelian Produk</h3>
          <p className="text-sm text-muted-foreground">
            {getDateRangeDisplay(timeRange, customDateRange)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || transactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
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
                <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produk Terjual</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProductsSold}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                <ShoppingCart className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent>
              {productSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada data penjualan produk</p>
              ) : (
                <div className="space-y-2">
                  {productSales.map((product, index) => (
                    <div key={product.product_id} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{product.product_name}</div>
                          <div className="text-xs text-muted-foreground">Terjual: {product.total_quantity} pcs</div>
                        </div>
                      </div>
                      <div className="font-bold text-green-600">{formatCurrency(product.total_revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Detail Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada transaksi</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {transactions.map((t, index) => (
                    <div key={`${t.income_id}-${t.product_id}-${index}`} className="flex justify-between items-start p-2 bg-muted/50 rounded text-sm">
                      <div>
                        <div className="font-medium">{t.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.customer_name || "Pelanggan"} • {t.quantity} pcs @ {formatCurrency(t.product_price)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.date && format(new Date(t.date), "d MMM yyyy", { locale: localeId })}
                        </div>
                      </div>
                      <div className="font-bold text-green-600">{formatCurrency(t.subtotal)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
