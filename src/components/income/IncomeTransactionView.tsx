import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Copy, FileText, CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "../reports/ReportDateFilter";
import { DateRange } from "react-day-picker";

interface Income {
  id: string;
  bid: string;
  description: string | null;
  amount: number;
  customer_name: string | null;
  category: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  verification_status: string;
  status: string;
  process_status: string;
  reference_no: string | null;
  date: string;
  created_by: string;
  store_id: string;
}

const PROCESS_TABS = [
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
  { key: "batal", label: "Batal" },
  { key: "dihapus", label: "Dihapus" },
];

interface IncomeTransactionViewProps {
  onOpenAddIncome?: () => void;
}

export default function IncomeTransactionView({ onOpenAddIncome }: IncomeTransactionViewProps) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const showVerification = isFeatureEnabled("reports.accounting");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [processTab, setProcessTab] = useState("proses");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [noteDialogData, setNoteDialogData] = useState<Income | null>(null);

  const fetchIncomes = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("store_id", currentStore.id)
        .eq("process_status", processTab)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (error) throw error;
      setIncomes((data as any[]) || []);
    } catch (error) {
      console.error("Error fetching incomes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, [currentStore, processTab, timeRange, customDateRange]);

  const filteredIncomes = useMemo(() => {
    let result = incomes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.customer_name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.bid?.toLowerCase().includes(q)
      );
    }
    if (paymentFilter !== "all") {
      result = result.filter((i) => i.payment_method === paymentFilter);
    }
    if (verificationFilter !== "all") {
      result = result.filter((i) => i.verification_status === verificationFilter);
    }
    return result;
  }, [incomes, searchQuery, paymentFilter, verificationFilter]);

  const total = useMemo(() => filteredIncomes.reduce((s, i) => s + Number(i.amount), 0), [filteredIncomes]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const updateField = async (id: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      if (field === "status") {
        if (value === "tunda") updateData.process_status = "proses";
        else if (value === "selesai") updateData.process_status = "selesai";
        else if (value === "batal") updateData.process_status = "batal";
      }
      const { error } = await supabase
        .from("incomes")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      if (field === "status" && updateData.process_status && updateData.process_status !== processTab) {
        setIncomes((prev) => prev.filter((i) => i.id !== id));
      } else {
        setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, ...updateData } : i)));
      }
      toast.success("Data berhasil diperbarui");
    } catch (error) {
      console.error("Error updating income:", error);
      toast.error("Gagal memperbarui data");
    }
  };

  const copyBid = (bid: string) => {
    navigator.clipboard.writeText(bid);
    toast.success("BID disalin!");
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set(incomes.map((i) => i.payment_method).filter(Boolean));
    return Array.from(methods) as string[];
  }, [incomes]);

  const dateRangeLabel = getDateRangeDisplay(timeRange, customDateRange);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-xl font-bold">Transaksi Pemasukan</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-green-600">Total: {formatCurrency(total)}</span>
              {onOpenAddIncome && hasPermission("report_income_add") && (
                <Button onClick={onOpenAddIncome} className="bg-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pemasukan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Process status tabs */}
          <Tabs value={processTab} onValueChange={setProcessTab}>
            <TabsList className="grid w-full grid-cols-4">
              {PROCESS_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan pelanggan, deskripsi, BID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(total)}</span>
            <ReportDateFilter
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              customDateRange={customDateRange}
              onCustomDateRangeChange={setCustomDateRange}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <CalendarIcon className="h-4 w-4" />
              {dateRangeLabel}
            </div>
          </div>

          {/* Secondary filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Semua Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                {uniquePaymentMethods.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showVerification && (
              <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Semua Verifikasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Verifikasi</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
          ) : filteredIncomes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Tidak ada data pemasukan</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>BID</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Bukti Bayar</TableHead>
                    {showVerification && <TableHead>Verifikasi</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(income.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {income.bid || '-'}
                          </Badge>
                          {income.bid && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyBid(income.bid)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{income.customer_name || '-'}</TableCell>
                      <TableCell>
                        {income.description ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-blue-600"
                            onClick={() => setNoteDialogData(income)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Lihat
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{income.payment_method || '-'}</TableCell>
                      <TableCell>
                        {income.payment_proof_url ? (
                          <a href={income.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                            Lihat
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {showVerification && (
                        <TableCell>
                          <Select
                            value={income.verification_status}
                            onValueChange={(val) => updateField(income.id, "verification_status", val)}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <Badge
                                variant="outline"
                                className={
                                  income.verification_status === "Verified"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-orange-50 text-orange-700 border-orange-200"
                                }
                              >
                                {income.verification_status === "Verified" ? "✓" : "⚠"} {income.verification_status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Unverified">Unverified</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={income.status}
                          onValueChange={(val) => updateField(income.id, "status", val)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <Badge
                              variant="outline"
                              className={
                                income.status === "selesai"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : income.status === "batal"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {income.status === "selesai" ? "Selesai" : income.status === "batal" ? "Batal" : "Tunda"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tunda">Tunda</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                            <SelectItem value="batal">Batal</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(Number(income.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note Dialog */}
      {noteDialogData && (
        <IncomeNoteDialog
          income={noteDialogData}
          onClose={() => setNoteDialogData(null)}
        />
      )}
    </div>
  );
}

function IncomeNoteDialog({ income, onClose }: { income: Income; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Detail Pemasukan</h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">BID:</span>
            <p className="font-mono text-sm">{income.bid || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Pelanggan:</span>
            <p className="text-sm">{income.customer_name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Deskripsi:</span>
            <p className="text-sm">{income.description || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Tanggal:</span>
            <p className="text-sm">{format(new Date(income.date), "dd MMMM yyyy", { locale: localeId })}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Total:</span>
            <p className="text-sm font-bold text-green-600">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(income.amount)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}
