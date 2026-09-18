import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Globe, ShoppingCart, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import ReportPagination, { usePagination } from "./ReportPagination";

type Channel = "dashboard" | "pos" | "website";

interface ChannelRow {
  id: string;
  bid: string;
  date: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  total: number;
  channel: Channel;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  dashboard: "Dashboard",
  pos: "Point of Sale",
  website: "Website",
};

const formatIDR = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(value || 0)}`;

export default function SalesChannelReport() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");

  useEffect(() => {
    if (!currentStore) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const from = format(startDate, "yyyy-MM-dd");
      const to = format(endDate, "yyyy-MM-dd");

      const [bookingsRes, ordersRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, bid, date, customer_name, payment_method, status, price, price_2")
          .eq("store_id", currentStore.id)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("booking_orders")
          .select("id, bid, date, customer_name, payment_method, process_status, total_amount, order_source")
          .eq("store_id", currentStore.id)
          .gte("date", from)
          .lte("date", to),
      ]);

      if (cancelled) return;

      const bookingRows: ChannelRow[] = (bookingsRes.data || [])
        .filter((b: any) => b.status !== "BATAL")
        .map((b: any) => ({
          id: b.id,
          bid: b.bid || "-",
          date: b.date,
          customerName: b.customer_name || "-",
          paymentMethod: b.payment_method || "-",
          status: b.status || "-",
          total: (Number(b.price) || 0) + (Number(b.price_2) || 0),
          channel: "dashboard" as Channel,
        }));

      const orderRows: ChannelRow[] = (ordersRes.data || [])
        .filter((o: any) => o.process_status !== "batal")
        .map((o: any) => ({
          id: o.id,
          bid: o.bid || "-",
          date: o.date,
          customerName: o.customer_name || "-",
          paymentMethod: o.payment_method || "-",
          status: o.process_status || "-",
          total: Number(o.total_amount) || 0,
          channel: (o.order_source === "barcode" || o.order_source === "website" ? "website" : "pos") as Channel,
        }));

      setRows(
        [...bookingRows, ...orderRows].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      );
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentStore?.id, timeRange, customDateRange]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        r.bid.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [rows, channelFilter, searchQuery]);

  const summary = useMemo(() => {
    const base: Record<Channel, { count: number; total: number }> = {
      dashboard: { count: 0, total: 0 },
      pos: { count: 0, total: 0 },
      website: { count: 0, total: 0 },
    };
    rows.forEach((r) => {
      base[r.channel].count += 1;
      base[r.channel].total += r.total;
    });
    return base;
  }, [rows]);

  const grandTotal = filteredRows.reduce((sum, r) => sum + r.total, 0);
  const pg = usePagination(filteredRows, [filteredRows.length, channelFilter, searchQuery]);

  const handleExport = () => {
    if (!currentStore || filteredRows.length === 0) return;

    const detail = filteredRows.map((r) => ({
      "BID": r.bid,
      "Tanggal": format(new Date(r.date), "dd/MM/yyyy", { locale: localeId }),
      "Sumber Penjualan": CHANNEL_LABEL[r.channel],
      "Nama Pelanggan": r.customerName,
      "Metode Pembayaran": r.paymentMethod,
      "Status": r.status,
      "Total": r.total,
    }));

    const recap = (Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => ({
      "Sumber Penjualan": CHANNEL_LABEL[c],
      "Jumlah Transaksi": summary[c].count,
      "Total Penjualan": summary[c].total,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(recap), "Rekap Sumber");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detail), "Detail Transaksi");

    const sanitizedStore = currentStore.name.replace(/[^a-zA-Z0-9]/g, "_");
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, "_");
    XLSX.writeFile(
      workbook,
      `Laporan_Sumber_Transaksi_${sanitizedStore}_${dateRangeStr}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`
    );
    toast.success("Laporan sumber transaksi berhasil di-export!");
  };

  const cards: { channel: Channel; icon: React.ElementType }[] = [
    { channel: "dashboard", icon: LayoutDashboard },
    { channel: "pos", icon: ShoppingCart },
    { channel: "website", icon: Globe },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as Channel | "all")}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sumber</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="pos">Point of Sale</SelectItem>
            <SelectItem value="website">Website</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari BID, pelanggan, pembayaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button variant="outline" onClick={handleExport} disabled={loading || filteredRows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map(({ channel, icon: Icon }) => (
              <Card key={channel}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {CHANNEL_LABEL[channel]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatIDR(summary[channel].total)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{summary[channel].count} transaksi</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Detail Transaksi — {getDateRangeDisplay(timeRange, customDateRange)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BID</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Pembayaran</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pg.pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Tidak ada transaksi pada periode ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      pg.pageItems.map((r) => (
                        <TableRow key={`${r.channel}-${r.id}`}>
                          <TableCell className="font-medium">{r.bid}</TableCell>
                          <TableCell>{format(new Date(r.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                          <TableCell><Badge variant="outline">{CHANNEL_LABEL[r.channel]}</Badge></TableCell>
                          <TableCell>{r.customerName}</TableCell>
                          <TableCell>{r.paymentMethod}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell className="text-right font-semibold">{formatIDR(r.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-3 text-sm font-bold">
                Total: {formatIDR(grandTotal)}
              </div>
              <ReportPagination {...pg} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
