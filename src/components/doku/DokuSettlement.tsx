import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, ExternalLink, FileSearch, Landmark, Loader2, MoreVertical, Receipt, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dokuTransactionMethod, formatDokuPaidAt, type DokuTransaction } from "@/utils/dokuTransactions";
import { buildDokuSettlementBatches, successfulDokuTransactions, type DokuSettlementBatch } from "@/utils/dokuSettlements";

const idr = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
const officialSettlementUrl = "https://dashboard.doku.com/bo/login";
const csvCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;

function downloadCsv(filename: string, header: string[], lines: unknown[][]) {
  const csv = [header, ...lines].map(line => line.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function transactionLines(rows: DokuTransaction[]) {
  return rows.map(row => [row.outlet, row.bid, row.invoice_number, formatDokuPaidAt(row.paid_at), dokuTransactionMethod(row), Number(row.amount), row.status.toUpperCase()]);
}

interface Props {
  rows: DokuTransaction[];
  loading: boolean;
  syncing: boolean;
  from: string;
  to: string;
  invalidDate: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onRefresh: () => void;
}

export default function DokuSettlement({ rows, loading, syncing, from, to, invalidDate, onFromChange, onToChange, onRefresh }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DokuSettlementBatch | null>(null);
  const successfulRows = useMemo(() => successfulDokuTransactions(rows, query), [rows, query]);
  const batches = useMemo(() => buildDokuSettlementBatches(successfulRows), [successfulRows]);
  const totalAmount = successfulRows.reduce((total, row) => total + Number(row.amount), 0);

  const exportBatches = () => downloadCsv(
    `ringkasan-settlement-doku-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
    ["Tanggal Uang Masuk (WIB)", "Jumlah Transaksi", "Total Pembayaran Berhasil"],
    batches.map(batch => [batch.dateKey, batch.transactions.length, batch.totalAmount]),
  );

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Settlement Report</h2><p className="mt-1 text-sm text-muted-foreground">Ringkasan pembayaran DOKU berhasil berdasarkan tanggal uang masuk WIB.</p></div>
      <Button variant="outline" asChild><a href={officialSettlementUrl} target="_blank" rel="noopener noreferrer">Buka Settlement DOKU<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
    </div>

    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <p className="text-muted-foreground"><span className="font-medium text-foreground">Cocokkan pencairan bank di DOKU.</span> Daftar ini merangkum pembayaran berhasil di ANKA, bukan konfirmasi bahwa dana sudah masuk rekening. Nomor batch resmi, biaya, jadwal pencairan, rekening tujuan, dan Kirim Ulang Laporan tersedia di dashboard DOKU pada <span className="font-medium text-foreground">Reports → Settlements</span>.</p>
    </div>

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">TOTAL PEMBAYARAN BERHASIL</p><p className="mt-2 text-xl font-semibold">{idr(totalAmount)}</p></div>
      <div className="rounded-lg border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">TRANSAKSI BERHASIL</p><p className="mt-2 text-xl font-semibold">{successfulRows.length}</p></div>
      <div className="rounded-lg border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">TANGGAL UANG MASUK</p><p className="mt-2 text-xl font-semibold">{batches.length} hari</p></div>
    </section>

    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative w-full sm:w-80"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari Settlement DOKU" placeholder="Cari BID, invoice, atau outlet…" value={query} onChange={event => setQuery(event.target.value)} className="pr-10" /></div>
        <div className="flex flex-wrap items-center gap-2"><Input type="date" aria-label="Tanggal mulai Settlement" value={from} onChange={event => onFromChange(event.target.value)} className="w-40" /><span className="text-muted-foreground">–</span><Input type="date" aria-label="Tanggal akhir Settlement" value={to} onChange={event => onToChange(event.target.value)} className="w-40" /></div>
        <Button variant="outline" disabled={loading || syncing} onClick={onRefresh} className="sm:ml-auto"><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Mencocokkan…" : "Sinkronkan"}</Button>
        <Button variant="outline" disabled={!batches.length || syncing} onClick={exportBatches}><Download className="mr-2 h-4 w-4" />Export</Button>
      </div>
      {invalidDate && <p role="alert" className="px-4 pt-3 text-sm text-destructive">Tanggal akhir harus sama atau setelah tanggal mulai.</p>}
      <div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader className="bg-muted/40"><TableRow><TableHead>Tanggal Uang Masuk (WIB)</TableHead><TableHead>Jumlah Transaksi</TableHead><TableHead>Total Pembayaran Berhasil</TableHead><TableHead>Status Pembayaran</TableHead><TableHead className="w-16"><span className="sr-only">Tindakan</span></TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow> : batches.length === 0 ? <TableRow><TableCell colSpan={5} className="h-64 text-center"><Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Belum ada pembayaran berhasil</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Pembayaran DOKU yang sudah berhasil dan memiliki waktu uang masuk akan dikelompokkan di sini.</p></TableCell></TableRow> : batches.map(batch => <TableRow key={batch.dateKey}>
          <TableCell className="whitespace-nowrap font-medium">{batch.dateKey}</TableCell><TableCell>{batch.transactions.length} transaksi</TableCell><TableCell className="whitespace-nowrap font-semibold">{idr(batch.totalAmount)}</TableCell><TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-success">SUCCESS</span></TableCell>
          <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Tindakan Settlement ${batch.dateKey}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelected(batch)}><FileSearch className="mr-2 h-4 w-4" />Detail</DropdownMenuItem><DropdownMenuItem asChild><a href={officialSettlementUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Buka Laporan DOKU</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
        </TableRow>)}
      </TableBody></Table></div>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">{batches.length} tanggal · {successfulRows.length} transaksi berhasil</div>
    </section>

    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
        <DialogHeader><DialogTitle>Detail Settlement — {selected?.dateKey}</DialogTitle><DialogDescription>{selected?.transactions.length} pembayaran berhasil · {idr(selected?.totalAmount || 0)}. Ini adalah rincian pembayaran ANKA; cocokkan batch pencairan resminya di DOKU.</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-auto rounded-lg border"><Table className="min-w-[900px]"><TableHeader className="bg-muted/40"><TableRow><TableHead>BID</TableHead><TableHead>Invoice Number</TableHead><TableHead>Uang Masuk (GMT+7)</TableHead><TableHead>Metode</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{selected?.transactions.map(row => <TableRow key={`${row.source}-${row.id}`}><TableCell className="whitespace-nowrap font-mono text-xs">{row.bid}</TableCell><TableCell className="font-mono text-xs">{row.invoice_number}</TableCell><TableCell className="whitespace-nowrap">{formatDokuPaidAt(row.paid_at)}</TableCell><TableCell>{dokuTransactionMethod(row)}</TableCell><TableCell className="whitespace-nowrap font-semibold">{idr(Number(row.amount))}</TableCell><TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-success">SUCCESS</span></TableCell></TableRow>)}</TableBody></Table></div>
        {selected && <Button variant="outline" className="self-end" onClick={() => downloadCsv(`detail-settlement-${selected.dateKey}.csv`, ["Outlet", "BID", "Invoice Number", "Uang Masuk (GMT+7)", "Metode", "Amount", "Status"], transactionLines(selected.transactions))}><Download className="mr-2 h-4 w-4" />Export Detail</Button>}
      </DialogContent>
    </Dialog>
  </div>;
}
