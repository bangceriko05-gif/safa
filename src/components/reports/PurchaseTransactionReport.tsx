import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { ShoppingCart, Download, Search } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";

type SubView = "active" | "cancelled";

interface PurchaseRow {
  id: string;
  bid: string;
  date: string;
  supplier_name: string | null;
  amount: number;
  payment_method: string | null;
  process_status: string;
  notes: string | null;
}

interface PurchaseItemRow {
  purchase_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export default function PurchaseTransactionReport() {
  const { currentStore } = useStore();
  const [subView, setSubView] = useState<SubView>("active");
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [items, setItems] = useState<Record<string, PurchaseItemRow[]>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [timeRange, customDateRange, currentStore, subView]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const statusFilter = subView === "cancelled" ? ["batal"] : ["proses", "selesai"];

      const { data, error } = await supabase
        .from("purchases" as any)
        .select("id, bid, date, supplier_name, amount, payment_method, process_status, notes")
        .eq("store_id", currentStore.id)
        .in("process_status", statusFilter)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (error) throw error;
      const list = (data || []) as unknown as PurchaseRow[];
      setRows(list);

      // Fetch items for shown purchases (best-effort, table may not exist)
      const ids = list.map((r) => r.id);
      if (ids.length > 0) {
        try {
          const { data: itemsData } = await supabase
            .from("purchase_items" as any)
            .select("purchase_id, product_name, quantity, unit_price, subtotal")
            .in("purchase_id", ids);
          const map: Record<string, PurchaseItemRow[]> = {};
          (itemsData || []).forEach((it: any) => {
            if (!map[it.purchase_id]) map[it.purchase_id] = [];
            map[it.purchase_id].push(it);
          });
          setItems(map);
        } catch {
          setItems({});
        }
      } else {
        setItems({});
      }
    } catch (err) {
      console.error("Error loading purchases:", err);
      toast.error("Gagal memuat data pembelian");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.bid || "").toLowerCase().includes(q) ||
        (r.supplier_name || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const count = filtered.length;
    const avg = count > 0 ? total / count : 0;
    return { total, count, avg };
  }, [filtered]);

  const handleExport = () => {
    if (!currentStore || filtered.length === 0) return;
    const data = filtered.map((r) => {
      const it = items[r.id] || [];
      const itemsText = it.length > 0 ? it.map((i) => `${i.product_name} x${i.quantity}`).join(", ") : "-";
      return {
        BID: r.bid || "-",
        Tanggal: format(new Date(r.date), "dd/MM/yyyy", { locale: localeId }),
        Supplier: r.supplier_name || "-",
        Produk: itemsText,
        Total: r.amount,
        "Metode Bayar": r.payment_method || "-",
        Status: r.process_status,
      };
    });
    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, "_");
    const reportType = subView === "cancelled" ? "Pembatalan_Pembelian" : "Pembelian";
    exportToExcel(data, "Pembelian", getExportFileName(reportType, currentStore.name, dateRangeStr));
    toast.success("Export berhasil");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <Select value={subView} onValueChange={(v) => setSubView(v as SubView)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Laporan Pembelian</SelectItem>
              <SelectItem value="cancelled">Laporan Pembatalan Pembelian</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari BID, supplier, produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[260px]"
            />
          </div>
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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
                <div className="text-2xl font-bold">{stats.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {subView === "cancelled" ? "Total Dibatalkan" : "Total Pembelian"}
                </CardTitle>
                <ShoppingCart className={`h-4 w-4 ${subView === "cancelled" ? "text-destructive" : "text-orange-600"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${subView === "cancelled" ? "text-destructive" : "text-orange-600"}`}>
                  {formatCurrency(stats.total)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rata-rata per Transaksi</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.avg)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BID</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Metode Bayar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Tidak ada data pembelian
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => {
                      const it = items[r.id] || [];
                      const productLabel = it.length > 0 ? it.map((i) => `${i.product_name} x${i.quantity}`).join(", ") : "-";
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.bid || "-"}</TableCell>
                          <TableCell>{format(new Date(r.date), "d MMM yyyy", { locale: localeId })}</TableCell>
                          <TableCell>{r.supplier_name || "-"}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{productLabel}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(Number(r.amount) || 0)}</TableCell>
                          <TableCell>{r.payment_method || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.process_status === "selesai"
                                  ? "default"
                                  : r.process_status === "batal"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {r.process_status === "selesai"
                                ? "Selesai"
                                : r.process_status === "batal"
                                ? "Batal"
                                : "Proses"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
