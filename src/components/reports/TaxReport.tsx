import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useStore } from "@/contexts/StoreContext";
import { Download, Receipt, Calculator, TrendingUp } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

interface TaxRow {
  date: string;
  bid: string;
  source: "Booking" | "Produk Booking" | "Pemasukan" | "Produk Pemasukan";
  description: string;
  mode: "include" | "exclude";
  rate: number;
  dpp: number;
  tax: number;
  total: number;
}

export default function TaxReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "include" | "exclude">("all");

  const { startDate, endDate } = getDateRange(timeRange, customDateRange);

  useEffect(() => {
    if (!currentStore) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id, timeRange, customDateRange]);

  const load = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // 1. Bookings (kamar) dengan PPN
      const { data: bks } = await supabase
        .from("bookings")
        .select("id, bid, date, customer_name, price, price_2, dual_payment, tax_enabled, tax_mode, tax_rate, tax_amount, dpp_amount")
        .eq("store_id", currentStore.id)
        .eq("tax_enabled", true)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "BATAL");

      // 2. booking_products dengan PPN
      const { data: bps } = await supabase
        .from("booking_products")
        .select("id, product_name, quantity, subtotal, tax_enabled, tax_mode, tax_rate, tax_amount, dpp_amount, booking_id, bookings!inner(bid, date, store_id, status)")
        .eq("tax_enabled", true)
        .eq("bookings.store_id", currentStore.id)
        .gte("bookings.date", startStr)
        .lte("bookings.date", endStr)
        .neq("bookings.status", "BATAL");

      // 3. incomes dengan PPN
      const { data: incs } = await supabase
        .from("incomes")
        .select("id, bid, date, description, amount, tax_enabled, tax_mode, tax_rate, tax_amount, dpp_amount")
        .eq("store_id", currentStore.id)
        .eq("tax_enabled", true)
        .gte("date", startStr)
        .lte("date", endStr);

      // 4. income_products dengan PPN
      const { data: ips } = await supabase
        .from("income_products")
        .select("id, product_name, quantity, subtotal, tax_enabled, tax_mode, tax_rate, tax_amount, dpp_amount, income_id, incomes!inner(bid, date, store_id)")
        .eq("tax_enabled", true)
        .eq("incomes.store_id", currentStore.id)
        .gte("incomes.date", startStr)
        .lte("incomes.date", endStr);

      const out: TaxRow[] = [];

      (bks || []).forEach((b: any) => {
        const total =
          (Number(b.price) || 0) +
          (b.dual_payment ? Number(b.price_2) || 0 : 0);
        out.push({
          date: b.date,
          bid: b.bid || "-",
          source: "Booking",
          description: `Kamar — ${b.customer_name}`,
          mode: b.tax_mode,
          rate: Number(b.tax_rate) || 0,
          dpp: Number(b.dpp_amount) || 0,
          tax: Number(b.tax_amount) || 0,
          total,
        });
      });

      (bps || []).forEach((p: any) => {
        out.push({
          date: p.bookings?.date || "",
          bid: p.bookings?.bid || "-",
          source: "Produk Booking",
          description: `${p.product_name} × ${p.quantity}`,
          mode: p.tax_mode,
          rate: Number(p.tax_rate) || 0,
          dpp: Number(p.dpp_amount) || 0,
          tax: Number(p.tax_amount) || 0,
          total: Number(p.subtotal) || 0,
        });
      });

      (incs || []).forEach((i: any) => {
        out.push({
          date: i.date,
          bid: i.bid || "-",
          source: "Pemasukan",
          description: i.description || "-",
          mode: i.tax_mode,
          rate: Number(i.tax_rate) || 0,
          dpp: Number(i.dpp_amount) || 0,
          tax: Number(i.tax_amount) || 0,
          total: Number(i.amount) || 0,
        });
      });

      (ips || []).forEach((p: any) => {
        out.push({
          date: p.incomes?.date || "",
          bid: p.incomes?.bid || "-",
          source: "Produk Pemasukan",
          description: `${p.product_name} × ${p.quantity}`,
          mode: p.tax_mode,
          rate: Number(p.tax_rate) || 0,
          dpp: Number(p.dpp_amount) || 0,
          tax: Number(p.tax_amount) || 0,
          total: Number(p.subtotal) || 0,
        });
      });

      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      setRows(out);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat data PPN");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (activeTab === "all") return rows;
    return rows.filter((r) => r.mode === activeTab);
  }, [rows, activeTab]);

  const summary = useMemo(() => {
    const incl = rows.filter((r) => r.mode === "include");
    const excl = rows.filter((r) => r.mode === "exclude");
    return {
      totalDpp: rows.reduce((s, r) => s + r.dpp, 0),
      totalTax: rows.reduce((s, r) => s + r.tax, 0),
      includeDpp: incl.reduce((s, r) => s + r.dpp, 0),
      includeTax: incl.reduce((s, r) => s + r.tax, 0),
      excludeDpp: excl.reduce((s, r) => s + r.dpp, 0),
      excludeTax: excl.reduce((s, r) => s + r.tax, 0),
    };
  }, [rows]);

  const exportExcel = () => {
    if (!filtered.length) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const data = filtered.map((r, i) => ({
      No: i + 1,
      Tanggal: r.date,
      BID: r.bid,
      Sumber: r.source,
      Deskripsi: r.description,
      Mode: r.mode === "include" ? "Include" : "Exclude",
      "Tarif (%)": r.rate,
      DPP: r.dpp,
      "PPN (Pajak Keluaran)": r.tax,
      Total: r.total,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan PPN");
    XLSX.writeFile(
      wb,
      `Laporan_PPN_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5" /> Laporan PPN (Pajak Keluaran)
        </h3>
        <div className="flex items-center gap-2">
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-2" /> Ekspor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Calculator className="h-4 w-4" /> Total DPP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtIDR(summary.totalDpp)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Include: {fmtIDR(summary.includeDpp)} • Exclude: {fmtIDR(summary.excludeDpp)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Total PPN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-primary">{fmtIDR(summary.totalTax)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Include: {fmtIDR(summary.includeTax)} • Exclude: {fmtIDR(summary.excludeTax)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Receipt className="h-4 w-4" /> Jumlah Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{rows.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Include: {rows.filter((r) => r.mode === "include").length} • Exclude:{" "}
              {rows.filter((r) => r.mode === "exclude").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Semua ({rows.length})</TabsTrigger>
          <TabsTrigger value="include">
            PPN Include ({rows.filter((r) => r.mode === "include").length})
          </TabsTrigger>
          <TabsTrigger value="exclude">
            PPN Exclude ({rows.filter((r) => r.mode === "exclude").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Tidak ada transaksi PPN pada periode ini.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>BID</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Tarif</TableHead>
                      <TableHead className="text-right">DPP</TableHead>
                      <TableHead className="text-right">PPN</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.date}</TableCell>
                        <TableCell className="font-mono text-xs">{r.bid}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {r.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.description}</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.mode === "include" ? "secondary" : "default"}
                            className="text-[10px]"
                          >
                            {r.mode === "include" ? "Include" : "Exclude"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{r.rate}%</TableCell>
                        <TableCell className="text-right text-xs">{fmtIDR(r.dpp)}</TableCell>
                        <TableCell className="text-right text-xs font-medium text-primary">
                          {fmtIDR(r.tax)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {fmtIDR(r.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}