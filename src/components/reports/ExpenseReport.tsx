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
import { Search, Download, Copy as CopyIcon, FileText } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";

interface ExpenseRow {
  id: string;
  bid: string;
  date: string;
  created_by: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string;
  payment_proof_url: string | null;
  process_status: string;
  creator_name?: string;
}

interface ExpenseReportProps {
  processStatusFilter?: "active" | "batal";
}

export default function ExpenseReport({ processStatusFilter = "active" }: ExpenseReportProps) {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
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
        .from("expenses")
        .select("id, bid, date, created_by, description, amount, category, payment_method, payment_proof_url, process_status")
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

      const list = (data || []) as any[];
      const creatorIds = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", creatorIds);
        if (profiles) nameMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
      }
      setRows(list.map((r) => ({ ...r, creator_name: nameMap[r.created_by] || "-" })));
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data pengeluaran");
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
        (r.description || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const byCategory: Record<string, number> = {};
    filtered.forEach((r) => {
      const c = r.category || "Lainnya";
      byCategory[c] = (byCategory[c] || 0) + (Number(r.amount) || 0);
    });
    return { total, count: filtered.length, byCategory };
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
      Deskripsi: r.description || "-",
      Kategori: r.category || "-",
      Jumlah: r.amount,
      "Metode Bayar": r.payment_method || "-",
      Status: r.process_status,
      "Dibuat Oleh": r.creator_name || "-",
    }));
    const dateStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, "_");
    exportToExcel(data, "Pengeluaran", getExportFileName("Laporan_Pengeluaran", currentStore.name, dateStr));
    toast.success("Export berhasil");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ID, deskripsi, kategori..."
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Per Kategori</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {Object.keys(stats.byCategory).length === 0 ? (
                    <span className="text-sm text-muted-foreground">-</span>
                  ) : (
                    Object.entries(stats.byCategory).map(([c, t]) => (
                      <Badge key={c} variant="secondary" className="font-normal">
                        {c}: {formatCurrency(t)}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. ID</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Metode Bayar</TableHead>
                      <TableHead>Bukti Bayar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat Oleh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Tidak ada data pengeluaran
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
                            <TableCell className="text-xs max-w-[240px] truncate" title={r.description || ""}>
                              {r.description || "-"}
                            </TableCell>
                            <TableCell className="text-xs">{r.category || "-"}</TableCell>
                            <TableCell className="text-right text-xs text-red-600 font-medium">
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
                            <TableCell className="text-xs">{r.creator_name || "-"}</TableCell>
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