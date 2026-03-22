import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAccountingActivity } from "@/utils/accountingActivityLogger";
import { useStore } from "@/contexts/StoreContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, ArrowRightLeft, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

type ProcessStatus = "proses" | "selesai" | "batal";
type ConvertTarget = "hutang" | "piutang" | "aset" | "biaya" | "jurnal";

const CONVERT_LABELS: Record<ConvertTarget, string> = {
  hutang: "Hutang (Accounts Payable)",
  piutang: "Piutang (Accounts Receivable)",
  aset: "Aset",
  biaya: "Biaya (Expense)",
  jurnal: "Jurnal Umum",
};

const STATUS_CONFIG: Record<ProcessStatus, { label: string; icon: React.ElementType; color: string }> = {
  proses: { label: "Proses", icon: Clock, color: "text-amber-600" },
  selesai: { label: "Selesai", icon: CheckCircle2, color: "text-emerald-600" },
  batal: { label: "Batal", icon: XCircle, color: "text-destructive" },
};

interface UnifiedTransaction {
  id: string;
  type: "booking" | "income" | "expense";
  typeLabel: string;
  date: string;
  bid: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: ProcessStatus;
  convertedTo?: string;
  cancelReason?: string;
}

const STORAGE_KEY = "accounting_transactions_draft";

