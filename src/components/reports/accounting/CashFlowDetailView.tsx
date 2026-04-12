import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, X, Download, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type CashFlowDetailType =
  | "saldo_awal"
  | "penerimaan_pelanggan"
  | "pembayaran_pemasok"
  | "biaya_operasional"
  | "biaya_perawatan"
  | "pendapatan_lain"
  | "pengeluaran_lain"
  | "pembelian_aset_tetap"
  | "pembelian_aset_tak_berwujud"
  | "aktivitas_investasi_lain"
  | "pembayaran_pinjaman"
  | "penambahan_modal";

const DETAIL_LABELS: Record<CashFlowDetailType, string> = {
  saldo_awal: "Detail Saldo Kas Awal",
  penerimaan_pelanggan: "Penerimaan dari pelanggan",
  pembayaran_pemasok: "Pembayaran ke pemasok",
  biaya_operasional: "Biaya operasional",
  biaya_perawatan: "Biaya perawatan",
  pendapatan_lain: "Pendapatan lain",
  pengeluaran_lain: "Pengeluaran lain",
  pembelian_aset_tetap: "Pendapatan/pengeluaran aset tetap",
  pembelian_aset_tak_berwujud: "Pendapatan/pengeluaran aset tidak berwujud",
  aktivitas_investasi_lain: "Aktivitas investasi lain",
  pembayaran_pinjaman: "Pembayaran/penerimaan pinjaman",
  penambahan_modal: "Penambahan/pengambilan modal",
};

interface CashFlowDetailViewProps {
  detailType: CashFlowDetailType;
  storeId: string;
  startDate: Date;
  endDate: Date;
  onClose: () => void;
}

interface TransactionRow {
  date: string;
  bid: string;
  description: string;
  debit: number;
  credit: number;
}

const PAGE_SIZE = 50;

