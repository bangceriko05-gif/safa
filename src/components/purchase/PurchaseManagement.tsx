import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, CalendarIcon, Copy, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import AddPurchaseModal from "./AddPurchaseModal";
import PurchaseNoteDialog from "./PurchaseNoteDialog";

interface Purchase {
  id: string;
  bid: string;
  supplier_name: string;
  date: string;
  notes: string | null;
  amount: number;
  payment_method: string;
  payment_proof_url: string | null;
  receipt_status: string;
  verification_status: string;
  status: string;
  process_status: string;
  store_id: string;
  created_by: string;
}

const PROCESS_TABS = [
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
  { key: "batal", label: "Batal" },
  { key: "dihapus", label: "Dihapus" },
];

const TIME_RANGES = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "custom", label: "Custom" },
];

export default function PurchaseManagement() {
  const { currentStore } = useStore();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processTab, setProcessTab] = useState("proses");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [bidFilter, setBidFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteDialogPurchaseId, setNoteDialogPurchaseId] = useState<string | null>(null);

  const getDateRange = () => {
    const now = new Date();
    if (timeRange === "today") {
      return { start: now, end: now };
    } else if (timeRange === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    } else if (timeRange === "month") {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (timeRange === "custom" && customDateRange?.from) {
      return { start: customDateRange.from, end: customDateRange.to || customDateRange.from };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const fetchPurchases = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("purchases" as any)
        .select("*")
        .eq("store_id", currentStore.id)
        .eq("process_status", processTab)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (error) throw error;
      setPurchases((data as any[]) || []);
    } catch (error) {
      console.error("Error fetching purchases:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [currentStore, processTab, timeRange, customDateRange]);

  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.supplier_name?.toLowerCase().includes(q) ||
          p.bid?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
      );
    }
    if (bidFilter !== "all") {
      result = result.filter((p) => p.bid?.startsWith(bidFilter));
    }
    if (paymentFilter !== "all") {
      result = result.filter((p) => p.payment_method === paymentFilter);
    }
    return result;
  }, [purchases, searchQuery, bidFilter, paymentFilter]);

  const total = useMemo(() => filteredPurchases.reduce((s, p) => s + Number(p.amount), 0), [filteredPurchases]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const { start, end } = getDateRange();
  const dateRangeLabel = `${format(start, "dd MMM yyyy", { locale: localeId })} - ${format(end, "dd MMM yyyy", { locale: localeId })}`;

  const updateField = async (id: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from("purchases" as any)
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
      toast.success("Data berhasil diperbarui");
    } catch (error) {
      console.error("Error updating purchase:", error);
      toast.error("Gagal memperbarui data");
    }
  };

  const copyBid = (bid: string) => {
    navigator.clipboard.writeText(bid);
    toast.success("BID disalin!");
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set(purchases.map((p) => p.payment_method).filter(Boolean));
    return Array.from(methods);
  }, [purchases]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-xl font-bold">Transaksi Pembelian</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-red-500">Total: {formatCurrency(total)}</span>
              <Button onClick={() => setShowAddModal(true)} className="bg-primary">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Pembelian
              </Button>
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
                placeholder="Cari berdasarkan supplier, BID, catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(total)}</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((tr) => (
                  <SelectItem key={tr.key} value={tr.key}>
                    {tr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {timeRange === "custom" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {customDateRange?.from
                      ? `${format(customDateRange.from, "dd MMM", { locale: localeId })} - ${customDateRange.to ? format(customDateRange.to, "dd MMM", { locale: localeId }) : "..."}`
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <CalendarIcon className="h-4 w-4" />
                {dateRangeLabel}
              </div>
            )}
          </div>

          {/* Secondary filters */}
          <div className="flex gap-2">
            <Select value={bidFilter} onValueChange={setBidFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Semua BID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua BID</SelectItem>
                <SelectItem value="PO-">PO-</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Semua Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                {uniquePaymentMethods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Tidak ada data pembelian</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>BID</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Bukti Bayar</TableHead>
                    <TableHead>Penerimaan</TableHead>
                    <TableHead>Verifikasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(purchase.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {purchase.bid}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyBid(purchase.bid)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-blue-600"
                          onClick={() => setNoteDialogPurchaseId(purchase.id)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Lihat
                        </Button>
                      </TableCell>
                      <TableCell>{purchase.payment_method}</TableCell>
                      <TableCell>
                        {purchase.payment_proof_url ? (
                          <a href={purchase.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                            Lihat
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={purchase.receipt_status}
                          onValueChange={(val) => updateField(purchase.id, "receipt_status", val)}
                        >
                          <SelectTrigger className="w-[150px] h-8">
                            <Badge
                              variant="outline"
                              className={
                                purchase.receipt_status === "Diterima"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {purchase.receipt_status === "Diterima" ? "✓" : "⏳"} {purchase.receipt_status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Belum Diterima">Belum Diterima</SelectItem>
                            <SelectItem value="Diterima">Diterima</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={purchase.verification_status}
                          onValueChange={(val) => updateField(purchase.id, "verification_status", val)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <Badge
                              variant="outline"
                              className={
                                purchase.verification_status === "Verified"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                              }
                            >
                              {purchase.verification_status === "Verified" ? "✓" : "⚠"} {purchase.verification_status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unverified">Unverified</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={purchase.status}
                          onValueChange={(val) => updateField(purchase.id, "status", val)}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tunda">tunda</SelectItem>
                            <SelectItem value="disetujui">disetujui</SelectItem>
                            <SelectItem value="ditolak">ditolak</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                        {formatCurrency(Number(purchase.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddPurchaseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchPurchases();
        }}
      />

      <PurchaseNoteDialog
        purchaseId={noteDialogPurchaseId}
        onClose={() => setNoteDialogPurchaseId(null)}
      />
    </div>
  );
}
