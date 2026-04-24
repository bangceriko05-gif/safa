import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfYear } from "date-fns";
import StockOutForm from "./StockOutForm";
import InventoryToolbar from "./InventoryToolbar";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Upload, Trash2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Badge as UIBadge } from "@/components/ui/badge";

interface StockOutRow {
  id: string;
  bid: string;
  date: string;
  supplier_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  item_count: number;
}

interface PreviewRow {
  index: number;
  product: string;
  variant: string;
  sku: string;
  supplier: string;
  qty: number;
  new_buy_price: number;
  status: "valid" | "error";
  errorMessage?: string;
  matchedProductId?: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const statusBadge = (status: string) => {
  if (status === "posted") return <Badge className="bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/10">Posted</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-destructive border-destructive/30">Batal</Badge>;
  return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/10">Draft</Badge>;
};

export default function StockOutList() {
  const { currentStore } = useStore();
  const [rows, setRows] = useState<StockOutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_out" as any)
      .select("id, bid, date, supplier_name, total_amount, status, created_at")
      .eq("store_id", currentStore.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const ids = (data as any[]).map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("stock_out_items" as any)
          .select("stock_out_id, quantity")
          .in("stock_out_id", ids);
        (items as any[] | null)?.forEach((it) => {
          counts[it.stock_out_id] = (counts[it.stock_out_id] || 0) + Number(it.quantity || 0);
        });
      }
      setRows((data as any[]).map((r) => ({ ...r, item_count: counts[r.id] || 0 })) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentStore]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (dateRange?.from) {
      const d = new Date(r.date);
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to || dateRange.from);
      to.setHours(23, 59, 59, 999);
      if (d < from || d > to) return false;
    }
    if (!q) return true;
    return (
      r.bid?.toLowerCase().includes(q) ||
      (r.supplier_name || "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(0, pageSize);

  const handleOpenNew = () => {
    setEditId(null);
    setOpenForm(true);
  };

  const handleOpenEdit = (id: string) => {
    setEditId(id);
    setOpenForm(true);
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const formatDateExp = (s: string) =>
      new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    const formatDateTime = (s: string) =>
      new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const data = filtered.map((r) => ({
      "No. Stok Keluar": r.bid,
      "Tanggal": formatDateExp(r.date),
      "Supplier": r.supplier_name || "-",
      "Total": r.total_amount,
      "Status": r.status,
      "Jumlah Item": r.item_count,
      "Dibuat": formatDateTime(r.created_at),
    }));
    const fileName = getExportFileName("Stok_Keluar", currentStore?.name || "Outlet", "all");
    exportToExcel(data, "Stok Keluar", fileName);
    toast.success(`Berhasil mengekspor ${data.length} data`);
  };

  const handleImportClick = () => {
    setPendingFile(null);
    setPreviewRows(null);
    setImportOpen(true);
  };

  const handleDownloadTemplate = () => {
    const sample = [
      { product: "hk025", variant: "", sku: "hk02540-1", supplier: "", qty: 1, new_buy_price: 50000 },
      { product: "hk034", variant: "", sku: "hk03439-1", supplier: "", qty: 1, new_buy_price: 50000 },
      { product: "hk054", variant: "", sku: "hk05440-2", supplier: "", qty: 3, new_buy_price: 50000 },
      { product: "hb082", variant: "", sku: "hb08237", supplier: "", qty: 1, new_buy_price: 55000 },
    ];
    exportToExcel(sample, "Template Stok Keluar", "Template_Import_Stok_Keluar");
    toast.success("Template berhasil diunduh");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      analyzeFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setPendingFile(file);
      analyzeFile(file);
    }
  };

  const analyzeFile = async (file: File) => {
    if (!currentStore) {
      toast.error("Pilih cabang terlebih dahulu");
      setPendingFile(null);
      return;
    }
    setAnalyzing(true);
    setPreviewRows(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        toast.error("File tidak memiliki sheet");
        setPendingFile(null);
        return;
      }
      const ws = wb.Sheets[firstSheet];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      console.log("[StockOut Import] parsed rows:", json.length, json[0]);
      if (json.length === 0) {
        toast.error("File kosong atau format tidak valid");
        setPendingFile(null);
        return;
      }
      if (json.length > 200) {
        toast.error("Maksimum 200 baris per import");
        setPendingFile(null);
        return;
      }

      // Load existing products for validation by name
      const { data: prods, error: prodErr } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", currentStore.id);
      if (prodErr) {
        console.error("[StockOut Import] product fetch error:", prodErr);
        toast.error("Gagal memuat daftar produk: " + prodErr.message);
        setPendingFile(null);
        return;
      }
      const productMap = new Map<string, { id: string; name: string }>();
      (prods || []).forEach((p: any) => {
        productMap.set(String(p.name).toLowerCase().trim(), p);
      });

      const seenSkus = new Set<string>();
      const rowsParsed: PreviewRow[] = json.map((row, i) => {
        const product = (row.product ?? row.Product ?? "").toString().trim();
        const variant = (row.variant ?? row.Variant ?? "").toString().trim();
        const sku = (row.sku ?? row.SKU ?? row.Sku ?? "").toString().trim();
        const supplier = (row.supplier ?? row.Supplier ?? "").toString().trim();
        const qty = Number(row.qty ?? row.Qty ?? row.quantity ?? 0) || 0;
        const new_buy_price = Number(row.new_buy_price ?? row.price ?? 0) || 0;

        let status: "valid" | "error" = "valid";
        let errorMessage: string | undefined;
        let matchedProductId: string | undefined;

        if (!product) {
          status = "error";
          errorMessage = "Nama produk kosong";
        } else {
          const matched = productMap.get(product.toLowerCase());
          if (!matched) {
            status = "error";
            errorMessage = `Produk "${product}" tidak ditemukan di database`;
          } else {
            matchedProductId = matched.id;
          }
        }
        if (status === "valid" && qty <= 0) {
          status = "error";
          errorMessage = "Qty harus lebih dari 0";
        }
        if (status === "valid" && sku) {
          const skuKey = sku.toLowerCase();
          if (seenSkus.has(skuKey)) {
            status = "error";
            errorMessage = `SKU varian "${sku}" duplikat di file`;
          } else {
            seenSkus.add(skuKey);
          }
        }

        return {
          index: i + 1,
          product,
          variant,
          sku,
          supplier,
          qty,
          new_buy_price,
          status,
          errorMessage,
          matchedProductId,
        };
      });

      setPreviewRows(rowsParsed);
    } catch (err: any) {
      console.error("[StockOut Import] analyze error:", err);
      toast.error("Gagal membaca file: " + (err?.message || "unknown"));
      setPendingFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleProcessImport = async () => {
    if (!currentStore || !previewRows) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    const validRows = previewRows.filter((r) => r.status === "valid");
    if (validRows.length === 0) {
      toast.error("Tidak ada baris valid untuk diimpor");
      return;
    }

    setImporting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Sesi tidak valid");
        return;
      }

      // Group valid rows by supplier
      const groups = new Map<string, PreviewRow[]>();
      for (const row of validRows) {
        const sup = row.supplier || "-";
        if (!groups.has(sup)) groups.set(sup, []);
        groups.get(sup)!.push(row);
      }

      const today = new Date().toISOString().split("T")[0];
      let successItems = 0;
      let failedItems = 0;
      let createdHeaders = 0;

      for (const [supplier, items] of groups.entries()) {
        const resolved = items.map((r) => ({
          product_id: r.matchedProductId!,
          product_name: r.product,
          quantity: r.qty,
          unit_price: r.new_buy_price,
          subtotal: r.qty * r.new_buy_price,
        }));
        const total_amount = resolved.reduce((s, r) => s + r.subtotal, 0);
        const supplier_name = supplier === "-" ? null : supplier;

        const { data: header, error: hErr } = await supabase
          .from("stock_out" as any)
          .insert({
            store_id: currentStore.id,
            date: today,
            supplier_name,
            total_amount,
            status: "draft",
            created_by: userId,
          } as any)
          .select("id")
          .single();

        if (hErr || !header) {
          failedItems += resolved.length;
          continue;
        }
        createdHeaders++;

        const itemRows = resolved.map((r) => ({ ...r, stock_out_id: (header as any).id }));
        const { error: iErr } = await supabase.from("stock_out_items" as any).insert(itemRows as any);
        if (iErr) failedItems += resolved.length;
        else successItems += resolved.length;
      }

      const errorCount = previewRows.length - validRows.length;
      if (successItems > 0)
        toast.success(`Berhasil mengimpor ${successItems} item ke ${createdHeaders} stok keluar`);
      if (failedItems > 0) toast.error(`${failedItems} item gagal diimpor`);
      if (errorCount > 0) toast.warning(`${errorCount} baris dilewati karena error`);
      fetchData();
      setImportOpen(false);
      setPendingFile(null);
      setPreviewRows(null);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengimpor data");
    } finally {
      setImporting(false);
    }
  };

