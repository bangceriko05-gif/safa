import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Download, Filter, Loader2, Receipt, Search, Settings } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import DokuLogo from "./DokuLogo";
import DokuSettings from "./DokuSettings";
import { userFacingError } from "@/utils/userFacingError";
import { dokuTransactionMethod, formatDokuTransactionTime, matchesDokuTransactionSearch, type DokuTransaction } from "@/utils/dokuTransactions";

type AttemptBase = Omit<DokuTransaction, "source" | "outlet" | "bid">;
type BidRelation = { bid: string | null } | { bid: string | null }[] | null;

const relationBid = (relation: BidRelation) => (Array.isArray(relation) ? relation[0]?.bid : relation?.bid) || "-";

const methodFilters: { value: string; label: string; prefix: string }[] = [
  { value: "qris", label: "QRIS", prefix: "QRIS" },
  { value: "va", label: "Virtual Account", prefix: "VIRTUAL_ACCOUNT" },
  { value: "wallet", label: "E-Wallet", prefix: "EMONEY" },
  { value: "card", label: "Kartu Kredit / Debit", prefix: "CREDIT_CARD" },
  { value: "retail", label: "Retail", prefix: "ONLINE_TO_OFFLINE" },
  { value: "paylater", label: "Paylater", prefix: "PEER_TO_PEER" },
];

const columns = ["Outlet", "BID", "Invoice Number", "Waktu (GMT+7)", "Metode", "Amount", "Status"];
const idr = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;

