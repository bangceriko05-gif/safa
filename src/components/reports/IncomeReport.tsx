import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Search, Download, Copy as CopyIcon, FileText, TrendingUp } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";

interface IncomeRow {
  id: string;
  bid: string;
  date: string;
  created_at: string;
  customer_name: string;
  description: string;
  amount: number;
  payment_method: string;
  payment_proof_url: string | null;
  process_status: string;
}

interface IncomeReportProps {
  processStatusFilter?: "active" | "batal";
}

export default function IncomeReport({ processStatusFilter = "active" }: IncomeReportProps) {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [timeRange, customDateRange, currentStore, processStatusFilter]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      let q = supabase
        .from("incomes")
        .select("id, bid, date, created_at, customer_name, description, amount, payment_method, payment_proof_url, process_status")
        .eq("store_id", currentStore.id)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (processStatusFilter === "active") {
        q = q.in("process_status", ["proses", "selesai"]);
      } else {
        q = q.eq("process_status", "batal");
      }

      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as any[]);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data pemasukan");
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
        (r.customer_name || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const byMethod: Record<string, number> = {};
    filtered.forEach((r) => {
      const m = r.payment_method || "Lainnya";
      byMethod[m] = (byMethod[m] || 0) + (Number(r.amount) || 0);
    });
    return { total, count: filtered.length, byMethod };
  }, [filtered]);

  const copyBid = (bid: string) => {
    navigator.clipboard.writeText(bid);
    toast.success("BID disalin");
  };

  const handleExport = () => {
    if (!currentStore || filtered.length === 0) return;
    const data = filtered.map((r) => ({
      "No. ID": r.bid || "-",
      Tanggal: format(new Date(r.date), "dd/MM/yyyy", { locale: localeId }),
      Pelanggan: r.customer_name || "-",
      Deskripsi: r.description || "-",
      Jumlah: r.amount,
      "Metode Bayar": r.payment_method || "-",
      Status: r.process_status,
    }));
    const dateStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, "_");
    exportToExcel(data, "Pemasukan", getExportFileName("Laporan_Pemasukan", currentStore.name, dateStr));
    toast.success("Export berhasil");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ID, pelanggan, deskripsi..."
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
        <Button variant="outline" onClick={handleExport} disabled={loading || filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
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
          {/* Stat cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Transaksi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pemasukan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Per Metode Bayar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(stats.byMethod).length === 0 ? (
                    <span className="text-sm text-muted-foreground">-</span>
                  ) : (
                    Object.entries(stats.byMethod).map(([m, t]) => (
                      <Badge key={m} variant="secondary" className="font-normal">
                        {m}: {formatCurrency(t)}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. ID</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Metode Bayar</TableHead>
                      <TableHead>Bukti Bayar</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Tidak ada data pemasukan
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => {
                        const isDone = r.process_status === "selesai";
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-primary">{r.bid || "-"}</span>
                                {r.bid && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyBid(r.bid)}>
                                    <CopyIcon className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(r.date), "dd MMM yyyy", { locale: localeId })}
                            </TableCell>
                            <TableCell className="text-xs">{r.customer_name || "-"}</TableCell>
                            <TableCell className="text-xs max-w-[260px] truncate" title={r.description || ""}>
                              {r.description || "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs text-green-600 font-medium">
                              {formatCurrency(Number(r.amount) || 0)}
                            </TableCell>
                            <TableCell className="text-xs">{r.payment_method || "-"}</TableCell>
                            <TableCell className="text-xs">
                              {r.payment_proof_url ? (
                                <button
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  onClick={() => setProofPreview(r.payment_proof_url!)}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Lihat
                                </button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  isDone
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : r.process_status === "batal"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                }
                              >
                                {isDone ? "Selesai" : r.process_status === "batal" ? "Batal" : "Proses"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!proofPreview} onOpenChange={() => setProofPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bukti Bayar</DialogTitle>
          </DialogHeader>
          {proofPreview && (
            <img src={proofPreview} alt="Bukti" className="w-full max-h-[70vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}