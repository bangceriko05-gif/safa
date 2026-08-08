import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import {
  ShoppingCart, Download, Search, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Package,
} from "lucide-react";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";

interface Agg {
  product_name: string;
  qty: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  trx: number;
  suppliers: Set<string>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

export default function MonthlyPurchaseAnalysis() {
  const { currentStore } = useStore();
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Record<string, Agg>>({});
  const [previous, setPrevious] = useState<Record<string, Agg>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore, month]);

  const aggregate = async (from: Date, to: Date): Promise<Record<string, Agg>> => {
    const { data: purchases } = await supabase
      .from("purchases" as any)
      .select("id, date, supplier_name, process_status")
      .eq("store_id", currentStore!.id)
      .in("process_status", ["proses", "selesai"])
      .gte("date", format(from, "yyyy-MM-dd"))
      .lte("date", format(to, "yyyy-MM-dd"));

    const list = (purchases || []) as any[];
    if (list.length === 0) return {};

    const supplierByPurchase: Record<string, string> = {};
    list.forEach((p) => (supplierByPurchase[p.id] = p.supplier_name || "-"));

    const { data: itemsData } = await supabase
      .from("purchase_items" as any)
      .select("purchase_id, product_name, quantity, unit_price, subtotal")
      .in("purchase_id", list.map((p) => p.id));

    const map: Record<string, Agg> = {};
    (itemsData || []).forEach((it: any) => {
      const name = (it.product_name || "-").trim();
      const key = name.toLowerCase();
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      const sub = Number(it.subtotal) || qty * price;
      if (!map[key]) {
        map[key] = {
          product_name: name, qty: 0, total: 0, avg: 0,
          min: price, max: price, trx: 0, suppliers: new Set<string>(),
        };
      }
      const a = map[key];
      a.qty += qty;
      a.total += sub;
      a.trx += 1;
      if (price > 0) {
        a.min = a.min > 0 ? Math.min(a.min, price) : price;
        a.max = Math.max(a.max, price);
      }
      a.suppliers.add(supplierByPurchase[it.purchase_id] || "-");
    });
    Object.values(map).forEach((a) => (a.avg = a.qty > 0 ? a.total / a.qty : 0));
    return map;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const prevMonth = subMonths(month, 1);
      const [cur, prev] = await Promise.all([
        aggregate(startOfMonth(month), endOfMonth(month)),
        aggregate(startOfMonth(prevMonth), endOfMonth(prevMonth)),
      ]);
      setCurrent(cur);
      setPrevious(prev);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat analisa pembelian bulanan");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(current)
      .map(([key, a]) => {
        const p = previous[key];
        const prevAvg = p?.avg || 0;
        const diff = prevAvg > 0 ? a.avg - prevAvg : 0;
        const pct = prevAvg > 0 ? (diff / prevAvg) * 100 : null;
        return {
          key,
          ...a,
          suppliersText: Array.from(a.suppliers).join(", "),
          prevQty: p?.qty || 0,
          prevAvg,
          prevTotal: p?.total || 0,
          diff,
          pct,
          isNew: !p,
        };
      })
      .filter((r) => !q || r.product_name.toLowerCase().includes(q) || r.suppliersText.toLowerCase().includes(q))
      .sort((a, b) => b.total - a.total);
  }, [current, previous, search]);

  const summary = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const qty = rows.reduce((s, r) => s + r.qty, 0);
    const prevTotal = Object.values(previous).reduce((s, a) => s + a.total, 0);
    const naik = rows.filter((r) => r.pct !== null && r.pct > 0).length;
    const turun = rows.filter((r) => r.pct !== null && r.pct < 0).length;
    const tetap = rows.filter((r) => r.pct !== null && r.pct === 0).length;
    const baru = rows.filter((r) => r.isNew).length;
    const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { total, qty, prevTotal, naik, turun, tetap, baru, growth, produk: rows.length };
  }, [rows, previous]);

  const topNaik = useMemo(
    () => rows.filter((r) => r.pct !== null && r.pct > 0).sort((a, b) => (b.pct! - a.pct!)).slice(0, 5),
    [rows],
  );
  const topTurun = useMemo(
    () => rows.filter((r) => r.pct !== null && r.pct < 0).sort((a, b) => (a.pct! - b.pct!)).slice(0, 5),
    [rows],
  );

  const handleExport = () => {
    if (!currentStore || rows.length === 0) return;
    const data = rows.map((r) => ({
      Produk: r.product_name,
      Supplier: r.suppliersText,
      "Qty Bulan Ini": r.qty,
      "Total Bulan Ini": r.total,
      "Harga Rata2 Bulan Ini": Math.round(r.avg),
      "Harga Terendah": Math.round(r.min),
      "Harga Tertinggi": Math.round(r.max),
      "Qty Bulan Lalu": r.prevQty,
      "Harga Rata2 Bulan Lalu": Math.round(r.prevAvg),
      "Selisih Harga": Math.round(r.diff),
      "Perubahan (%)": r.pct === null ? "Baru" : `${r.pct.toFixed(2)}%`,
    }));
    exportToExcel(
      data,
      "Analisa Pembelian Bulanan",
      getExportFileName("Analisa_Pembelian_Bulanan", currentStore.name, format(month, "MMMM_yyyy", { locale: localeId })),
    );
    toast.success("Export berhasil");
  };

  const PctBadge = ({ pct, isNew }: { pct: number | null; isNew: boolean }) => {
    if (isNew) return <Badge variant="secondary">Baru</Badge>;
    if (pct === null || pct === 0)
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Minus className="h-3.5 w-3.5" /> 0%
        </span>
      );
    const up = pct > 0;
    return (
      <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-destructive" : "text-green-600"}`}>
        {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {up ? "+" : ""}{pct.toFixed(1)}%
      </span>
    );
  };

  const isCurrentMonth = format(month, "yyyy-MM") === format(new Date(), "yyyy-MM");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center font-semibold">
            {format(month, "MMMM yyyy", { locale: localeId })}
          </div>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk / supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[240px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pembelian</CardTitle>
                <ShoppingCart className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{fmt(summary.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bulan lalu: {fmt(summary.prevTotal)}
                  {summary.growth !== null && (
                    <span className={summary.growth > 0 ? " text-destructive" : " text-green-600"}>
                      {" "}({summary.growth > 0 ? "+" : ""}{summary.growth.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jumlah Produk</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.produk}</div>
                <p className="text-xs text-muted-foreground mt-1">{summary.baru} produk baru dibeli</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Qty</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtNum(summary.qty)}</div>
                <p className="text-xs text-muted-foreground mt-1">unit dibeli bulan ini</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pergerakan Harga</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <span className="text-destructive inline-flex items-center gap-1"><TrendingUp className="h-4 w-4" />{summary.naik} naik</span>
                  <span className="text-green-600 inline-flex items-center gap-1"><TrendingDown className="h-4 w-4" />{summary.turun} turun</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{summary.tetap} harga tetap</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Kenaikan Harga Tertinggi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topNaik.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada kenaikan harga</p>
                ) : topNaik.map((r) => (
                  <div key={r.key} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">{fmt(r.prevAvg)} → {fmt(r.avg)}</div>
                    </div>
                    <PctBadge pct={r.pct} isNew={false} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Penurunan Harga Tertinggi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topTurun.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada penurunan harga</p>
                ) : topTurun.map((r) => (
                  <div key={r.key} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">{fmt(r.prevAvg)} → {fmt(r.avg)}</div>
                    </div>
                    <PctBadge pct={r.pct} isNew={false} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Detail Pembelian per Produk — {format(month, "MMMM yyyy", { locale: localeId })}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Perbandingan harga rata-rata terhadap {format(subMonths(month, 1), "MMMM yyyy", { locale: localeId })}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total Beli</TableHead>
                      <TableHead className="text-right">Harga Rata²</TableHead>
                      <TableHead className="text-right">Terendah</TableHead>
                      <TableHead className="text-right">Tertinggi</TableHead>
                      <TableHead className="text-right">Bulan Lalu</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead className="text-right">Perubahan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Tidak ada pembelian pada bulan ini
                        </TableCell>
                      </TableRow>
                    ) : rows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium">{r.product_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[180px] truncate">{r.suppliersText}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.qty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.total)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(r.avg)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.min)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.max)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.prevAvg > 0 ? fmt(r.prevAvg) : "-"}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${r.diff > 0 ? "text-destructive" : r.diff < 0 ? "text-green-600" : ""}`}>
                          {r.prevAvg > 0 ? `${r.diff > 0 ? "+" : ""}${fmt(r.diff)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right"><PctBadge pct={r.pct} isNew={r.isNew} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
