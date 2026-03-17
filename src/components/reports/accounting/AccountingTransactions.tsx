import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

type ProcessStatus = "proses" | "selesai";

type ConvertTarget = "hutang" | "piutang" | "aset" | "jurnal";

const CONVERT_LABELS: Record<ConvertTarget, string> = {
  hutang: "Hutang (Accounts Payable)",
  piutang: "Piutang (Accounts Receivable)",
  aset: "Aset",
  jurnal: "Jurnal Umum",
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
}

const fmtCurrency = (n: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n)}`;

export default function AccountingTransactions() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProcessStatus>("proses");
  const [convertDialog, setConvertDialog] = useState<UnifiedTransaction | null>(null);
  const [convertTarget, setConvertTarget] = useState<ConvertTarget>("hutang");
  const [convertNotes, setConvertNotes] = useState("");
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (currentStore) fetchTransactions();
  }, [currentStore]);

  const fetchTransactions = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const rows: UnifiedTransaction[] = [];

      // Fetch bookings (CI/CO)
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, date, bid, customer_name, price, price_2, payment_method, status, note")
        .eq("store_id", currentStore.id)
        .in("status", ["CI", "CO"])
        .order("date", { ascending: false })
        .limit(500);

      (bookings || []).forEach((b: any) => {
        const total = (Number(b.price) || 0) + (Number(b.price_2) || 0);
        rows.push({
          id: b.id,
          type: "booking",
          typeLabel: "Booking",
          date: b.date,
          bid: b.bid || "-",
          description: `${b.customer_name}${b.note ? ` - ${b.note}` : ""}`,
          amount: total,
          paymentMethod: b.payment_method || "-",
          status: "proses",
        });
      });

      // Fetch incomes
      const { data: incomes } = await supabase
        .from("incomes")
        .select("id, date, bid, description, customer_name, amount, payment_method, category")
        .eq("store_id", currentStore.id)
        .order("date", { ascending: false })
        .limit(500);

      (incomes || []).forEach((i: any) => {
        rows.push({
          id: i.id,
          type: "income",
          typeLabel: "Pemasukan",
          date: i.date,
          bid: i.bid || "-",
          description: `${i.description || "Pemasukan"}${i.customer_name ? ` - ${i.customer_name}` : ""}${i.category ? ` [${i.category}]` : ""}`,
          amount: Number(i.amount) || 0,
          paymentMethod: i.payment_method || "-",
          status: "proses",
        });
      });

      // Fetch expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, date, bid, description, category, amount, payment_method")
        .eq("store_id", currentStore.id)
        .order("date", { ascending: false })
        .limit(500);

      (expenses || []).forEach((e: any) => {
        rows.push({
          id: e.id,
          type: "expense",
          typeLabel: "Pengeluaran",
          date: e.date,
          bid: e.bid || "-",
          description: `${e.description}${e.category ? ` [${e.category}]` : ""}`,
          amount: Number(e.amount) || 0,
          paymentMethod: e.payment_method || "-",
          status: "proses",
        });
      });

      // Sort by date descending
      rows.sort((a, b) => b.date.localeCompare(a.date));
      setTransactions(rows);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Gagal memuat data transaksi");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = transactions.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.bid.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.typeLabel.toLowerCase().includes(q) ||
          t.amount.toString().includes(q) ||
          t.paymentMethod.toLowerCase().includes(q)
      );
    }
    return result;
  }, [transactions, search, statusFilter]);

  const handleConvert = async () => {
    if (!convertDialog || !currentStore) return;
    setConverting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      switch (convertTarget) {
        case "hutang":
          await supabase.from("accounts_payable").insert({
            store_id: currentStore.id,
            supplier_name: convertDialog.description,
            amount: convertDialog.amount,
            description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id,
            status: "unpaid",
          });
          break;
        case "piutang":
          await supabase.from("accounts_receivable").insert({
            store_id: currentStore.id,
            customer_name: convertDialog.description,
            amount: convertDialog.amount,
            description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id,
            status: "unpaid",
          });
          break;
        case "aset":
          await supabase.from("assets").insert({
            store_id: currentStore.id,
            name: `${convertDialog.typeLabel} - ${convertDialog.bid}`,
            purchase_price: convertDialog.amount,
            current_value: convertDialog.amount,
            notes: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
            created_by: user.id,
            purchase_date: convertDialog.date,
          });
          break;
        case "jurnal":
          // Create journal entry
          const { data: journalEntry } = await supabase
            .from("journal_entries")
            .insert({
              store_id: currentStore.id,
              entry_date: convertDialog.date,
              description: `Konversi dari ${convertDialog.typeLabel} ${convertDialog.bid}${convertNotes ? ` - ${convertNotes}` : ""}`,
              reference_no: convertDialog.bid,
              created_by: user.id,
            })
            .select("id")
            .single();
          break;
      }

      // Mark as selesai
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === convertDialog.id
            ? { ...t, status: "selesai" as ProcessStatus, convertedTo: CONVERT_LABELS[convertTarget] }
            : t
        )
      );

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

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case "booking": return "default";
      case "income": return "secondary";
      case "expense": return "destructive";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "proses" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("proses")}
        >
          Proses ({transactions.filter((t) => t.status === "proses").length})
        </Button>
        <Button
          variant={statusFilter === "selesai" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("selesai")}
        >
          Selesai ({transactions.filter((t) => t.status === "selesai").length})
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari BID, deskripsi, tipe, jumlah, metode bayar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
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
              <TableHead className="text-primary-foreground font-semibold text-xs text-center w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Tidak ada transaksi {statusFilter === "proses" ? "yang perlu diproses" : "yang sudah selesai"}.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 100).map((t) => (
                <TableRow key={`${t.type}-${t.id}`} className="hover:bg-muted/40">
                  <TableCell className="text-xs py-3">
                    {format(new Date(t.date), "dd MMM yyyy", { locale: localeId })}
                  </TableCell>
                  <TableCell className="text-xs py-3 font-medium text-primary">{t.bid}</TableCell>
                  <TableCell className="text-xs py-3">
                    <Badge variant={typeBadgeVariant(t.type) as any} className="text-[10px]">
                      {t.typeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs py-3 max-w-[300px] truncate">{t.description}</TableCell>
                  <TableCell className="text-xs py-3">{t.paymentMethod}</TableCell>
                  <TableCell className="text-xs py-3 text-right tabular-nums font-medium">
                    {fmtCurrency(t.amount)}
                  </TableCell>
                  <TableCell className="text-xs py-3 text-center">
                    {t.status === "proses" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setConvertDialog(t);
                          setConvertTarget("hutang");
                          setConvertNotes("");
                        }}
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Konversi
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                        {t.convertedTo || "Selesai"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">
          Menampilkan 100 dari {filtered.length} transaksi. Gunakan pencarian untuk mempersempit hasil.
        </p>
      )}

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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hutang">Hutang (Accounts Payable)</SelectItem>
                    <SelectItem value="piutang">Piutang (Accounts Receivable)</SelectItem>
                    <SelectItem value="aset">Aset</SelectItem>
                    <SelectItem value="jurnal">Jurnal Umum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan (opsional)</label>
                <Textarea
                  placeholder="Tambahkan catatan..."
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  rows={3}
                />
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
    </div>
  );
}
