import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Clock, Users, TrendingUp, XCircle, Package, MapPin, TrendingDown, FileText, ShoppingBag, Download, Search, Copy as CopyIcon, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast as toastSonner } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesExportData, exportSalesSourceTab } from "@/utils/reportExport";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import BookingDetailPopup from "@/components/BookingDetailPopup";
import BookingModal from "@/components/BookingModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BookingData {
  id: string;
  bid: string;
  customer_name: string;
  phone: string;
  duration: number;
  price: number;
  price_2: number;
  payment_method: string;
  payment_method_2: string;
  date: string;
  start_time: string;
  end_time: string;
  room_name: string;
  room_category: string;
  variant_name: string;
  status: string;
  variant_id: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_out_at: string | null;
  checked_out_by: string | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_applies_to: string | null;
  checked_in_by_name?: string;
  checked_out_by_name?: string;
  booking_duration_type?: string;
  booking_duration_value?: number;
  payment_proof_url?: string | null;
  payment_proof_url_2?: string | null;
  room_id?: string;
  note?: string | null;
}

interface BookingProductData {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  booking_id: string;
  purchase_price?: number;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [proofPreview, setProofPreview] = useState<{ url: string; url2?: string | null } | null>(null);
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
    totalBiaya: 0,
    jumlahBayar: 0,
    totalHPP: 0,
    totalLaba: 0,
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [timeRange, customDateRange, currentStore]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

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
          id, bid, customer_name, phone, duration, price, price_2, 
          payment_method, payment_method_2, date, start_time, end_time,
          status, variant_id,
          checked_in_at, checked_in_by, checked_out_at, checked_out_by,
          discount_type, discount_value, discount_applies_to,
          payment_proof_url, payment_proof_url_2, room_id, note,
          rooms (name, category_id, room_categories (name))
        `)
        .eq("store_id", currentStore.id)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch variant data separately for bookings with variant_id
      const variantIds = (bookingsData || [])
        .map((b: any) => b.variant_id)
        .filter((id: string | null) => id !== null);
      
      let variantDataMap: { [key: string]: { variant_name: string; booking_duration_type: string | null; booking_duration_value: number | null } } = {};
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from("room_variants")
          .select("id, variant_name, booking_duration_type, booking_duration_value")
          .in("id", variantIds);
        
        if (variants) {
          variants.forEach((v: any) => {
            variantDataMap[v.id] = {
              variant_name: v.variant_name,
              booking_duration_type: v.booking_duration_type,
              booking_duration_value: v.booking_duration_value,
            };
          });
        }
      }

      // Fetch user names for checked_in_by and checked_out_by
      const userIds = new Set<string>();
      (bookingsData || []).forEach((b: any) => {
        if (b.checked_in_by) userIds.add(b.checked_in_by);
        if (b.checked_out_by) userIds.add(b.checked_out_by);
      });

      let userNameMap: { [key: string]: string } = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", Array.from(userIds));
        
        if (profiles) {
          profiles.forEach((p: any) => {
            userNameMap[p.id] = p.name;
          });
        }
      }

      // Fetch booking products
      const bookingIds = (bookingsData || []).map((b: any) => b.id);
      let productsData: any[] = [];
      if (bookingIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from("booking_products")
          .select("id, product_name, quantity, subtotal, booking_id, product_id, products(purchase_price)")
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

      const mappedBookings: BookingData[] = (bookingsData || []).map((b: any) => {
        const variantData = b.variant_id ? variantDataMap[b.variant_id] : null;
        return {
          id: b.id,
          bid: b.bid || "-",
          customer_name: b.customer_name,
          phone: b.phone || "-",
          duration: Number(b.duration) || 0,
          price: Number(b.price) || 0,
          price_2: Number(b.price_2) || 0,
          payment_method: b.payment_method || "",
          payment_method_2: b.payment_method_2 || "",
          date: b.date,
          start_time: b.start_time || "",
          end_time: b.end_time || "",
          room_name: b.rooms?.name || "Unknown",
          room_category: b.rooms?.room_categories?.name || "-",
          variant_name: variantData?.variant_name || "-",
          status: b.status || "",
          variant_id: b.variant_id,
          checked_in_at: b.checked_in_at,
          checked_in_by: b.checked_in_by,
          checked_out_at: b.checked_out_at,
          checked_out_by: b.checked_out_by,
          discount_type: b.discount_type,
          discount_value: b.discount_value,
          discount_applies_to: b.discount_applies_to,
          checked_in_by_name: b.checked_in_by ? userNameMap[b.checked_in_by] || "-" : "-",
          checked_out_by_name: b.checked_out_by ? userNameMap[b.checked_out_by] || "-" : "-",
          booking_duration_type: variantData?.booking_duration_type || "hours",
          booking_duration_value: variantData?.booking_duration_value || b.duration,
          payment_proof_url: b.payment_proof_url || null,
          payment_proof_url_2: b.payment_proof_url_2 || null,
          room_id: b.room_id,
          note: b.note || null,
        };
      });

      const mappedProducts: BookingProductData[] = productsData.map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        quantity: p.quantity,
        subtotal: Number(p.subtotal) || 0,
        booking_id: p.booking_id,
        purchase_price: Number(p.products?.purchase_price) || 0,
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

      // Hitung Total Biaya, Jumlah Bayar, HPP, Laba per booking
      const totalBiaya = activeBookings.reduce((sum, b) => sum + b.price + b.price_2, 0);
      const jumlahBayar = activeBookings.reduce((sum, b) => {
        const paid1 = b.payment_method ? b.price : 0;
        const paid2 = b.payment_method_2 ? b.price_2 : 0;
        return sum + paid1 + paid2;
      }, 0);
      const totalHPP = mappedProducts.reduce((sum, p) => sum + (p.purchase_price || 0) * p.quantity, 0);
      const totalLaba = totalBiaya - totalHPP;

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
        totalBiaya,
        jumlahBayar,
        totalHPP,
        totalLaba,
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

  const formatDuration = (booking: BookingData) => {
    // OTA bookings (variant_id is null) always use days
    const isOta = booking.variant_id === null;
    // Oak Hotel (store slug) always uses days for all bookings
    const isOakHotel = currentStore?.slug === "oak-hotel";
    
    if (isOta || isOakHotel) {
      const value = booking.booking_duration_value || booking.duration;
      return `${value} hari`;
    }
    
    const type = booking.booking_duration_type || "hours";
    const value = booking.booking_duration_value || booking.duration;
    
    switch (type) {
      case "months":
        return `${value} bulan`;
      case "weeks":
        return `${value} minggu`;
      case "days":
        return `${value} hari`;
      case "hours":
      default:
        return `${value} jam`;
    }
  };

  const getDurationLabel = (booking: BookingData) => {
    // OTA bookings (variant_id is null) always use days
    const isOta = booking.variant_id === null;
    // Oak Hotel (store slug) always uses days for all bookings
    const isOakHotel = currentStore?.slug === "oak-hotel";
    
    if (isOta || isOakHotel) {
      return "Hari";
    }
    
    const type = booking.booking_duration_type || "hours";
    switch (type) {
      case "months":
        return "Bulan";
      case "weeks":
        return "Minggu";
      case "days":
        return "Hari";
      case "hours":
      default:
        return "Jam";
    }
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

  // Create products lookup by booking_id
  const productsByBookingId = bookingProducts.reduce((acc, p) => {
    if (!acc[p.booking_id]) {
      acc[p.booking_id] = [];
    }
    acc[p.booking_id].push({
      product_name: p.product_name,
      quantity: p.quantity,
      subtotal: p.subtotal,
    });
    return acc;
  }, {} as { [key: string]: { product_name: string; quantity: number; subtotal: number }[] });

  const getExportData = (): SalesExportData => {
    return {
      bookings: bookings.map(b => ({
        bid: b.bid,
        customer_name: b.customer_name,
        room_name: b.room_name,
        date: b.date,
        duration: b.duration,
        price: b.price,
        price_2: b.price_2,
        payment_method: b.payment_method,
        payment_method_2: b.payment_method_2,
        status: b.status,
        source: b.variant_id ? 'Walk-in' : 'OTA',
        products: productsByBookingId[b.id] || [],
      })),
      expenses: expenses.map(e => ({
        description: e.description,
        category: e.category,
        amount: e.amount,
        date: e.date,
      })),
      products: bookingProducts.map(p => ({
        product_name: p.product_name,
        quantity: p.quantity,
        subtotal: p.subtotal,
        booking_id: p.booking_id,
      })),
      summary: {
        total_booking: stats.totalBookings,
        total_revenue: stats.totalRevenue,
        walk_in_count: stats.walkInCount,
        walk_in_revenue: stats.walkInRevenue,
        ota_count: stats.otaCount,
        ota_revenue: stats.otaRevenue,
        cancelled_count: stats.cancelledCount,
        cancelled_revenue: stats.cancelledRevenue,
        total_expenses: stats.totalExpenses,
        net_profit: netProfit,
        product_sales_count: stats.productSalesCount,
        product_sales_revenue: stats.productSalesRevenue,
      },
      paymentMethodTotals: stats.paymentMethodTotals,
      groupedRooms,
      groupedProducts,
    };
  };

  const handleExportBookings = () => {
    if (!currentStore) return;
    
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    
    // Prepare export data with all requested fields
    const exportData = activeBookings.map(b => {
      // Calculate discount
      let discountDisplay = "-";
      if (b.discount_value && b.discount_value > 0) {
        if (b.discount_type === "percent") {
          discountDisplay = `${b.discount_value}%`;
        } else {
          discountDisplay = `Rp ${new Intl.NumberFormat("id-ID").format(b.discount_value)}`;
        }
        if (b.discount_applies_to) {
          discountDisplay += ` (${b.discount_applies_to})`;
        }
      }

      // Calculate final total after discount
      const totalBeforeDiscount = b.price + b.price_2;
      let totalAfterDiscount = totalBeforeDiscount;
      if (b.discount_value && b.discount_value > 0) {
        if (b.discount_type === "percent") {
          totalAfterDiscount = totalBeforeDiscount - (totalBeforeDiscount * b.discount_value / 100);
        } else {
          totalAfterDiscount = totalBeforeDiscount - b.discount_value;
        }
      }

      return {
        'BID': b.bid,
        'Tanggal Booking': format(new Date(b.date), "dd/MM/yyyy", { locale: localeId }),
        'Jam Booking': b.start_time ? format(new Date(`2000-01-01T${b.start_time}`), "HH:mm") : "-",
        'Tanggal Check In': b.checked_in_at ? format(new Date(b.checked_in_at), "dd/MM/yyyy", { locale: localeId }) : "-",
        'Jam Check In': b.checked_in_at ? format(new Date(b.checked_in_at), "HH:mm", { locale: localeId }) : "-",
        'Tanggal Check Out': b.checked_out_at ? format(new Date(b.checked_out_at), "dd/MM/yyyy", { locale: localeId }) : "-",
        'Jam Check Out': b.checked_out_at ? format(new Date(b.checked_out_at), "HH:mm", { locale: localeId }) : "-",
        'Durasi Menginap': b.booking_duration_value || b.duration,
        'Satuan Durasi': getDurationLabel(b),
        'Check In Oleh': b.checked_in_by_name || "-",
        'Check Out Oleh': b.checked_out_by_name || "-",
        'Nama Tamu': b.customer_name,
        'Nomor HP': b.phone || "-",
        'Sumber Booking': b.variant_id ? 'Walk-in' : 'OTA',
        'Tipe Kamar': b.room_category || "-",
        'Nama Kamar': b.room_name,
        'Varian Kamar': b.variant_name || "-",
        'Metode Pembayaran 1': b.payment_method || "-",
        'Total Pembayaran 1': b.price,
        'Metode Pembayaran 2': b.payment_method_2 || "-",
        'Total Pembayaran 2': b.price_2 || 0,
        'Diskon': discountDisplay,
        'Total Setelah Diskon': totalAfterDiscount,
      };
    });

    // Export to Excel
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Booking');
    
    const sanitizedStore = currentStore.name.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    XLSX.writeFile(workbook, `Daftar_Booking_${sanitizedStore}_${dateRangeStr}_${timestamp}.xlsx`);
    
    toast.success("Daftar booking berhasil di-export!");
  };

  const getTabLabel = (tab: SalesTab): string => {
    switch (tab) {
      case 'details': return 'Rincian';
      case 'source': return 'Sumber';
      case 'profit-loss': return 'Laba/Rugi';
      case 'cancelled': return 'Dibatalkan';
      case 'items': return 'Item';
      default: return 'Penjualan';
    }
  };

  // Filtered list for details table by search query
  const filteredDetailBookings = activeBookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const items = (productsByBookingId[b.id] || []).map((p) => p.product_name).join(" ").toLowerCase();
    return (
      b.bid?.toLowerCase().includes(q) ||
      b.customer_name?.toLowerCase().includes(q) ||
      b.room_name?.toLowerCase().includes(q) ||
      items.includes(q)
    );
  });

  const getBookingHPP = (bookingId: string) => {
    return bookingProducts
      .filter((p) => p.booking_id === bookingId)
      .reduce((sum, p) => sum + (p.purchase_price || 0) * p.quantity, 0);
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Tabs for different reports */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SalesTab)}>
            {/* Toolbar: dropdown + search + date filter + export (matches mockup) */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-4">
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as SalesTab)}>
                <SelectTrigger className="w-full lg:w-[280px] font-semibold">
                  <SelectValue placeholder="Pilih Laporan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="details">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4" />Laporan Rincian Penjualan</div>
                  </SelectItem>
                  <SelectItem value="source">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />Laporan Sumber Penjualan</div>
                  </SelectItem>
                  <SelectItem value="profit-loss">
                    <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4" />Laporan Laba/Rugi</div>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <div className="flex items-center gap-2"><XCircle className="h-4 w-4" />Laporan Dibatalkan</div>
                  </SelectItem>
                  <SelectItem value="items">
                    <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Laporan Penjualan Item</div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 lg:justify-end">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari BID, pelanggan, item, room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ReportDateFilter
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  customDateRange={customDateRange}
                  onCustomDateRangeChange={setCustomDateRange}
                />
                <Button
                  variant="outline"
                  onClick={handleExportBookings}
                  disabled={loading || activeBookings.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Rincian Penjualan */}
            <TabsContent value="details" className="space-y-4">
              {/* 5 stat cards */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Transaksi</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{stats.totalBookings}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Biaya</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(stats.totalBiaya)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Jumlah Bayar</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(stats.jumlahBayar)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total HPP</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalHPP)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Laba</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalLaba)}</div></CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Booking</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Pelanggan</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Durasi/Qty</TableHead>
                          <TableHead className="text-right">Total Biaya</TableHead>
                          <TableHead className="text-right">Jumlah Bayar</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Metode Bayar</TableHead>
                          <TableHead>Bukti Bayar</TableHead>
                          <TableHead className="text-right">HPP</TableHead>
                          <TableHead className="text-right">Laba</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDetailBookings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center text-sm text-muted-foreground py-8">
                              Tidak ada data
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDetailBookings.map((booking) => {
                            const totalBiaya = booking.price + booking.price_2;
                            const jumlahBayar = (booking.payment_method ? booking.price : 0) + (booking.payment_method_2 ? booking.price_2 : 0);
                            const hpp = getBookingHPP(booking.id);
                            const laba = totalBiaya - hpp;
                            const items = productsByBookingId[booking.id] || [];
                            const itemsLabel = items.length === 0
                              ? "-"
                              : items.map((p) => `${p.product_name} (x${p.quantity})`).join(", ");
                            return (
                              <TableRow key={booking.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-blue-600 font-medium text-xs">
                                    <button
                                      type="button"
                                      className="underline hover:text-blue-800 text-left"
                                      onClick={() => {
                                        setSelectedBookingId(booking.id);
                                        setDetailPopupOpen(true);
                                      }}
                                    >
                                      {booking.bid}
                                    </button>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        navigator.clipboard.writeText(booking.bid);
                                        toastSonner.success("BID disalin");
                                      }}
                                    >
                                      <CopyIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{format(new Date(booking.date), "d MMM yyyy", { locale: localeId })}</TableCell>
                                <TableCell className="text-xs">{booking.customer_name}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate" title={itemsLabel}>{itemsLabel}</TableCell>
                                <TableCell className="text-xs">{booking.room_name}</TableCell>
                                <TableCell className="text-xs">{formatDuration(booking)}</TableCell>
                                <TableCell className="text-right text-xs">{formatCurrency(totalBiaya)}</TableCell>
                                <TableCell className="text-right text-xs">{formatCurrency(jumlahBayar)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                    {booking.status === "Selesai" || booking.checked_out_at ? "Selesai" : (booking.status || "-")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{booking.payment_method || "-"}</TableCell>
                                <TableCell className="text-xs">
                                  {booking.payment_proof_url || booking.payment_proof_url_2 ? (
                                    <button
                                      type="button"
                                      className="text-blue-600 underline hover:text-blue-800"
                                      onClick={() => setProofPreview({ url: booking.payment_proof_url || booking.payment_proof_url_2 || "", url2: booking.payment_proof_url_2 })}
                                    >
                                      Lihat
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs text-orange-600">{hpp > 0 ? formatCurrency(hpp) : "-"}</TableCell>
                                <TableCell className="text-right text-xs text-blue-600 font-medium">{formatCurrency(laba)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sumber Penjualan */}
            <TabsContent value="source" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!currentStore) return;
                    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
                    exportSalesSourceTab(getExportData(), currentStore.name, dateRangeStr);
                    toast.success("Laporan Sumber berhasil di-export!");
                  }}
                  disabled={loading || activeBookings.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
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
                              {booking.bid} • {booking.room_name} • {formatDuration(booking)}
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

      {/* Detail Popup */}
      {detailPopupOpen && selectedBookingId && (
        <BookingDetailPopup
          isOpen={detailPopupOpen}
          onClose={() => {
            setDetailPopupOpen(false);
            setSelectedBookingId(null);
          }}
          bookingId={selectedBookingId}
          statusColors={{ BO: "#87CEEB", CI: "#90EE90", CO: "#6B7280", BATAL: "#9CA3AF" }}
          onStatusChange={() => fetchData()}
          onEdit={() => {
            const b = bookings.find((x) => x.id === selectedBookingId);
            if (b) {
              setEditingBooking({
                ...b,
                room_id: b.room_id,
              });
              setEditModalOpen(true);
            }
          }}
        />
      )}

      {/* Edit Booking Modal */}
      {editModalOpen && editingBooking && currentUserId && (
        <BookingModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingBooking(null);
            fetchData();
          }}
          selectedDate={new Date(editingBooking.date)}
          selectedSlot={null}
          editingBooking={editingBooking}
          userId={currentUserId}
        />
      )}

      {/* Payment Proof Preview */}
      <Dialog open={!!proofPreview} onOpenChange={(o) => !o && setProofPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bukti Bayar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {proofPreview?.url && (
              <a href={proofPreview.url} target="_blank" rel="noopener noreferrer">
                <img src={proofPreview.url} alt="Bukti Bayar 1" className="w-full rounded-lg border" />
              </a>
            )}
            {proofPreview?.url2 && proofPreview.url2 !== proofPreview.url && (
              <a href={proofPreview.url2} target="_blank" rel="noopener noreferrer">
                <img src={proofPreview.url2} alt="Bukti Bayar 2" className="w-full rounded-lg border" />
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
