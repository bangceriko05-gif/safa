import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface BankAccountDetailModalProps {
  open: boolean;
  onClose: () => void;
  accountName: string;
  storeId: string;
  selectedDate: Date;
}

interface TransactionRow {
  date: string;
  bid: string;
  description: string;
  debit: number;
  credit: number;
}

const PAGE_SIZE = 50;

export default function BankAccountDetailModal({ open, onClose, accountName, storeId, selectedDate }: BankAccountDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    if (!open || !storeId || !accountName) return;
    setSearch("");
    setCurrentPage(1);
    fetchTransactions();
  }, [open, storeId, accountName, selectedDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    const endStr = format(endOfMonth(selectedDate), "yyyy-MM-dd");

    try {
      const [bookingsRes, incomesRes, expensesRes, transfersRes] = await Promise.all([
        supabase.from("bookings").select("date, bid, customer_name, payment_method, price, dual_payment, payment_method_2, price_2")
          .eq("store_id", storeId).lte("date", endStr).in("status", ["CI", "CO"]),
        supabase.from("incomes").select("date, bid, description, customer_name, payment_method, amount")
          .eq("store_id", storeId).lte("date", endStr),
        supabase.from("expenses").select("date, bid, description, payment_method, amount")
          .eq("store_id", storeId).lte("date", endStr),
        supabase.from("investor_transfers" as any).select("transfer_date, investor_name, source_account, amount, description")
          .eq("store_id", storeId).lte("transfer_date", endStr),
      ]);

      const rows: TransactionRow[] = [];

      (bookingsRes.data || []).forEach((b: any) => {
        const pm = (b.payment_method || "").trim();
        if (pm === accountName) {
          rows.push({ date: b.date, bid: b.bid || "-", description: `Pembayaran dari ${b.customer_name}`, debit: Number(b.price) || 0, credit: 0 });
        }
        if (b.dual_payment && (b.payment_method_2 || "").trim() === accountName) {
          rows.push({ date: b.date, bid: b.bid || "-", description: `Pembayaran dari ${b.customer_name} (Split)`, debit: Number(b.price_2) || 0, credit: 0 });
        }
      });

      (incomesRes.data || []).forEach((i: any) => {
        if ((i.payment_method || "").trim() === accountName) {
          rows.push({ date: i.date, bid: i.bid || "-", description: i.description || `Pemasukan dari ${i.customer_name || "-"}`, debit: Number(i.amount) || 0, credit: 0 });
        }
      });

      (expensesRes.data || []).forEach((e: any) => {
        if ((e.payment_method || "").trim() === accountName) {
          rows.push({ date: e.date, bid: e.bid || "-", description: e.description || "Pengeluaran", debit: 0, credit: Number(e.amount) || 0 });
        }
      });

      (transfersRes.data || []).forEach((t: any) => {
        if ((t.source_account || "").trim() === accountName) {
          rows.push({ date: t.transfer_date, bid: "-", description: `Transfer ke investor: ${t.investor_name}${t.description ? ` - ${t.description}` : ""}`, debit: 0, credit: Number(t.amount) || 0 });
        }
      });

      rows.sort((a, b) => a.date.localeCompare(b.date) || a.bid.localeCompare(b.bid));
      setTransactions(rows);
      setOpeningBalance(0); // COA opening balance could be added later
    } catch (error) {
      console.error("Error fetching account transactions:", error);
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
  const endingBalance = openingBalance + totalDebit - totalCredit;

  // Running balance with cumulative from previous pages
  const rowsWithBalance = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    let bal = openingBalance;
    for (let i = 0; i < startIdx && i < filtered.length; i++) {
      bal += filtered[i].debit - filtered[i].credit;
    }
    return paginated.map(r => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
  }, [filtered, paginated, currentPage, openingBalance]);

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
    // Simple CSV export
    const header = "Tanggal,No. Transaksi,Deskripsi,Debit,Kredit,Jumlah\n";
    let bal = openingBalance;
    const csvRows = filtered.map(r => {
      bal += r.debit - r.credit;
      return `${r.date},"${r.bid}","${r.description}",${r.debit},${r.credit},${bal}`;
    }).join("\n");
    const blob = new Blob([header + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${accountName}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold tracking-tight">{accountName}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden px-6 pb-5 gap-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Saldo Awal</p>
                <p className="text-base font-bold">{fmtCurrency(openingBalance)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Total Debit</p>
                <p className="text-base font-bold text-emerald-600">{fmtCurrency(totalDebit)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Total Kredit</p>
                <p className="text-base font-bold text-red-500">{fmtCurrency(totalCredit)}</p>
              </div>
              <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Saldo Akhir</p>
                <p className="text-base font-bold text-primary">{fmtCurrency(endingBalance)}</p>
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
                    <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[110px]">Debit</TableHead>
                    <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[110px]">Kredit</TableHead>
                    <TableHead className="text-primary-foreground font-semibold text-xs text-right w-[120px]">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsWithBalance.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Tidak ada transaksi untuk akun ini.</TableCell></TableRow>
                  ) : rowsWithBalance.map((r, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/40">
                      <TableCell className="text-xs py-3">{format(new Date(r.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                      <TableCell className="text-xs py-3 font-medium text-primary">{r.bid}</TableCell>
                      <TableCell className="text-xs py-3">{r.description}</TableCell>
                      <TableCell className="text-xs py-3 text-right tabular-nums">{fmt(r.debit)}</TableCell>
                      <TableCell className="text-xs py-3 text-right tabular-nums">{fmt(r.credit)}</TableCell>
                      <TableCell className="text-xs py-3 text-right tabular-nums font-semibold">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Menampilkan {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} data</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {pageNumbers.map((p, i) =>
                  typeof p === "string" ? (
                    <span key={i} className="px-1">...</span>
                  ) : (
                    <Button key={i} variant={p === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(p)}>{p}</Button>
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
      </DialogContent>
    </Dialog>
  );
}