export default function CashFlowDetailView({ detailType, storeId, startDate, endDate, onClose }: CashFlowDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearch("");
    setCurrentPage(1);
    fetchData();
  }, [detailType, storeId, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const rows: TransactionRow[] = [];

    try {
      switch (detailType) {
        case "saldo_awal": {
          // Fetch COA opening balances
          const { data: coaData } = await supabase
            .from("chart_of_accounts")
            .select("account_name, account_code, opening_balance, opening_balance_date")
            .eq("store_id", storeId)
            .eq("classification", "Kas & Bank")
            .eq("is_active", true);
          (coaData || []).forEach((a: any) => {
            const amount = Number(a.opening_balance) || 0;
            if (amount !== 0) {
              rows.push({
                date: a.opening_balance_date || "-",
                bid: a.account_code || "-",
                description: `Saldo awal akun: ${a.account_name}`,
                debit: amount > 0 ? amount : 0,
                credit: amount < 0 ? Math.abs(amount) : 0,
              });
            }
          });

          const beforeStartStr = format(new Date(startDate.getTime() - 86400000), "yyyy-MM-dd");

          // Prior bookings
          const { data: bookings } = await supabase
            .from("bookings")
            .select("date, bid, customer_name, price, price_2, payment_method")
            .eq("store_id", storeId)
            .lte("date", beforeStartStr)
            .in("status", ["CI", "CO"]);
          (bookings || []).forEach((b: any) => {
            const total = (Number(b.price) || 0) + (Number(b.price_2) || 0);
            if (total > 0) {
              rows.push({
                date: b.date,
                bid: b.bid || "-",
                description: `Penjualan: ${b.customer_name}${b.payment_method ? ` (${b.payment_method})` : ""}`,
                debit: total,
                credit: 0,
              });
            }
          });

          // Prior incomes
          const { data: incomes } = await supabase
            .from("incomes")
            .select("date, bid, description, customer_name, amount, category")
            .eq("store_id", storeId)
            .lte("date", beforeStartStr);
          (incomes || []).forEach((i: any) => {
            const amount = Number(i.amount) || 0;
            if (amount > 0) {
              rows.push({
                date: i.date,
                bid: i.bid || "-",
                description: `Pemasukan: ${i.description || i.customer_name || "Lainnya"}${i.category ? ` [${i.category}]` : ""}`,
                debit: amount,
                credit: 0,
              });
            }
          });

          // Prior expenses
          const { data: expenses } = await supabase
            .from("expenses")
            .select("date, bid, description, category, amount")
            .eq("store_id", storeId)
            .lte("date", beforeStartStr);
          (expenses || []).forEach((e: any) => {
            const amount = Number(e.amount) || 0;
            if (amount > 0) {
              rows.push({
                date: e.date,
                bid: e.bid || "-",
                description: `Pengeluaran: ${e.description}${e.category ? ` [${e.category}]` : ""}`,
                debit: 0,
                credit: amount,
              });
            }
          });

          // Prior payable payments
          const { data: payables } = await supabase
            .from("accounts_payable")
            .select("created_at, supplier_name, description, paid_amount")
            .eq("store_id", storeId)
            .lte("created_at", format(new Date(startDate.getTime() - 86400000), "yyyy-MM-dd'T'23:59:59"));
          (payables || []).forEach((p: any) => {
            const amount = Number(p.paid_amount) || 0;
            if (amount > 0) {
              rows.push({
                date: p.created_at.split("T")[0],
                bid: "-",
                description: `Pembayaran hutang: ${p.supplier_name}${p.description ? ` - ${p.description}` : ""}`,
                debit: 0,
                credit: amount,
              });
            }
          });
          break;
        }
        case "penerimaan_pelanggan": {
          const { data } = await supabase
            .from("bookings")
            .select("date, bid, customer_name, price, price_2, payment_method, payment_method_2, dual_payment")
            .eq("store_id", storeId)
            .gte("date", startStr)
            .lte("date", endStr)
            .in("status", ["CI", "CO"]);
          (data || []).forEach((b: any) => {
            const total = (Number(b.price) || 0) + (Number(b.price_2) || 0);
            rows.push({
              date: b.date,
              bid: b.bid || "-",
              description: `Pembayaran dari ${b.customer_name} (${b.payment_method || "-"}${b.dual_payment ? ` + ${b.payment_method_2}` : ""})`,
              debit: total,
              credit: 0,
            });
          });
          break;
        }
        case "pembayaran_pemasok": {
          const { data } = await supabase
            .from("accounts_payable")
            .select("created_at, supplier_name, description, paid_amount")
            .eq("store_id", storeId)
            .gte("created_at", `${startStr}T00:00:00`)
            .lte("created_at", `${endStr}T23:59:59`);
          (data || []).forEach((p: any) => {
            if ((Number(p.paid_amount) || 0) > 0) {
              rows.push({
                date: p.created_at.split("T")[0],
                bid: "-",
                description: `Pembayaran ke ${p.supplier_name}${p.description ? ` - ${p.description}` : ""}`,
                debit: 0,
                credit: Number(p.paid_amount) || 0,
              });
            }
          });
          break;
        }
        case "biaya_operasional": {
          const { data } = await supabase
            .from("expenses")
            .select("date, bid, description, category, amount, payment_method")
            .eq("store_id", storeId)
            .gte("date", startStr)
            .lte("date", endStr);
          (data || []).forEach((e: any) => {
            const cat = (e.category || "").toLowerCase();
            if (!cat.includes("lain") && !cat.includes("perawatan")) {
              rows.push({
                date: e.date,
                bid: e.bid || "-",
                description: `${e.description}${e.category ? ` [${e.category}]` : ""}${e.payment_method ? ` (${e.payment_method})` : ""}`,
                debit: 0,
                credit: Number(e.amount) || 0,
              });
            }
          });
          break;
        }
        case "biaya_perawatan": {
          const { data } = await supabase
            .from("expenses")
            .select("date, bid, description, category, amount, payment_method")
            .eq("store_id", storeId)
            .gte("date", startStr)
            .lte("date", endStr);
          (data || []).forEach((e: any) => {
            const cat = (e.category || "").toLowerCase();
            if (cat.includes("perawatan")) {
              rows.push({
                date: e.date,
                bid: e.bid || "-",
                description: `${e.description}${e.category ? ` [${e.category}]` : ""}${e.payment_method ? ` (${e.payment_method})` : ""}`,
                debit: 0,
                credit: Number(e.amount) || 0,
              });
            }
          });
          break;
        }
        case "pendapatan_lain": {
          const { data } = await supabase
            .from("incomes")
            .select("date, bid, description, customer_name, amount, payment_method, category")
            .eq("store_id", storeId)
            .gte("date", startStr)
            .lte("date", endStr);
          (data || []).forEach((i: any) => {
            rows.push({
              date: i.date,
              bid: i.bid || "-",
              description: `${i.description || "Pemasukan"}${i.customer_name ? ` dari ${i.customer_name}` : ""}${i.category ? ` [${i.category}]` : ""}${i.payment_method ? ` (${i.payment_method})` : ""}`,
              debit: Number(i.amount) || 0,
              credit: 0,
            });
          });
          break;
        }
        case "pengeluaran_lain": {
          const { data } = await supabase
            .from("expenses")
            .select("date, bid, description, category, amount, payment_method")
            .eq("store_id", storeId)
            .gte("date", startStr)
            .lte("date", endStr);
          (data || []).forEach((e: any) => {
            const cat = (e.category || "").toLowerCase();
            if (cat.includes("lain")) {
              rows.push({
                date: e.date,
                bid: e.bid || "-",
                description: `${e.description}${e.category ? ` [${e.category}]` : ""}${e.payment_method ? ` (${e.payment_method})` : ""}`,
                debit: 0,
                credit: Number(e.amount) || 0,
              });
            }
          });
          break;
        }
        case "pembelian_aset_tetap": {
          const { data } = await supabase
            .from("assets")
            .select("created_at, name, category, purchase_price, purchase_date")
            .eq("store_id", storeId)
            .gte("created_at", `${startStr}T00:00:00`)
            .lte("created_at", `${endStr}T23:59:59`);
          (data || []).forEach((a: any) => {
            rows.push({
              date: a.purchase_date || a.created_at.split("T")[0],
              bid: "-",
              description: `Pembelian aset: ${a.name}${a.category ? ` [${a.category}]` : ""}`,
              debit: 0,
              credit: Number(a.purchase_price) || 0,
            });
          });
          break;
        }
        case "penambahan_modal": {
          const { data } = await supabase
            .from("investor_transfers")
            .select("transfer_date, investor_name, source_account, amount, description")
            .eq("store_id", storeId)
            .gte("transfer_date", startStr)
            .lte("transfer_date", endStr);
          (data || []).forEach((t: any) => {
            rows.push({
              date: t.transfer_date,
              bid: "-",
              description: `Transfer dari ${t.investor_name} (${t.source_account})${t.description ? ` - ${t.description}` : ""}`,
              debit: Number(t.amount) || 0,
              credit: 0,
            });
          });
          break;
        }
        default:
          break;
      }

      rows.sort((a, b) => a.date.localeCompare(b.date));
      setTransactions(rows);
    } catch (error) {
      console.error("Error fetching cash flow detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(r =>
      r.bid.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      r.debit.toString().includes(q) || r.credit.toString().includes(q)
    );
  }, [transactions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0);
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);

  const rowsWithBalance = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    let bal = 0;
    for (let i = 0; i < startIdx && i < filtered.length; i++) {
      bal += filtered[i].debit - filtered[i].credit;
    }
    return paginated.map(r => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
  }, [filtered, paginated, currentPage]);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2 }).format(n);
  const fmtCurrency = (n: number) => `Rp ${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n)}`;

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const [goPage, setGoPage] = useState("");

  const handleExportExcel = () => {
    const header = "Tanggal,No. Transaksi,Deskripsi,Debit,Kredit\n";
    const csvRows = filtered.map(r =>
      `${r.date},"${r.bid}","${r.description}",${r.debit},${r.credit}`
    ).join("\n");
    const blob = new Blob([header + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${DETAIL_LABELS[detailType]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = `${format(startDate, "dd MMM yyyy", { locale: localeId })} - ${format(endDate, "dd MMM yyyy", { locale: localeId })}`;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{DETAIL_LABELS[detailType]}</h2>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden px-6 pb-5 pt-4 gap-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Total Transaksi</p>
              <p className="text-base font-bold">{filtered.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Total Debit</p>
              <p className="text-base font-bold text-emerald-600">{fmtCurrency(totalDebit)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Total Kredit</p>
              <p className="text-base font-bold text-red-500">{fmtCurrency(totalCredit)}</p>
            </div>
          </div>

          {/* Search & Export */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Input placeholder="Cari BID, deskripsi, jumlah..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                  <TableHead className="text-primary-foreground font-semibold text-xs w-[100px]">Tanggal</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-xs w-[160px]">No. Transaksi</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-xs">Deskripsi</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[130px]">Debit</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[130px]">Kredit</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[130px]">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithBalance.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Tidak ada transaksi untuk kategori ini.</TableCell></TableRow>
                ) : rowsWithBalance.map((r, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/40">
                    <TableCell className="text-xs py-3">{r.date && r.date !== "-" ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy", { locale: localeId }) : "-"}</TableCell>
                    <TableCell className="text-xs py-3 font-medium text-primary">{r.bid}</TableCell>
                    <TableCell className="text-xs py-3">{r.description}</TableCell>
                    <TableCell className="text-xs py-3 text-right tabular-nums">{r.debit > 0 ? fmt(r.debit) : "-"}</TableCell>
                    <TableCell className="text-xs py-3 text-right tabular-nums">{r.credit > 0 ? fmt(r.credit) : "-"}</TableCell>
                    <TableCell className="text-xs py-3 text-right tabular-nums font-semibold">{fmt(r.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Menampilkan {filtered.length > 0 ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} data</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {pageNumbers.map((p, i) =>
                typeof p === "string" ? (
                  <span key={i} className="px-1">...</span>
                ) : (
                  <Button key={i} variant={p === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(p as number)}>{p}</Button>
                )
              )}
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <span className="ml-2">Hal</span>
              <Input className="h-7 w-12 text-xs text-center" value={goPage} onChange={e => setGoPage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(goPage); if (n >= 1 && n <= totalPages) setCurrentPage(n); setGoPage(""); }}} />
              <span>/ {totalPages}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