  if (openForm) {
    return (
      <StockOutForm
        stockOutId={editId}
        onBack={() => {
          setOpenForm(false);
          setEditId(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <InventoryToolbar
        title="Daftar Stok Keluar"
        count={filtered.length}
        countLabel="Stok Keluar"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari No. Stok Keluar"
        onExport={handleExport}
        onImport={handleImportClick}
        onAdd={handleOpenNew}
        addLabel="Tambah"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Dialog open={importOpen} onOpenChange={(o) => { if (!importing) { setImportOpen(o); if (!o) { setPendingFile(null); setPreviewRows(null); } } }}>
        <DialogContent className={previewRows ? "sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>Import Stok Keluar</DialogTitle>
            <DialogDescription>
              Unggah file Excel/CSV untuk menambahkan banyak data sekaligus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {pendingFile && (
                  <>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[280px]">{pendingFile.name}</span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2"
                size="sm"
              >
                <FileDown className="h-4 w-4" /> Download Template
              </Button>
            </div>

            {!previewRows && (
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">Import dari Excel/CSV (max. 200 baris)</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Kolom: <span className="font-mono">product</span>, <span className="font-mono">variant</span>,{" "}
                <span className="font-mono">sku</span>, <span className="font-mono">supplier</span>,{" "}
                <span className="font-mono">qty</span>, <span className="font-mono">new_buy_price</span>.
                Tiap baris = 1 item; baris dengan supplier sama akan digabung ke 1 stok keluar.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                {analyzing ? (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">Menganalisis file...</p>
                  </div>
                ) : pendingFile ? (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium text-foreground">{pendingFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(pendingFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drop file di sini atau klik untuk pilih
                    </p>
                    <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
                  </div>
                )}
              </div>
            </div>
            )}

            {previewRows && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <UIBadge className="bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/10 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {previewRows.filter((r) => r.status === "valid").length} valid
                  </UIBadge>
                  <UIBadge variant="outline">{previewRows.length} baris</UIBadge>
                  {previewRows.some((r) => r.status === "error") && (
                    <UIBadge variant="outline" className="text-destructive border-destructive/30 gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {previewRows.filter((r) => r.status === "error").length} error
                    </UIBadge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setPendingFile(null); setPreviewRows(null); }}
                    className="ml-auto gap-2 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Reset
                  </Button>
                </div>

                {previewRows.some((r) => r.status === "error") && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Data dengan error tidak akan diimport. Pastikan nama produk sesuai dengan yang ada di sistem.
                  </div>
                )}

                <div className="border rounded-lg overflow-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Nama Produk</th>
                        <th className="text-left px-3 py-2 font-medium">SKU</th>
                        <th className="text-left px-3 py-2 font-medium">Varian</th>
                        <th className="text-left px-3 py-2 font-medium">SKU Varian</th>
                        <th className="text-left px-3 py-2 font-medium">Supplier</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Harga Beli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r) => (
                        <tr
                          key={r.index}
                          className={`border-t ${r.status === "error" ? "bg-destructive/5" : ""}`}
                        >
                          <td className="px-3 py-2 align-top">
                            {r.status === "valid" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-destructive text-xs">{r.errorMessage}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{r.product || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">-</td>
                          <td className="px-3 py-2">
                            {r.variant ? <UIBadge variant="outline">{r.variant}</UIBadge> : "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{r.sku || "-"}</td>
                          <td className="px-3 py-2">{r.supplier || "-"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.new_buy_price.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setImportOpen(false)}
                disabled={importing}
              >
                Batal
              </Button>
              <Button
                onClick={handleProcessImport}
                disabled={!previewRows || importing || analyzing || previewRows.filter((r) => r.status === "valid").length === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {importing
                  ? "Mengimpor..."
                  : previewRows
                  ? `Import (${previewRows.filter((r) => r.status === "valid").length})`
                  : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No. Stok Keluar</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Jumlah Item</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Memuat...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Belum ada data stok keluar
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenEdit(r.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium">{r.bid}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.supplier_name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.total_amount)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {r.item_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
