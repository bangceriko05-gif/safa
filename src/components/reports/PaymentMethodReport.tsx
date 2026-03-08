import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { CreditCard, Download, Wallet, Banknote } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { exportMultipleSheets, getExportFileName, formatCurrencyPlain } from "@/utils/reportExport";

interface PaymentMethodData {
  method: string;
  bookingCount: number;
  bookingRevenue: number;
  incomeCount: number;
  incomeRevenue: number;
  totalCount: number;
  totalRevenue: number;
}

interface PaymentDetail {
  id: string;
  type: 'booking' | 'income';
  customer_name: string;
  amount: number;
  date: string;
  payment_method: string;
  description?: string;
  bid?: string;
}

export default function PaymentMethodReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [details, setDetails] = useState<PaymentDetail[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

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

      const [bookingsResult, incomesResult] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, customer_name, price, price_2, payment_method, payment_method_2, date, bid, status")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr),
        supabase
          .from("incomes")
          .select("id, customer_name, amount, payment_method, date, bid, description")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr),
      ]);

      if (bookingsResult.error) throw bookingsResult.error;
      if (incomesResult.error) throw incomesResult.error;

      const bookings = (bookingsResult.data || []).filter((b: any) => b.status !== 'BATAL');
      const incomes = incomesResult.data || [];

      const methodMap: Record<string, PaymentMethodData> = {};
      const allDetails: PaymentDetail[] = [];

      const ensureMethod = (method: string) => {
        if (!methodMap[method]) {
          methodMap[method] = {
            method,
            bookingCount: 0,
            bookingRevenue: 0,
            incomeCount: 0,
            incomeRevenue: 0,
            totalCount: 0,
            totalRevenue: 0,
          };
        }
      };

      bookings.forEach((b: any) => {
        const m1 = b.payment_method || "Belum Diisi";
        const p1 = Number(b.price) || 0;
        ensureMethod(m1);
        methodMap[m1].bookingCount += 1;
        methodMap[m1].bookingRevenue += p1;

        allDetails.push({
          id: b.id,
          type: 'booking',
          customer_name: b.customer_name,
          amount: p1,
          date: b.date,
          payment_method: m1,
          bid: b.bid,
        });

        if (b.payment_method_2) {
          const m2 = b.payment_method_2;
          const p2 = Number(b.price_2) || 0;
          ensureMethod(m2);
          methodMap[m2].bookingCount += 1;
          methodMap[m2].bookingRevenue += p2;

          allDetails.push({
            id: b.id + '_2',
            type: 'booking',
            customer_name: b.customer_name,
            amount: p2,
            date: b.date,
            payment_method: m2,
            bid: b.bid,
          });
        }
      });

      incomes.forEach((i: any) => {
        const m = i.payment_method || "Belum Diisi";
        const amt = Number(i.amount) || 0;
        ensureMethod(m);
        methodMap[m].incomeCount += 1;
        methodMap[m].incomeRevenue += amt;

        allDetails.push({
          id: i.id,
          type: 'income',
          customer_name: i.customer_name || '-',
          amount: amt,
          date: i.date,
          payment_method: m,
          bid: i.bid,
          description: i.description,
        });
      });

      // Calculate totals
      Object.values(methodMap).forEach(m => {
        m.totalCount = m.bookingCount + m.incomeCount;
        m.totalRevenue = m.bookingRevenue + m.incomeRevenue;
      });

      const sorted = Object.values(methodMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
      setPaymentMethods(sorted);
      setDetails(allDetails);
    } catch (error) {
      console.error("Error fetching payment method data:", error);
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

  const grandTotal = paymentMethods.reduce((sum, m) => sum + m.totalRevenue, 0);

  const filteredDetails = selectedMethod
    ? details.filter(d => d.payment_method === selectedMethod)
    : details;

  const handleExport = () => {
    if (!currentStore) return;
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');

    const summarySheet = [
      { 'Laporan': 'Laporan Metode Pembayaran', 'Nilai': dateRangeStr },
      { 'Laporan': 'Cabang', 'Nilai': currentStore.name },
      { 'Laporan': '', 'Nilai': '' },
      { 'Laporan': 'Grand Total', 'Nilai': `Rp ${formatCurrencyPlain(grandTotal)}` },
      { 'Laporan': '', 'Nilai': '' },
      { 'Laporan': '--- Per Metode Pembayaran ---', 'Nilai': '' },
      ...paymentMethods.map(m => ({
        'Laporan': m.method,
        'Nilai': `Rp ${formatCurrencyPlain(m.totalRevenue)}`,
      })),
    ];

    const methodSheet = paymentMethods.map(m => ({
      'Metode Pembayaran': m.method,
      'Jumlah Transaksi Booking': m.bookingCount,
      'Pendapatan Booking': m.bookingRevenue,
      'Jumlah Transaksi Pemasukan': m.incomeCount,
      'Pendapatan Pemasukan': m.incomeRevenue,
      'Total Transaksi': m.totalCount,
      'Total Pendapatan': m.totalRevenue,
      'Persentase': grandTotal > 0 ? `${((m.totalRevenue / grandTotal) * 100).toFixed(1)}%` : '0%',
    }));

    const detailSheet = details.map(d => ({
      'BID': d.bid || '-',
      'Tipe': d.type === 'booking' ? 'Booking' : 'Pemasukan',
      'Nama Pelanggan': d.customer_name,
      'Metode Pembayaran': d.payment_method,
      'Jumlah': d.amount,
      'Tanggal': d.date,
      'Deskripsi': d.description || '-',
    }));

    exportMultipleSheets([
      { name: 'Ringkasan', data: summarySheet },
      { name: 'Per Metode', data: methodSheet },
      { name: 'Detail Transaksi', data: detailSheet },
    ], getExportFileName('Laporan_Metode_Pembayaran', currentStore.name, dateRangeStr));

    toast.success("Laporan Metode Pembayaran berhasil di-export!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Laporan Metode Pembayaran</h3>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || paymentMethods.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Grand Total Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grand Total Semua Metode</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {paymentMethods.length} metode pembayaran • {details.length} transaksi
              </p>
            </CardContent>
          </Card>

          {/* Payment Method Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paymentMethods.map((m) => (
              <Card
                key={m.method}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedMethod === m.method ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedMethod(selectedMethod === m.method ? null : m.method)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{m.method}</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(m.totalRevenue)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {m.totalCount} transaksi
                    </Badge>
                    {grandTotal > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {((m.totalRevenue / grandTotal) * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Booking:</span>
                      <span>{m.bookingCount} ({formatCurrency(m.bookingRevenue)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pemasukan:</span>
                      <span>{m.incomeCount} ({formatCurrency(m.incomeRevenue)})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {paymentMethods.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Tidak ada data pembayaran pada periode ini
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