export default function DokuDashboard() {
  const { currentStore } = useStore();
  const [tab, setTab] = useState("transactions");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sort, setSort] = useState<{ column: string; ascending: boolean }>({ column: "Waktu (GMT+7)", ascending: false });
  const [rows, setRows] = useState<DokuTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const invalidDate = !!from && !!to && from > to;

  useEffect(() => {
    if (!currentStore?.id || invalidDate) return;
    let active = true;
    setLoading(true);
    void (async () => {
      const selection = "id,invoice_number,amount,status,channel,environment,created_at,paid_at";
      let posRequest = supabase.from("doku_payment_attempts")
        .select(`${selection},booking_orders(bid)`)
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false })
        .limit(500);
      let bookingRequest = supabase.from("doku_booking_attempts")
        .select(`${selection},bookings(bid)`)
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) {
        posRequest = posRequest.gte("created_at", `${from}T00:00:00+07:00`);
        bookingRequest = bookingRequest.gte("created_at", `${from}T00:00:00+07:00`);
      }
      if (to) {
        posRequest = posRequest.lte("created_at", `${to}T23:59:59+07:00`);
        bookingRequest = bookingRequest.lte("created_at", `${to}T23:59:59+07:00`);
      }
      const [posResult, bookingResult] = await Promise.all([posRequest, bookingRequest]);
      if (!active) return;
      if (posResult.error || bookingResult.error) {
        setRows([]);
        toast.error(userFacingError(posResult.error || bookingResult.error, "Transaksi DOKU belum dapat dimuat. Silakan coba lagi."));
      } else {
        const outlet = currentStore.name;
        const posRows = ((posResult.data || []) as unknown as (AttemptBase & { booking_orders: BidRelation })[]).map(row => ({
          ...row, source: "POS" as const, outlet, bid: relationBid(row.booking_orders),
        }));
        const bookingRows = ((bookingResult.data || []) as unknown as (AttemptBase & { bookings: BidRelation })[]).map(row => ({
          ...row, source: "Booking" as const, outlet, bid: relationBid(row.bookings),
        }));
        setRows([...posRows, ...bookingRows]);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentStore?.id, currentStore?.name, from, to, invalidDate]);

  const filtered = useMemo(() => {
    const prefix = methodFilters.find((filter) => filter.value === method)?.prefix;
    const list = rows.filter((row) =>
      (status === "all" || row.status === status) &&
      (!prefix || dokuTransactionMethod(row).startsWith(prefix)) &&
      matchesDokuTransactionSearch(row, query));
    const key = sort.column;
    const value = (row: DokuTransaction) =>
      key === "Amount" ? Number(row.amount) :
      key === "Invoice Number" ? row.invoice_number :
      key === "Metode" ? dokuTransactionMethod(row) :
      key === "Outlet" ? row.outlet :
      key === "BID" ? row.bid :
      key === "Status" ? row.status : row.created_at;
    return [...list].sort((a, b) => {
      const av = value(a); const bv = value(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.ascending ? cmp : -cmp;
    });
  }, [rows, status, method, query, sort]);

  const totals = useMemo(() => {
    const sum = (name: string) => filtered.filter((row) => row.status === name).reduce((total, row) => total + Number(row.amount), 0);
    return { success: sum("success"), failed: sum("failed"), pending: sum("pending") };
  }, [filtered]);

  const exportCsv = () => {
    const header = columns.join(",");
    const lines = filtered.map((row) => [
      row.outlet, row.bid, row.invoice_number, formatDokuTransactionTime(row.created_at), dokuTransactionMethod(row), Number(row.amount), row.status,
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([`﻿${header}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transaksi-doku-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <header className="flex items-center gap-3"><DokuLogo className="h-10 w-10" /><div><h1 className="text-2xl font-bold">DOKU</h1><p className="mt-1 text-sm text-muted-foreground">{currentStore?.name}</p></div></header>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-6"><TabsTrigger value="transactions" className="gap-2"><Receipt className="h-4 w-4" />Transaksi</TabsTrigger><TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Pengaturan</TabsTrigger></TabsList>
      <TabsContent value="transactions" className="space-y-5">
        <h2 className="text-xl font-semibold">Transaksi</h2>
        <section className="max-w-xl rounded-lg border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Rincian</h3><Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setMethod("all"); setQuery(""); setFrom(""); setTo(""); }}>Lihat semua</Button></div><div className="grid grid-cols-3 gap-3">{[{ name: "SUCCESS", value: totals.success, style: "doku-summary-success" }, { name: "FAILED", value: totals.failed, style: "doku-summary-failed" }, { name: "PENDING", value: totals.pending, style: "doku-summary-pending" }].map(({ name, value, style }) => <div key={name} className={`${style} border-l-[3px] pl-3`}><p className="text-xs font-bold">{name}</p><p className="mt-1 text-base font-semibold text-foreground">{idr(value)}</p></div>)}</div></section>
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <Popover><PopoverTrigger asChild><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filter{status !== "all" || method !== "all" ? " •" : ""}</Button></PopoverTrigger><PopoverContent align="start" className="space-y-4"><div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter status DOKU"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Metode pembayaran</Label><Select value={method} onValueChange={setMethod}><SelectTrigger aria-label="Filter metode DOKU"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua metode</SelectItem>{methodFilters.map((filter) => <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>)}</SelectContent></Select></div><Button variant="ghost" onClick={() => { setStatus("all"); setMethod("all"); }}>Reset filter</Button></PopoverContent></Popover>
            <div className="relative w-full sm:w-72"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari transaksi DOKU" placeholder="Cari BID, invoice, atau outlet…" value={query} onChange={(event) => setQuery(event.target.value)} className="pr-10" /></div>
            <div className="flex flex-wrap items-center gap-2"><Input type="date" aria-label="Tanggal mulai DOKU" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" /><span className="text-muted-foreground">–</span><Input type="date" aria-label="Tanggal akhir DOKU" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" /></div>
            <Button variant="outline" disabled={filtered.length === 0} onClick={exportCsv} className="sm:ml-auto"><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
          {invalidDate && <p role="alert" className="px-4 pt-3 text-sm text-destructive">Tanggal akhir harus sama atau setelah tanggal mulai.</p>}
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]"><TableHeader className="bg-muted/40"><TableRow>{columns.map((column) => <TableHead key={column} aria-sort={sort.column === column ? sort.ascending ? "ascending" : "descending" : "none"}><Button variant="ghost" size="sm" className="-ml-3 gap-2 whitespace-nowrap text-foreground" onClick={() => setSort({ column, ascending: sort.column === column ? !sort.ascending : true })}>{column}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></Button></TableHead>)}</TableRow></TableHeader><TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length} className="h-64 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length} className="h-64 text-center"><Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Belum ada transaksi DOKU</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Transaksi POS dan booking yang dibayar melalui DOKU akan muncul di sini. Transaksi manual tidak ditampilkan.</p><Button variant="outline" className="mt-4" onClick={() => setTab("settings")}><Settings className="mr-2 h-4 w-4" />Pengaturan DOKU</Button></TableCell></TableRow>
              ) : filtered.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <TableCell className="font-medium">{row.outlet}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{row.bid}</TableCell>
                  <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDokuTransactionTime(row.created_at)}</TableCell>
                  <TableCell><span className="whitespace-nowrap">{dokuTransactionMethod(row)}</span>{row.environment === "sandbox" ? <span className="ml-1 text-xs text-muted-foreground">(sandbox)</span> : null}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">{idr(Number(row.amount))}</TableCell>
                  <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "success" ? "bg-secondary text-success" : row.status === "failed" ? "bg-destructive/10 text-destructive" : row.status === "expired" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}>{row.status.toUpperCase()}</span></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">{filtered.length} transaksi</div>
        </section>
      </TabsContent>
      <TabsContent value="settings"><DokuSettings /></TabsContent>
    </Tabs>
  </div>;
}