const fmtCurrency = (n: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n)}`;

export default function AccountingTransactions() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProcessStatus>("proses");
  const [convertDialog, setConvertDialog] = useState<UnifiedTransaction | null>(null);
  const [convertTarget, setConvertTarget] = useState<ConvertTarget>("hutang");
  const [convertNotes, setConvertNotes] = useState("");
  const [converting, setConverting] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<UnifiedTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Load drafts from localStorage on mount
  useEffect(() => {
    if (!currentStore) return;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${currentStore.id}`);
      if (saved) setTransactions(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [currentStore]);

  // Persist to localStorage on change
  useEffect(() => {
    if (!currentStore || transactions.length === 0) return;
    localStorage.setItem(`${STORAGE_KEY}_${currentStore.id}`, JSON.stringify(transactions));
  }, [transactions, currentStore]);

  const handleSearch = useCallback(async () => {
    if (!currentStore || !searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = searchQuery.trim();
      const newRows: UnifiedTransaction[] = [];

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, date, bid, customer_name, price, price_2, payment_method, status, note")
        .eq("store_id", currentStore.id)
        .ilike("bid", `%${q}%`)
        .in("status", ["CI", "CO"])
        .limit(50);

      (bookings || []).forEach((b: any) => {
        const total = (Number(b.price) || 0) + (Number(b.price_2) || 0);
        newRows.push({
          id: b.id, type: "booking", typeLabel: "Penjualan",
          date: b.date, bid: b.bid || "-",
          description: `${b.customer_name}${b.note ? ` - ${b.note}` : ""}`,
          amount: total, paymentMethod: b.payment_method || "-", status: "proses",
        });
      });

      const { data: incomes } = await supabase
        .from("incomes")
        .select("id, date, bid, description, customer_name, amount, payment_method, category")
        .eq("store_id", currentStore.id)
        .ilike("bid", `%${q}%`)
        .limit(50);

      (incomes || []).forEach((i: any) => {
        newRows.push({
          id: i.id, type: "income", typeLabel: "Pemasukan",
          date: i.date, bid: i.bid || "-",
          description: `${i.description || "Pemasukan"}${i.customer_name ? ` - ${i.customer_name}` : ""}${i.category ? ` [${i.category}]` : ""}`,
          amount: Number(i.amount) || 0, paymentMethod: i.payment_method || "-", status: "proses",
        });
      });

      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, date, bid, description, category, amount, payment_method")
        .eq("store_id", currentStore.id)
        .ilike("bid", `%${q}%`)
        .limit(50);

      (expenses || []).forEach((e: any) => {
        newRows.push({
          id: e.id, type: "expense", typeLabel: "Pengeluaran",
          date: e.date, bid: e.bid || "-",
          description: `${e.description}${e.category ? ` [${e.category}]` : ""}`,
          amount: Number(e.amount) || 0, paymentMethod: e.payment_method || "-", status: "proses",
        });
      });

      // Merge: keep existing status for already-tracked items, add new ones
      setTransactions((prev) => {
        const existingMap = new Map(prev.map((t) => [`${t.type}-${t.id}`, t]));
        newRows.forEach((r) => {
          const key = `${r.type}-${r.id}`;
          if (!existingMap.has(key)) {
            existingMap.set(key, r);
          }
        });
        return Array.from(existingMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      });

      if (newRows.length === 0) {
        toast.info("Tidak ditemukan transaksi dengan BID tersebut");
      } else {
        toast.success(`${newRows.length} transaksi ditemukan`);
        setStatusFilter("proses");
      }
    } catch (error) {
      console.error("Error searching transactions:", error);
      toast.error("Gagal mencari transaksi");
    } finally {
      setLoading(false);
    }
  }, [currentStore, searchQuery]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => t.status === statusFilter);
  }, [transactions, statusFilter]);

  const counts = useMemo(() => ({
    proses: transactions.filter((t) => t.status === "proses").length,
    selesai: transactions.filter((t) => t.status === "selesai").length,
    batal: transactions.filter((t) => t.status === "batal").length,
  }), [transactions]);

  const handleConvert = async () => {
    if (!convertDialog || !currentStore) return;
    setConverting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      switch (convertTarget) {
        case "hutang":
          await supabase.from("accounts_payable").insert({
            store_id: currentStore.id, supplier_name: convertDialog.description,
            amount: convertDialog.amount,
            description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id, status: "unpaid",
          });
          break;
        case "piutang":
          await supabase.from("accounts_receivable").insert({
            store_id: currentStore.id, customer_name: convertDialog.description,
            amount: convertDialog.amount,
            description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id, status: "unpaid",
          });
          break;
        case "aset":
          await supabase.from("assets").insert({
            store_id: currentStore.id, name: `${convertDialog.typeLabel} - ${convertDialog.bid}`,
            purchase_price: convertDialog.amount, current_value: convertDialog.amount,
            notes: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id, purchase_date: convertDialog.date,
          });
          break;
        case "biaya":
          await supabase.from("expenses").insert({
            store_id: currentStore.id, description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            amount: convertDialog.amount, date: convertDialog.date,
            created_by: user.id, payment_method: convertDialog.paymentMethod,
          });
          break;
        case "jurnal":
          await supabase.from("journal_entries").insert({
            store_id: currentStore.id, entry_date: convertDialog.date,
            description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            reference_no: convertDialog.bid, created_by: user.id,
          });
          break;
      }

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === convertDialog.id && t.type === convertDialog.type
            ? { ...t, status: "selesai" as ProcessStatus, convertedTo: CONVERT_LABELS[convertTarget] }
            : t
        )
      );

      logAccountingActivity({
        actionType: 'converted', entityType: CONVERT_LABELS[convertTarget],
        entityId: convertDialog.id,
        description: `Konversi ${convertDialog.typeLabel} ${convertDialog.bid} (${fmtCurrency(convertDialog.amount)}) ke ${CONVERT_LABELS[convertTarget]}${convertNotes ? ` - ${convertNotes}` : ""}`,
        storeId: currentStore.id,
      });

      toast.success(`Berhasil dikonversi ke ${CONVERT_LABELS[convertTarget]}`);
      setConvertDialog(null);
      setConvertNotes("");
    } catch (error) {
      console.error("Error converting:", error);
      toast.error("Gagal mengkonversi transaksi");
    } finally {
      setConverting(false);
    }
  };

  const handleCancel = () => {
    if (!cancelDialog) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === cancelDialog.id && t.type === cancelDialog.type
          ? { ...t, status: "batal" as ProcessStatus, cancelReason: cancelReason || undefined }
          : t
      )
    );
    if (currentStore) {
      logAccountingActivity({
        actionType: 'deleted', entityType: 'Transaksi',
        entityId: cancelDialog.id,
        description: `Membatalkan proses ${cancelDialog.typeLabel} ${cancelDialog.bid}${cancelReason ? ` - ${cancelReason}` : ""}`,
        storeId: currentStore.id,
      });
    }
    toast.success("Transaksi dibatalkan");
    setCancelDialog(null);
    setCancelReason("");
  };

  const handleRemoveDraft = (t: UnifiedTransaction) => {
    setTransactions((prev) => prev.filter((x) => !(x.id === t.id && x.type === t.type)));
    toast.success("Draf dihapus");
  };

  const handleRestoreToSelesai = (t: UnifiedTransaction) => {
    setTransactions((prev) =>
      prev.map((x) =>
        x.id === t.id && x.type === t.type
          ? { ...x, status: "selesai" as ProcessStatus, cancelReason: undefined }
          : x
      )
    );
    toast.success("Transaksi dikembalikan ke Selesai");
  };

  const handleRestoreToProses = (t: UnifiedTransaction) => {
    setTransactions((prev) =>
      prev.map((x) =>
        x.id === t.id && x.type === t.type
          ? { ...x, status: "proses" as ProcessStatus, cancelReason: undefined, convertedTo: undefined }
          : x
      )
    );
    toast.success("Transaksi dikembalikan ke Proses");
  };

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case "booking": return "default";
      case "income": return "secondary";
      case "expense": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari BID transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={loading || !searchQuery.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Cari</span>
        </Button>
      </form>

      {/* Status Tabs */}
      <div className="flex items-center gap-2">
        {(["proses", "selesai", "batal"] as ProcessStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label} ({counts[s]})
            </Button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
              <TableHead className="text-primary-foreground font-semibold text-xs w-[100px]">Tanggal</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[120px]">BID</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[90px]">Tipe</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs">Deskripsi</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[120px]">Metode Bayar</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[130px]">Jumlah</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs text-center w-[180px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  {statusFilter === "proses"
                    ? "Belum ada transaksi dalam proses konversi"
                    : statusFilter === "selesai"
                    ? "Belum ada transaksi yang selesai dikonversi"
                    : "Tidak ada transaksi yang dibatalkan"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={`${t.type}-${t.id}`} className="hover:bg-muted/40">
                  <TableCell className="text-xs py-3">
                    {format(new Date(t.date), "dd MMM yyyy", { locale: localeId })}
                  </TableCell>
                  <TableCell className="text-xs py-3 font-medium text-primary">{t.bid}</TableCell>
                  <TableCell className="text-xs py-3">
                    <Badge variant={typeBadgeVariant(t.type) as any} className="text-[10px]">{t.typeLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-xs py-3 max-w-[300px] truncate">{t.description}</TableCell>
                  <TableCell className="text-xs py-3">{t.paymentMethod}</TableCell>
                  <TableCell className="text-xs py-3 text-right tabular-nums font-medium">{fmtCurrency(t.amount)}</TableCell>
                  <TableCell className="text-xs py-3 text-center">
                    {t.status === "proses" ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => { setConvertDialog(t); setConvertTarget("hutang"); setConvertNotes(""); }}>
                          <ArrowRightLeft className="h-3 w-3" /> Konversi
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => { setCancelDialog(t); setCancelReason(""); }}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleRemoveDraft(t)} title="Hapus draf">
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : t.status === "selesai" ? (
                      <div className="flex items-center justify-center gap-1">
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                          {t.convertedTo || "Selesai"}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => { setCancelDialog(t); setCancelReason(""); }}
                          title="Batalkan">
                          <XCircle className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleRemoveDraft(t)} title="Hapus">
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/5">
                          Dibatalkan
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleRestoreToSelesai(t)} title="Selesai">
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600 hover:text-amber-700"
                          onClick={() => handleRestoreToProses(t)} title="Proses kembali">
                          <Clock className="h-3 w-3" />
                        </Button>
                        {t.cancelReason && <span className="text-[9px] text-muted-foreground max-w-[80px] truncate" title={t.cancelReason}>{t.cancelReason}</span>}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Convert Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={(o) => !o && setConvertDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konversi Transaksi</DialogTitle>
          </DialogHeader>
          {convertDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Transaksi</p>
                <p className="text-sm font-medium">{convertDialog.bid} - {convertDialog.typeLabel}</p>
                <p className="text-xs">{convertDialog.description}</p>
                <p className="text-sm font-bold">{fmtCurrency(convertDialog.amount)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Konversi ke</label>
                <Select value={convertTarget} onValueChange={(v) => setConvertTarget(v as ConvertTarget)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hutang">Hutang (Accounts Payable)</SelectItem>
                    <SelectItem value="piutang">Piutang (Accounts Receivable)</SelectItem>
                    <SelectItem value="aset">Aset</SelectItem>
                    <SelectItem value="biaya">Biaya (Expense)</SelectItem>
                    <SelectItem value="jurnal">Jurnal Umum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan (opsional)</label>
                <Textarea placeholder="Tambahkan catatan..." value={convertNotes} onChange={(e) => setConvertNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialog(null)}>Batal</Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Konversi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Batalkan Transaksi</DialogTitle>
          </DialogHeader>
          {cancelDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium">{cancelDialog.bid} - {cancelDialog.typeLabel}</p>
                <p className="text-sm font-bold">{fmtCurrency(cancelDialog.amount)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alasan pembatalan (opsional)</label>
                <Textarea placeholder="Alasan..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Kembali</Button>
            <Button variant="destructive" onClick={handleCancel}>Batalkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
