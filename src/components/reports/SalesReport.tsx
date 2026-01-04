import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Clock, Users, TrendingUp, XCircle, Package, MapPin, TrendingDown, FileText, ShoppingBag } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BookingData {
  id: string;
  bid: string;
  customer_name: string;
  duration: number;
  price: number;
  price_2: number;
  payment_method: string;
  payment_method_2: string;
  date: string;
  room_name: string;
  status: string;
  variant_id: string | null;
}

interface BookingProductData {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  booking_id: string;
}

interface ExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}

type SalesTab = "details" | "source" | "profit-loss" | "cancelled" | "items";

export default function SalesReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [activeTab, setActiveTab] = useState<SalesTab>("details");
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [bookingProducts, setBookingProducts] = useState<BookingProductData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    walkInCount: 0,
    walkInRevenue: 0,
    otaCount: 0,
    otaRevenue: 0,
    cancelledCount: 0,
    cancelledRevenue: 0,
    totalExpenses: 0,
    roomSalesCount: 0,
    productSalesCount: 0,
    productSalesRevenue: 0,
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

      // Fetch all bookings including cancelled
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          id, bid, customer_name, duration, price, price_2, 
          payment_method, payment_method_2, date, status, variant_id,
          rooms (name)
        `)
        .eq("store_id", currentStore.id)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch booking products
      const bookingIds = (bookingsData || []).map((b: any) => b.id);
      let productsData: any[] = [];
      if (bookingIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from("booking_products")
          .select("id, product_name, quantity, subtotal, booking_id")
          .in("booking_id", bookingIds);
        
        if (!productsError) {
          productsData = products || [];
        }
      }

      // Fetch expenses for profit/loss
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("id, amount, description, category, date")
        .eq("store_id", currentStore.id)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (expensesError) throw expensesError;

      const mappedBookings: BookingData[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        bid: b.bid || "-",
        customer_name: b.customer_name,
        duration: Number(b.duration) || 0,
        price: Number(b.price) || 0,
        price_2: Number(b.price_2) || 0,
        payment_method: b.payment_method || "",
        payment_method_2: b.payment_method_2 || "",
        date: b.date,
        room_name: b.rooms?.name || "Unknown",
        status: b.status || "",
        variant_id: b.variant_id,
      }));

      const mappedProducts: BookingProductData[] = productsData.map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        quantity: p.quantity,
        subtotal: Number(p.subtotal) || 0,
        booking_id: p.booking_id,
      }));

      const mappedExpenses: ExpenseData[] = (expensesData || []).map((e: any) => ({
        id: e.id,
        amount: Number(e.amount) || 0,
        description: e.description,
        category: e.category || "Lainnya",
        date: e.date,
      }));

      // Filter active bookings (not cancelled)
      const activeBookings = mappedBookings.filter(b => b.status !== "BATAL");
      const cancelledBookings = mappedBookings.filter(b => b.status === "BATAL");
      
      // Walk-in vs OTA (OTA = no variant_id)
      const walkInBookings = activeBookings.filter(b => b.variant_id !== null);
      const otaBookings = activeBookings.filter(b => b.variant_id === null);

      // Calculate stats
      const paymentTotals: { [key: string]: number } = {};

      activeBookings.forEach((booking) => {
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
      const walkInRevenue = walkInBookings.reduce((sum, b) => sum + b.price + b.price_2, 0);
      const otaRevenue = otaBookings.reduce((sum, b) => sum + b.price + b.price_2, 0);
      const cancelledRevenue = cancelledBookings.reduce((sum, b) => sum + b.price + b.price_2, 0);
      const totalExpenses = mappedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const productSalesRevenue = mappedProducts.reduce((sum, p) => sum + p.subtotal, 0);
      const productSalesCount = mappedProducts.reduce((sum, p) => sum + p.quantity, 0);

      setBookings(mappedBookings);
      setBookingProducts(mappedProducts);
      setExpenses(mappedExpenses);
      setStats({
        totalBookings: activeBookings.length,
        totalRevenue,
        walkInCount: walkInBookings.length,
        walkInRevenue,
        otaCount: otaBookings.length,
        otaRevenue,
        cancelledCount: cancelledBookings.length,
        cancelledRevenue,
        totalExpenses,
        roomSalesCount: activeBookings.length,
        productSalesCount,
        productSalesRevenue,
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

  const activeBookings = bookings.filter(b => b.status !== "BATAL");
  const cancelledBookings = bookings.filter(b => b.status === "BATAL");
  const walkInBookings = activeBookings.filter(b => b.variant_id !== null);
  const otaBookings = activeBookings.filter(b => b.variant_id === null);

  // Group products by name for items report
  const groupedProducts = bookingProducts.reduce((acc, product) => {
    if (!acc[product.product_name]) {
      acc[product.product_name] = { quantity: 0, subtotal: 0 };
    }
    acc[product.product_name].quantity += product.quantity;
    acc[product.product_name].subtotal += product.subtotal;
    return acc;
  }, {} as { [key: string]: { quantity: number; subtotal: number } });

  // Group rooms for items report
  const groupedRooms = activeBookings.reduce((acc, booking) => {
    if (!acc[booking.room_name]) {
      acc[booking.room_name] = { count: 0, hours: 0, revenue: 0 };
    }
    acc[booking.room_name].count += 1;
    acc[booking.room_name].hours += booking.duration;
    acc[booking.room_name].revenue += booking.price + booking.price_2;
    return acc;
  }, {} as { [key: string]: { count: number; hours: number; revenue: number } });

  const netProfit = stats.totalRevenue - stats.totalExpenses;

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
          {/* Summary Cards */}
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
                <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBookings} transaksi</div>
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

          {/* Tabs for different reports */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SalesTab)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details" className="text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
                Rincian
              </TabsTrigger>
              <TabsTrigger value="source" className="text-xs sm:text-sm">
                <MapPin className="h-4 w-4 mr-1 hidden sm:inline" />
                Sumber
              </TabsTrigger>
              <TabsTrigger value="profit-loss" className="text-xs sm:text-sm">
                <TrendingDown className="h-4 w-4 mr-1 hidden sm:inline" />
                Laba/Rugi
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm">
                <XCircle className="h-4 w-4 mr-1 hidden sm:inline" />
                Dibatalkan
              </TabsTrigger>
              <TabsTrigger value="items" className="text-xs sm:text-sm">
                <ShoppingBag className="h-4 w-4 mr-1 hidden sm:inline" />
                Item
              </TabsTrigger>
            </TabsList>

            {/* Rincian Penjualan */}
            <TabsContent value="details" className="space-y-4">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daftar Booking</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada booking</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {activeBookings.map((booking) => (
                        <div key={booking.id} className="flex justify-between items-start p-3 bg-muted/50 rounded">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {booking.customer_name}
                              <Badge variant={booking.variant_id ? "default" : "secondary"} className="text-xs">
                                {booking.variant_id ? "Walk-in" : "OTA"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.bid} • {booking.room_name} • {booking.duration} jam
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
            </TabsContent>

            {/* Sumber Penjualan */}
            <TabsContent value="source" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Walk-in</CardTitle>
                    <Badge variant="default">Walk-in</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.walkInCount} booking</div>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatCurrency(stats.walkInRevenue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">OTA (Online Travel Agent)</CardTitle>
                    <Badge variant="secondary">OTA</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.otaCount} booking</div>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatCurrency(stats.otaRevenue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian Walk-in</CardTitle>
                </CardHeader>
                <CardContent>
                  {walkInBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada booking walk-in</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {walkInBookings.map((booking) => (
                        <div key={booking.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <div>
                            <div className="font-medium text-sm">{booking.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{booking.room_name}</div>
                          </div>
                          <span className="font-bold text-sm">{formatCurrency(booking.price + booking.price_2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian OTA</CardTitle>
                </CardHeader>
                <CardContent>
                  {otaBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada booking OTA</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {otaBookings.map((booking) => (
                        <div key={booking.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <div>
                            <div className="font-medium text-sm">{booking.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{booking.room_name}</div>
                          </div>
                          <span className="font-bold text-sm">{formatCurrency(booking.price + booking.price_2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rincian Laba/Rugi */}
            <TabsContent value="profit-loss" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
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
                    <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
                    {netProfit >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(netProfit)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian Pendapatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950 rounded">
                      <span className="text-sm font-medium">Penjualan Kamar</span>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(stats.totalRevenue - stats.productSalesRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950 rounded">
                      <span className="text-sm font-medium">Penjualan Produk</span>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(stats.productSalesRevenue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian Pengeluaran</CardTitle>
                </CardHeader>
                <CardContent>
                  {expenses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada pengeluaran</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950 rounded">
                          <div>
                            <div className="text-sm font-medium">{expense.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {expense.category} • {format(new Date(expense.date), "d MMM yyyy", { locale: localeId })}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-red-600">{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Penjualan Dibatalkan */}
            <TabsContent value="cancelled" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Dibatalkan</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.cancelledCount} booking</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Potensi pendapatan hilang: <span className="text-red-600 font-medium">{formatCurrency(stats.cancelledRevenue)}</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daftar Booking Dibatalkan</CardTitle>
                </CardHeader>
                <CardContent>
                  {cancelledBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada booking yang dibatalkan</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {cancelledBookings.map((booking) => (
                        <div key={booking.id} className="flex justify-between items-start p-3 bg-red-50 dark:bg-red-950 rounded">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {booking.customer_name}
                              <Badge variant="destructive" className="text-xs">BATAL</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.bid} • {booking.room_name} • {booking.duration} jam
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(booking.date), "d MMM yyyy", { locale: localeId })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600">{formatCurrency(booking.price + booking.price_2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Penjualan Item */}
            <TabsContent value="items" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Penjualan Kamar</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.roomSalesCount} kamar</div>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatCurrency(stats.totalRevenue - stats.productSalesRevenue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Penjualan Produk</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.productSalesCount} item</div>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatCurrency(stats.productSalesRevenue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian Penjualan Kamar</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(groupedRooms).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada data</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kamar</TableHead>
                          <TableHead className="text-center">Jumlah</TableHead>
                          <TableHead className="text-center">Total Durasi</TableHead>
                          <TableHead className="text-right">Pendapatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(groupedRooms).map(([name, data]) => (
                          <TableRow key={name}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-center">{data.count}</TableCell>
                            <TableCell className="text-center">{data.hours.toFixed(1)} jam</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(data.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rincian Penjualan Produk</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(groupedProducts).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada data</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produk</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(groupedProducts).map(([name, data]) => (
                          <TableRow key={name}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-center">{data.quantity}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(data.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
