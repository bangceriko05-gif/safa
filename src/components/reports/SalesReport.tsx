import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Clock, DollarSign, Users, TrendingUp } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";

interface BookingData {
  id: string;
  customer_name: string;
  duration: number;
  price: number;
  price_2: number;
  payment_method: string;
  payment_method_2: string;
  date: string;
  room_name: string;
}

export default function SalesReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalHours: 0,
    totalRevenue: 0,
    paymentMethodTotals: [] as { method: string; total: number }[],
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

      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select(`
          id, customer_name, duration, price, price_2, 
          payment_method, payment_method_2, date,
          rooms (name)
        `)
        .eq("store_id", currentStore.id)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      if (error) throw error;

      const mappedBookings: BookingData[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        customer_name: b.customer_name,
        duration: Number(b.duration) || 0,
        price: Number(b.price) || 0,
        price_2: Number(b.price_2) || 0,
        payment_method: b.payment_method || "",
        payment_method_2: b.payment_method_2 || "",
        date: b.date,
        room_name: b.rooms?.name || "Unknown",
      }));

      // Calculate stats
      const totalHours = mappedBookings.reduce((sum, b) => sum + b.duration, 0);
      const paymentTotals: { [key: string]: number } = {};

      mappedBookings.forEach((booking) => {
        if (booking.payment_method) {
          paymentTotals[booking.payment_method] = (paymentTotals[booking.payment_method] || 0) + booking.price;
        } else if (booking.price > 0) {
          paymentTotals["Belum Diisi"] = (paymentTotals["Belum Diisi"] || 0) + booking.price;
        }
        if (booking.payment_method_2) {
          paymentTotals[booking.payment_method_2] = (paymentTotals[booking.payment_method_2] || 0) + booking.price_2;
        } else if (booking.price_2 > 0) {
          paymentTotals["Belum Diisi"] = (paymentTotals["Belum Diisi"] || 0) + booking.price_2;
        }
      });

      const totalRevenue = Object.values(paymentTotals).reduce((sum, t) => sum + t, 0);

      setBookings(mappedBookings);
      setStats({
        totalBookings: mappedBookings.length,
        totalHours,
        totalRevenue,
        paymentMethodTotals: Object.entries(paymentTotals).map(([method, total]) => ({ method, total })),
      });
    } catch (error) {
      console.error("Error fetching sales data:", error);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Laporan Penjualan</h3>
          <p className="text-sm text-muted-foreground">
            {getDateRangeDisplay(timeRange, customDateRange)}
          </p>
        </div>
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Booking</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBookings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jam</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)} jam</div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Breakdown per Metode Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.paymentMethodTotals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada data</p>
              ) : (
                <div className="space-y-2">
                  {stats.paymentMethodTotals.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm font-medium">{item.method}</span>
                      <span className="text-sm font-bold">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daftar Booking</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada booking</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex justify-between items-start p-3 bg-muted/50 rounded">
                      <div>
                        <div className="font-medium">{booking.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {booking.room_name} • {booking.duration} jam
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(booking.date), "d MMM yyyy", { locale: localeId })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(booking.price + booking.price_2)}</div>
                        <div className="text-xs text-muted-foreground">
                          {booking.payment_method || "Belum Diisi"}
                        </div>
                      </div>
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
