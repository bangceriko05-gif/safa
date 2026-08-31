import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Search, Users, TrendingUp, Repeat, Wallet, Filter, Copy, Check } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import ReportPagination, { usePagination } from "./ReportPagination";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { getReportCache, setReportCache } from "@/utils/reportCache";
import { useNavigate } from "react-router-dom";
import BookingDetailPopup from "@/components/BookingDetailPopup";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} rb`;
  return String(n);
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
  "#65a30d",
  "#0f766e",
];

const UNSET = "Tanpa Tipe";

function ColumnFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Filter ${label}`}
          className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${
            value ? "text-primary" : "text-muted-foreground/60"
          }`}
        >
          <Filter className={`h-3.5 w-3.5 ${value ? "fill-current" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0 bg-popover z-50">
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-semibold">Filter {label}</p>
        </div>
        {options.length > 8 && (
          <div className="p-2 border-b">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari..."
              className="h-8 text-xs"
            />
          </div>
        )}
        <div className="max-h-64 overflow-auto py-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${!value ? "font-semibold" : ""}`}
          >
            Semua {label}
          </button>
          {list.map((o) => (
            <button
              key={o}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted truncate ${
                value === o ? "font-semibold text-primary" : ""
              }`}
            >
              {o}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ada data</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const normPhone = (p?: string | null) => (p || "").replace(/\D/g, "").replace(/^0+/, "").replace(/^62/, "");


interface TxRow {
  id: string;
  bid: string;
  date: string;
  source: "Kamar" | "POS";
  customerName: string;
  phone: string;
  customerType: string;
  roomRevenue: number;
  productRevenue: number;
  total: number;
  paymentMethod: string;
  status: string;
}

interface TypeSummary {
  type: string;
  transactions: number;
  customers: number;
  roomRevenue: number;
  productRevenue: number;
  total: number;
  avgPerTx: number;
  avgPerCustomer: number;
  share: number;
  registered: number;
}

export default function CustomerTypeReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [registeredByType, setRegisteredByType] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ringkasan" | "grafik" | "detail">("ringkasan");
  const [bookingPopupId, setBookingPopupId] = useState<string | null>(null);
  const navigate = useNavigate();

  const openBid = (r: TxRow) => {
    if (r.source === "POS") {
      navigate(`/pos-order/${r.id}`);
    } else {
      setBookingPopupId(r.id);
    }
  };

  const openCrm = (r: TxRow) => {
    const params = new URLSearchParams({ tab: "customers", customersSection: "crm" });
    if (r.phone && r.phone !== "-") params.set("crmPhone", r.phone);
    if (r.customerName) params.set("crmName", r.customerName);
    navigate(`/dashboard?${params.toString()}`);
  };

  const { startDate, endDate } = getDateRange(timeRange, customDateRange);
  const rangeLabel = getDateRangeDisplay(timeRange, customDateRange);

  const cacheKey = currentStore
    ? `ctr:${currentStore.id}:${format(startDate, "yyyy-MM-dd")}:${format(endDate, "yyyy-MM-dd")}`
    : "";

  useEffect(() => {
    if (!currentStore) return;
    const cached = getReportCache<{ rows: TxRow[]; registeredByType: Record<string, number> }>(cacheKey);
    if (cached) {
      setRows(cached.rows);
      setRegisteredByType(cached.registeredByType);
      setLoading(false);
      void load(true); // refresh diam-diam
    } else {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id, timeRange, customDateRange]);

  const load = async (silent = false) => {
    if (!currentStore) return;
    if (!silent) setLoading(true);
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [{ data: customers }, { data: bookings }, { data: orders }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, phone, customer_type")
          .eq("store_id", currentStore.id),
        supabase
          .from("bookings")
          .select("id, bid, date, customer_name, phone, price, price_2, payment_method, status")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("booking_orders")
          .select("id, bid, date, customer_name, customer_phone, total_amount, payment_method, process_status")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
      ]);

      // Index customers by phone & lowercase name
      const byPhone = new Map<string, string>();
      const byName = new Map<string, string>();
      const regCount: Record<string, number> = {};
      (customers || []).forEach((c: any) => {
        const t = (c.customer_type || "").trim() || UNSET;
        regCount[t] = (regCount[t] || 0) + 1;
        const ph = normPhone(c.phone);
        if (ph && !byPhone.has(ph)) byPhone.set(ph, t);
        const nm = (c.name || "").trim().toLowerCase();
        if (nm && !byName.has(nm)) byName.set(nm, t);
      });
      setRegisteredByType(regCount);

      const resolveType = (name?: string | null, phone?: string | null) => {
        const ph = normPhone(phone);
        if (ph && byPhone.has(ph)) return byPhone.get(ph)!;
        const nm = (name || "").trim().toLowerCase();
        if (nm && byName.has(nm)) return byName.get(nm)!;
        return UNSET;
      };

      const bookingIds = (bookings || []).map((b: any) => b.id);
      let productsByBooking: Record<string, number> = {};
      if (bookingIds.length > 0) {
        const { data: bps } = await supabase
          .from("booking_products")
          .select("booking_id, subtotal")
          .in("booking_id", bookingIds);
        (bps || []).forEach((p: any) => {
          productsByBooking[p.booking_id] = (productsByBooking[p.booking_id] || 0) + (Number(p.subtotal) || 0);
        });
      }

      const bookingRows: TxRow[] = (bookings || [])
        .filter((b: any) => (b.status || "").toUpperCase() !== "BATAL")
        .map((b: any) => {
          const room = (Number(b.price) || 0) + (Number(b.price_2) || 0);
          const prod = productsByBooking[b.id] || 0;
          return {
            id: b.id,
            bid: b.bid || "-",
            date: b.date,
            source: "Kamar" as const,
            customerName: b.customer_name || "-",
            phone: b.phone || "-",
            customerType: resolveType(b.customer_name, b.phone),
            roomRevenue: room,
            productRevenue: prod,
            total: room + prod,
            paymentMethod: b.payment_method || "-",
            status: b.status || "-",
          };
        });

      const orderRows: TxRow[] = (orders || [])
        .filter((o: any) => (o.process_status || "").toLowerCase() !== "batal")
        .map((o: any) => {
          const total = Number(o.total_amount) || 0;
          return {
            id: o.id,
            bid: o.bid || "-",
            date: o.date,
            source: "POS" as const,
            customerName: o.customer_name || "Walk-in POS",
            phone: o.customer_phone || "-",
            customerType: resolveType(o.customer_name, o.customer_phone),
            roomRevenue: 0,
            productRevenue: total,
            total,
            paymentMethod: o.payment_method || "-",
            status: o.process_status || "-",
          };
        });

      const all = [...bookingRows, ...orderRows].sort((a, b) => (a.date < b.date ? 1 : -1));
      setRows(all);
      setReportCache(cacheKey, { rows: all, registeredByType: regCount });
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat laporan tipe pelanggan");
    } finally {
      setLoading(false);
    }
  };

  const summaries: TypeSummary[] = useMemo(() => {
    const map = new Map<string, { tx: number; room: number; prod: number; keys: Set<string> }>();
    rows.forEach((r) => {
      const cur = map.get(r.customerType) || { tx: 0, room: 0, prod: 0, keys: new Set<string>() };
      cur.tx += 1;
      cur.room += r.roomRevenue;
      cur.prod += r.productRevenue;
      cur.keys.add(normPhone(r.phone) || r.customerName.trim().toLowerCase());
      map.set(r.customerType, cur);
    });
    const grand = rows.reduce((s, r) => s + r.total, 0) || 1;
    return Array.from(map.entries())
      .map(([type, v]) => {
        const total = v.room + v.prod;
        return {
          type,
          transactions: v.tx,
          customers: v.keys.size,
          roomRevenue: v.room,
          productRevenue: v.prod,
          total,
          avgPerTx: v.tx ? total / v.tx : 0,
          avgPerCustomer: v.keys.size ? total / v.keys.size : 0,
          share: (total / grand) * 100,
          registered: registeredByType[type] || 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows, registeredByType]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const customers = new Set(rows.map((r) => normPhone(r.phone) || r.customerName.trim().toLowerCase())).size;
    const top = summaries[0];
    return {
      total,
      transactions: rows.length,
      customers,
      avg: rows.length ? total / rows.length : 0,
      topType: top?.type || "-",
      topShare: top?.share || 0,
      typeCount: summaries.filter((s) => s.type !== UNSET).length,
    };
  }, [rows, summaries]);

  const trendData = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
    const types = summaries.map((s) => s.type);
    return dates.map((d) => {
      const entry: Record<string, any> = {
        date: d,
        label: format(parseISO(d), "d MMM", { locale: localeId }),
      };
      types.forEach((t) => {
        entry[t] = rows.filter((r) => r.date === d && r.customerType === t).reduce((s, r) => s + r.total, 0);
      });
      return entry;
    });
  }, [rows, summaries]);

  const [colFilters, setColFilters] = useState<Record<string, string | null>>({
    source: null,
    customerType: null,
    paymentMethod: null,
  });

  const colOptions = (key: keyof TxRow) =>
    Array.from(new Set(rows.map((r) => String(r[key] || "-")))).sort((a, b) =>
      a.localeCompare(b, "id"),
    );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.customerType !== typeFilter) return false;
      if (colFilters.source && r.source !== colFilters.source) return false;
      if (colFilters.customerType && r.customerType !== colFilters.customerType) return false;
      if (colFilters.paymentMethod && (r.paymentMethod || "-") !== colFilters.paymentMethod) return false;
      if (!q) return true;
      return (
        r.bid.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.customerType.toLowerCase().includes(q)
      );
    });
  }, [rows, typeFilter, search, colFilters]);

  const pg = usePagination(filteredRows, [typeFilter, search, colFilters, filteredRows.length]);


  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; type: string; tx: number; total: number; phone: string }>();
    rows.forEach((r) => {
      const key = normPhone(r.phone) || r.customerName.trim().toLowerCase();
      const cur = map.get(key) || { name: r.customerName, type: r.customerType, tx: 0, total: 0, phone: r.phone };
      cur.tx += 1;
      cur.total += r.total;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [rows]);

  const handleExport = async () => {
    if (rows.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const summarySheet = [
      { Keterangan: "Laporan Penjualan per Tipe Pelanggan", Nilai: rangeLabel },
      { Keterangan: "Cabang", Nilai: currentStore?.name || "-" },
      { Keterangan: "Total Pendapatan", Nilai: totals.total },
      { Keterangan: "Total Transaksi", Nilai: totals.transactions },
      { Keterangan: "Total Pelanggan Unik", Nilai: totals.customers },
      { Keterangan: "Rata-rata per Transaksi", Nilai: Math.round(totals.avg) },
      { Keterangan: "Tipe Terbesar", Nilai: `${totals.topType} (${totals.topShare.toFixed(1)}%)` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), "Ringkasan");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        summaries.map((s) => ({
          "Tipe Pelanggan": s.type,
          "Pelanggan Terdaftar": s.registered,
          "Pelanggan Aktif": s.customers,
          Transaksi: s.transactions,
          "Pendapatan Kamar": s.roomRevenue,
          "Pendapatan Produk": s.productRevenue,
          "Total Pendapatan": s.total,
          "Rata-rata / Transaksi": Math.round(s.avgPerTx),
          "Rata-rata / Pelanggan": Math.round(s.avgPerCustomer),
          "Kontribusi (%)": Number(s.share.toFixed(2)),
        })),
      ),
      "Per Tipe",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          Tanggal: r.date,
          BID: r.bid,
          Sumber: r.source,
          "Nama Pelanggan": r.customerName,
          "No. HP": r.phone,
          "Tipe Pelanggan": r.customerType,
          "Pendapatan Kamar": r.roomRevenue,
          "Pendapatan Produk": r.productRevenue,
          Total: r.total,
          "Metode Bayar": r.paymentMethod,
          Status: r.status,
        })),
      ),
      "Detail Transaksi",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        topCustomers.map((c, i) => ({
          Peringkat: i + 1,
          "Nama Pelanggan": c.name,
          "Tipe Pelanggan": c.type,
          Transaksi: c.tx,
          "Total Belanja": c.total,
        })),
      ),
      "Top Pelanggan",
    );

    XLSX.writeFile(
      wb,
      `Laporan_Tipe_Pelanggan_${(currentStore?.name || "Store").replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`,
    );
    toast.success("Laporan berhasil diekspor");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari BID, pelanggan, tipe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe Pelanggan</SelectItem>
            {summaries.map((s) => (
              <SelectItem key={s.type} value={s.type}>
                {s.type} ({s.transactions})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 lg:justify-end">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button variant="outline" onClick={handleExport} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
          {/* Stat cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Total Pendapatan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">{fmtIDR(totals.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">{totals.transactions} transaksi</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Pelanggan Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{totals.customers}</div>
                <p className="text-xs text-muted-foreground mt-1">{totals.typeCount} tipe pelanggan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Repeat className="h-4 w-4" /> Rata-rata / Transaksi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{fmtIDR(totals.avg)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Tipe Terbesar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{totals.topType}</div>
                <p className="text-xs text-muted-foreground mt-1">{totals.topShare.toFixed(1)}% dari total</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
              <TabsTrigger value="grafik">Grafik</TabsTrigger>
              <TabsTrigger value="detail">Detail Transaksi</TabsTrigger>
            </TabsList>

            {/* Ringkasan */}
            <TabsContent value="ringkasan" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Penjualan per Tipe Pelanggan — {rangeLabel}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipe Pelanggan</TableHead>
                        <TableHead className="text-right">Terdaftar</TableHead>
                        <TableHead className="text-right">Aktif</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Kamar</TableHead>
                        <TableHead className="text-right">Produk</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Rata2/Trx</TableHead>
                        <TableHead className="text-right">Rata2/Pelanggan</TableHead>
                        <TableHead className="text-right">Kontribusi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                            Tidak ada data pada periode ini
                          </TableCell>
                        </TableRow>
                      ) : (
                        summaries.map((s, i) => (
                          <TableRow key={s.type}>
                            <TableCell className="font-medium">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle"
                                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              {s.type}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{s.registered}</TableCell>
                            <TableCell className="text-right tabular-nums">{s.customers}</TableCell>
                            <TableCell className="text-right tabular-nums">{s.transactions}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtIDR(s.roomRevenue)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtIDR(s.productRevenue)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtIDR(s.total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtIDR(s.avgPerTx)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtIDR(s.avgPerCustomer)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{s.share.toFixed(1)}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 15 Pelanggan</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Nama Pelanggan</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Total Belanja</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Tidak ada data
                          </TableCell>
                        </TableRow>
                      ) : (
                        topCustomers.map((c, i) => (
                          <TableRow key={`${c.name}-${i}`}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="text-blue-600 hover:underline text-left"
                                onClick={() => openCrm({ phone: c.phone, customerName: c.name } as TxRow)}
                              >
                                {c.name}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{c.type}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{c.tx}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtIDR(c.total)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Grafik */}
            <TabsContent value="grafik" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pendapatan per Tipe Pelanggan</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summaries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtIDR(Number(v))} />
                        <Legend />
                        <Bar dataKey="roomRevenue" name="Kamar" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="productRevenue" name="Produk" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Kontribusi Pendapatan</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summaries}
                          dataKey="total"
                          nameKey="type"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={2}
                          label={(e: any) => `${e.type} ${e.share?.toFixed(0)}%`}
                        >
                          {summaries.map((s, i) => (
                            <Cell key={s.type} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtIDR(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Jumlah Transaksi per Tipe</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summaries} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="transactions" name="Transaksi" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tren Harian per Tipe</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtIDR(Number(v))} />
                        <Legend />
                        {summaries.map((s, i) => (
                          <Line
                            key={s.type}
                            type="monotone"
                            dataKey={s.type}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Detail */}
            <TabsContent value="detail" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base">Detail Transaksi ({filteredRows.length})</CardTitle>
                  <div className="relative w-full sm:w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari BID, pelanggan, tipe..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>BID</TableHead>
                        <TableHead>
                          <span className="inline-flex items-center">
                            Sumber
                            <ColumnFilter
                              label="Sumber"
                              value={colFilters.source}
                              options={colOptions("source")}
                              onChange={(v) => setColFilters((p) => ({ ...p, source: v }))}
                            />
                          </span>
                        </TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>No. HP</TableHead>
                        <TableHead>
                          <span className="inline-flex items-center">
                            Tipe
                            <ColumnFilter
                              label="Tipe"
                              value={colFilters.customerType}
                              options={colOptions("customerType")}
                              onChange={(v) => setColFilters((p) => ({ ...p, customerType: v }))}
                            />
                          </span>
                        </TableHead>
                        <TableHead className="text-right">Kamar</TableHead>
                        <TableHead className="text-right">Produk</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>
                          <span className="inline-flex items-center">
                            Metode Bayar
                            <ColumnFilter
                              label="Metode Bayar"
                              value={colFilters.paymentMethod}
                              options={colOptions("paymentMethod")}
                              onChange={(v) => setColFilters((p) => ({ ...p, paymentMethod: v }))}
                            />
                          </span>
                        </TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.paginated.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                            Tidak ada transaksi
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {pg.paginated.map((r) => (
                            <TableRow key={`${r.source}-${r.id}`}>
                              <TableCell className="whitespace-nowrap">
                                {format(parseISO(r.date), "d MMM yyyy", { locale: localeId })}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <button
                                  type="button"
                                  onClick={() => openBid(r)}
                                  className="text-primary hover:underline font-medium"
                                  title="Buka detail BID"
                                >
                                  {r.bid}
                                </button>
                              </TableCell>
                              <TableCell>
                                <Badge variant={r.source === "Kamar" ? "default" : "secondary"}>{r.source}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                <button
                                  type="button"
                                  onClick={() => openCrm(r)}
                                  className="text-primary hover:underline text-left"
                                  title="Buka CRM pelanggan"
                                >
                                  {r.customerName}
                                </button>
                              </TableCell>
                              <TableCell className="tabular-nums">{r.phone}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{r.customerType}</Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{fmtIDR(r.roomRevenue)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmtIDR(r.productRevenue)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">{fmtIDR(r.total)}</TableCell>
                              <TableCell>{r.paymentMethod}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 border-t-2 font-semibold sticky bottom-0">
                            <TableCell colSpan={6} className="text-right">
                              Total ({filteredRows.length} transaksi)
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtIDR(filteredRows.reduce((s, r) => s + r.roomRevenue, 0))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtIDR(filteredRows.reduce((s, r) => s + r.productRevenue, 0))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-green-600">
                              {fmtIDR(filteredRows.reduce((s, r) => s + r.total, 0))}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                  <ReportPagination
                    page={pg.page}
                    totalPages={pg.totalPages}
                    total={pg.total}
                    pageSize={pg.pageSize}
                    onPageChange={pg.setPage}
                    onPageSizeChange={pg.setPageSize}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {bookingPopupId && (
        <BookingDetailPopup
          isOpen={!!bookingPopupId}
          onClose={() => setBookingPopupId(null)}
          bookingId={bookingPopupId}
          statusColors={{ BO: "#87CEEB", CI: "#90EE90", CO: "#6B7280", BATAL: "#9CA3AF" }}
          onStatusChange={() => void load()}
        />
      )}
    </div>
  );
}
