import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, X } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

type Row = Record<string, any>;

const BASE_COLUMNS = [
  "Nama Produk",
  "SKU Produk",
  "Kategori",
  "Nama Varian",
  "SKU Varian",
  "Harga Modal",
  "Harga Jual",
  "Stok",
  "Lacak Inventori",
  "Aktifkan di Website",
];

const TIER_TRIPLET = (n: number) => [
  `Tipe Pelanggan ${n}`,
  `Qty Order ${n}`,
  `Harga Jual ${n}`,
];

const truthy = (v: any) => {
  if (v === undefined || v === null || v === "") return false;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "ya", "yes", "y", "aktif"].includes(s);
};

export default function ImportProductsDialog({ open, onOpenChange, onImported }: Props) {
  const { currentStore } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setRows([]);
    setHeaders([]);
  };

  const handleFiles = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
      if (json.length === 0) {
        toast.error("File kosong");
        return;
      }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      toast.success(`${json.length} baris dimuat`);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal membaca file");
    }
  };

  const downloadTemplate = () => {
    const sample = [
      {
        "Nama Produk": "Kaos Polos",
        "SKU Produk": "KP-001",
        "Kategori": "Pakaian",
        "Nama Varian": "Merah - L",
        "SKU Varian": "KP-001-RD-L",
        "Harga Modal": 30000,
        "Harga Jual": 75000,
        "Stok": 10,
        "Lacak Inventori": 1,
        "Aktifkan di Website": 1,
        "Tipe Pelanggan 1": "Grosir",
        "Qty Order 1": 12,
        "Harga Jual 1": 65000,
        "Tipe Pelanggan 2": "Reseller",
        "Qty Order 2": 50,
        "Harga Jual 2": 55000,
      },
      {
        "Nama Produk": "Kaos Polos",
        "SKU Produk": "KP-001",
        "Kategori": "Pakaian",
        "Nama Varian": "Biru - M",
        "SKU Varian": "KP-001-BL-M",
        "Harga Modal": 30000,
        "Harga Jual": 75000,
        "Stok": 5,
        "Lacak Inventori": 1,
        "Aktifkan di Website": 1,
        "Tipe Pelanggan 1": "",
        "Qty Order 1": "",
        "Harga Jual 1": "",
        "Tipe Pelanggan 2": "",
        "Qty Order 2": "",
        "Harga Jual 2": "",
      },
    ];
    const headerOrder = [...BASE_COLUMNS, ...TIER_TRIPLET(1), ...TIER_TRIPLET(2)];
    const ws = XLSX.utils.json_to_sheet(sample, { header: headerOrder });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produk");
    XLSX.writeFile(wb, "template-import-produk.xlsx");
    toast.success("Template diunduh");
  };

  const doImport = async () => {
    if (!currentStore) return;
    if (rows.length === 0) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    setImporting(true);
    let createdProducts = 0;
    let createdVariants = 0;
    let createdTiers = 0;
    const errors: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Silakan login");
        return;
      }

      // Existing categories
      const { data: catData } = await supabase
        .from("product_categories")
        .select("id,name")
        .eq("store_id", currentStore.id);
      const catMap = new Map<string, string>(
        (catData || []).map((c) => [c.name.toLowerCase(), c.id])
      );

      // Group rows by product (Nama Produk + SKU Produk)
      const groups = new Map<string, Row[]>();
      for (const r of rows) {
        const name = String(r["Nama Produk"] || "").trim();
        if (!name) continue;
        const sku = String(r["SKU Produk"] || "").trim();
        const key = `${name}||${sku}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      for (const [key, gRows] of groups) {
        const first = gRows[0];
        const name = String(first["Nama Produk"] || "").trim();
        const sku = String(first["SKU Produk"] || "").trim() || null;
        const catName = String(first["Kategori"] || "").trim();
        let categoryId: string | null = null;
        if (catName) {
          const existing = catMap.get(catName.toLowerCase());
          if (existing) categoryId = existing;
          else {
            const { data: newCat, error: cErr } = await supabase
              .from("product_categories")
              .insert({
                name: catName,
                store_id: currentStore.id,
                created_by: user.id,
              })
              .select("id")
              .single();
            if (!cErr && newCat) {
              categoryId = newCat.id;
              catMap.set(catName.toLowerCase(), newCat.id);
            }
          }
        }

        const price = Number(first["Harga Jual"]) || 0;
        const purchase = Number(first["Harga Modal"]) || 0;
        const stock = Number(first["Stok"]) || 0;
        const track = truthy(first["Lacak Inventori"]);
        const website = truthy(first["Aktifkan di Website"]);

        try {
          const { data: prod, error: pErr } = await supabase
            .from("products")
            .insert({
              name,
              sku,
              price,
              purchase_price: purchase,
              stock_qty: stock,
              track_inventory: track,
              show_on_website: website,
              category_id: categoryId,
              store_id: currentStore.id,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (pErr) throw pErr;
          createdProducts++;

          // Variants
          for (const r of gRows) {
            const vName = String(r["Nama Varian"] || "").trim();
            if (!vName) continue;
            const vSku = String(r["SKU Varian"] || "").trim() || null;
            const { error: vErr } = await supabase
              .from("product_variants")
              .insert({
                product_id: prod.id,
                variant_name: vName,
                sku: vSku,
              } as any);
            if (!vErr) createdVariants++;
          }

          // Tiers from first row only (product-level)
          for (let n = 1; n <= 20; n++) {
            const label = String(first[`Tipe Pelanggan ${n}`] || "").trim();
            const qty = Number(first[`Qty Order ${n}`]) || 0;
            const tprice = Number(first[`Harga Jual ${n}`]) || 0;
            if (!label && !qty && !tprice) continue;
            if (qty <= 0 && tprice <= 0) continue;
            const { error: tErr } = await supabase
              .from("product_price_tiers")
              .insert({
                product_id: prod.id,
                min_quantity: qty || 1,
                price: tprice,
                label: label || null,
              });
            if (!tErr) createdTiers++;
          }
        } catch (e: any) {
          errors.push(`${name}: ${e.message || e}`);
        }
      }

      if (createdProducts > 0) {
        await logActivity({
          actionType: "created",
          entityType: "Produk",
          description: `Mengimpor ${createdProducts} produk, ${createdVariants} varian, ${createdTiers} tingkatan harga`,
          storeId: currentStore.id,
        });
        toast.success(
          `${createdProducts} produk, ${createdVariants} varian, ${createdTiers} tingkatan harga`
        );
        onImported();
        reset();
        onOpenChange(false);
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} baris gagal`);
        console.error("Import errors:", errors);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Gagal mengimpor");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Produk & Varian dari Excel
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Format: Nama Produk, SKU Produk, Kategori, Nama Varian, SKU Varian,
            Harga Modal, Harga Jual, Stok, Lacak Inventori, Aktifkan di Website,
            lalu triplet (Tipe Pelanggan #N, Qty Order #N, Harga Jual #N) untuk
            tingkatan harga
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">File Excel</div>
            <div className="flex gap-2 items-stretch">
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFiles(f);
                }}
                className={`flex-1 border-2 border-dashed rounded-md px-4 py-6 text-sm cursor-pointer transition-colors flex flex-col items-center justify-center gap-1 ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                {file ? (
                  <div className="text-center">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · klik untuk ganti, atau drag & drop file lain
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">
                      Klik atau drag & drop file di sini
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mendukung .xlsx, .xls, .csv
                    </div>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files?.[0] || null)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                className="h-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">
                  Preview ({rows.length} baris, menampilkan {Math.min(10, rows.length)})
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                >
                  <X className="h-3 w-3 mr-1" /> Hapus
                </Button>
              </div>
              <div className="border rounded-md max-h-64 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-xs">
                            {String(r[h] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={doImport}
            disabled={importing || rows.length === 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Mengimpor..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}