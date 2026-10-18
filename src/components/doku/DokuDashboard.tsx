import { useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Download, Filter, Receipt, Search, Settings } from "lucide-react";
import { format, subDays } from "date-fns";
import DokuLogo from "./DokuLogo";
import DokuSettings from "./DokuSettings";

export default function DokuDashboard() {
  const { currentStore } = useStore();
  const [tab, setTab] = useState("transactions");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sort, setSort] = useState<{ column: string; ascending: boolean }>({ column: "Date (GMT+7)", ascending: false });
  const invalidDate = !!from && !!to && from > to;

  return <div className="space-y-6">
    <header className="flex items-center gap-3"><DokuLogo className="h-10 w-10" /><div><h1 className="text-2xl font-bold">DOKU</h1><p className="mt-1 text-sm text-muted-foreground">{currentStore?.name}</p></div></header>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-6"><TabsTrigger value="transactions" className="gap-2"><Receipt className="h-4 w-4" />Transaksi</TabsTrigger><TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Pengaturan</TabsTrigger></TabsList>
      <TabsContent value="transactions" className="space-y-5">
        <h2 className="text-xl font-semibold">Transaksi</h2>
        <section className="max-w-xl rounded-lg border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Rincian</h3><Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setMethod("all"); setQuery(""); setFrom(""); setTo(""); }}>Lihat semua</Button></div><div className="grid grid-cols-3 gap-3">{["SUCCESS", "FAILED", "PENDING"].map((name) => <div key={name} className={`doku-summary doku-summary-${name.toLowerCase()} border-l-[3px] pl-3`}><p className="text-xs font-bold">{name}</p><p className="mt-1 text-base font-semibold text-foreground">IDR —</p><p className="mt-1 text-[11px] text-muted-foreground">Belum tersinkron</p></div>)}</div></section>
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <Popover><PopoverTrigger asChild><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filter{status !== "all" || method !== "all" ? " •" : ""}</Button></PopoverTrigger><PopoverContent align="start" className="space-y-4"><div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter status DOKU"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Metode pembayaran</Label><Select value={method} onValueChange={setMethod}><SelectTrigger aria-label="Filter metode DOKU"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua metode</SelectItem><SelectItem value="qris">QRIS</SelectItem><SelectItem value="va">Virtual Account</SelectItem><SelectItem value="wallet">E-Wallet</SelectItem><SelectItem value="card">Kartu Kredit / Debit</SelectItem><SelectItem value="retail">Retail</SelectItem><SelectItem value="paylater">Paylater</SelectItem></SelectContent></Select></div><Button variant="ghost" onClick={() => { setStatus("all"); setMethod("all"); }}>Reset filter</Button></PopoverContent></Popover>
            <div className="relative w-full sm:w-64"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari invoice DOKU" placeholder="Invoice Number" value={query} onChange={(e) => setQuery(e.target.value)} className="pr-10" /></div>
            <div className="flex flex-wrap items-center gap-2"><Input type="date" aria-label="Tanggal mulai DOKU" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /><span className="text-muted-foreground">–</span><Input type="date" aria-label="Tanggal akhir DOKU" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
            <Button variant="outline" disabled className="sm:ml-auto" title="Belum ada transaksi DOKU untuk diekspor"><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
          {invalidDate && <p role="alert" className="px-4 pt-3 text-sm text-destructive">Tanggal akhir harus sama atau setelah tanggal mulai.</p>}
          <Table className="min-w-[760px]"><TableHeader className="bg-muted/40"><TableRow>{["Amount", "Date (GMT+7)", "Invoice Number", "Payment Method", "Status"].map((column) => <TableHead key={column} aria-sort={sort.column === column ? sort.ascending ? "ascending" : "descending" : "none"}><Button variant="ghost" size="sm" className="-ml-3 gap-2 text-foreground" onClick={() => setSort({ column, ascending: sort.column === column ? !sort.ascending : true })}>{column}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></Button></TableHead>)}</TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={5} className="h-64 text-center"><Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Transaksi DOKU belum tersinkron</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Belum ada koneksi DOKU untuk outlet ini. Transaksi manual tidak ditampilkan sebagai transaksi DOKU.</p><Button variant="outline" className="mt-4" onClick={() => setTab("settings")}><Settings className="mr-2 h-4 w-4" />Pengaturan DOKU</Button></TableCell></TableRow></TableBody></Table>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">0 transaksi tersinkron</div>
        </section>
      </TabsContent>
      <TabsContent value="settings"><DokuSettings /></TabsContent>
    </Tabs>
  </div>;
}