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
import { Download, Upload, FileSpreadsheet, X, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  "Koleksi",
  "Brand",
  "Jenis Bahan",
  "Penyimpanan",
  "Nama Varian",
  "SKU Varian",
  "Harga Modal",
  "Harga Jual",
  "Stok",
  "Lacak Inventori",
  "Harga Dinamis",
  "PPN Aktif",
  "Produk Aktif",
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

type ImportMode = "create" | "update";

export default function ImportProductsDialog({ open, onOpenChange, onImported }: Props) {
  const { currentStore } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<ImportMode>("create");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setProgress({ current: 0, total: 0, label: "" });
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
        "Koleksi": "Summer 2025",
        "Brand": "Brand A",
        "Jenis Bahan": "Cotton",
        "Penyimpanan": "Gudang Utama - Rak A1",
        "Nama Varian": "Merah - L",
        "SKU Varian": "KP-001-RD-L",
        "Harga Modal": 30000,
        "Harga Jual": 75000,
        "Stok": 10,
        "Lacak Inventori": 1,
        "Harga Dinamis": 0,
        "PPN Aktif": 0,
        "Produk Aktif": 1,
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
        "Koleksi": "Summer 2025",
        "Brand": "Brand A",
        "Jenis Bahan": "Cotton",
        "Penyimpanan": "Gudang Utama - Rak A1",
        "Nama Varian": "Biru - M",
        "SKU Varian": "KP-001-BL-M",
        "Harga Modal": 30000,
        "Harga Jual": 75000,
        "Stok": 5,
        "Lacak Inventori": 1,
        "Harga Dinamis": 0,
        "PPN Aktif": 0,
        "Produk Aktif": 1,
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
    let updatedProducts = 0;
    let createdVariants = 0;
    let createdTiers = 0;
    const errors: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Silakan login");
        return;
      }

      setProgress({ current: 0, total: 0, label: "Memuat data referensi..." });

      // Existing references
      const [{ data: catData }, { data: colData }, { data: brData }, { data: matData }, { data: stoData }] = await Promise.all([
        supabase.from("product_categories").select("id,name").eq("store_id", currentStore.id),
        supabase.from("product_collections" as any).select("id,name").eq("store_id", currentStore.id),
        supabase.from("product_brands").select("id,name").eq("store_id", currentStore.id),
        supabase.from("product_materials" as any).select("id,name").eq("store_id", currentStore.id),
        supabase.from("product_storages" as any).select("id,name").eq("store_id", currentStore.id),
      ]);
      const catMap = new Map<string, string>((catData || []).map((c: any) => [c.name.toLowerCase(), c.id]));
      const colMap = new Map<string, string>(((colData as any) || []).map((c: any) => [c.name.toLowerCase(), c.id]));
      const brMap = new Map<string, string>((brData || []).map((b: any) => [b.name.toLowerCase(), b.id]));
      const matMap = new Map<string, string>(((matData as any) || []).map((m: any) => [m.name.toLowerCase(), m.id]));
      const stoMap = new Map<string, string>(((stoData as any) || []).map((s: any) => [s.name.toLowerCase(), s.id]));

      const ensureRef = async (
        table: "product_categories" | "product_collections" | "product_brands" | "product_materials" | "product_storages",
        map: Map<string, string>,
        name: string
      ): Promise<string | null> => {
        const n = name.trim();
        if (!n) return null;
        const existing = map.get(n.toLowerCase());
        if (existing) return existing;
        const { data: created, error } = await supabase
          .from(table as any)
          .insert({ name: n, store_id: currentStore.id, created_by: user.id })
          .select("id")
          .single();
        if (error || !created) return null;
        map.set(n.toLowerCase(), (created as any).id);
        return (created as any).id;
      };

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

      const totalGroups = groups.size;
      setProgress({ current: 0, total: totalGroups, label: "Memulai import..." });
      let processed = 0;

      for (const [, gRows] of groups) {
        const first = gRows[0];
        const name = String(first["Nama Produk"] || "").trim();
        const sku = String(first["SKU Produk"] || "").trim() || null;
        processed++;
        setProgress({
          current: processed,
          total: totalGroups,
          label: `${mode === "create" ? "Menambahkan" : "Memperbarui"} ${processed}/${totalGroups}: ${name}`,
        });

        const categoryId = await ensureRef("product_categories", catMap, String(first["Kategori"] || ""));
        const collectionId = await ensureRef("product_collections", colMap, String(first["Koleksi"] || ""));
        const brandId = await ensureRef("product_brands", brMap, String(first["Brand"] || ""));
        const materialId = await ensureRef("product_materials", matMap, String(first["Jenis Bahan"] || ""));
        const storageId = await ensureRef("product_storages", stoMap, String(first["Penyimpanan"] || ""));

        const price = Number(first["Harga Jual"]) || 0;
        const purchase = Number(first["Harga Modal"]) || 0;
        const stock = Number(first["Stok"]) || 0;
        const hasCol = (k: string) => Object.prototype.hasOwnProperty.call(first, k) && first[k] !== "" && first[k] !== null && first[k] !== undefined;
        const track = hasCol("Lacak Inventori") ? truthy(first["Lacak Inventori"]) : true;
        const website = hasCol("Aktifkan di Website") ? truthy(first["Aktifkan di Website"]) : false;
        const dynamicPrice = hasCol("Harga Dinamis") ? truthy(first["Harga Dinamis"]) : false;
        const taxEnabled = hasCol("PPN Aktif") ? truthy(first["PPN Aktif"]) : false;
        const isActive = hasCol("Produk Aktif") ? truthy(first["Produk Aktif"]) : true;

        try {
          const payload: any = {
            name,
            sku,
            price,
            purchase_price: purchase,
            stock_qty: stock,
            track_inventory: track,
            show_on_website: website,
            is_active: isActive,
            tax_enabled: taxEnabled,
            dynamic_price: dynamicPrice,
            category_id: categoryId,
            collection_id: collectionId,
            brand_id: brandId,
            material_id: materialId,
            storage_id: storageId,
          };

          let productId: string | null = null;

          if (mode === "update") {
            // Match by SKU first, then name
            let existing: any = null;
            if (sku) {
              const { data } = await supabase
                .from("products")
                .select("id")
                .eq("store_id", currentStore.id)
                .eq("sku", sku)
                .maybeSingle();
              existing = data;
            }
            if (!existing) {
              const { data } = await supabase
                .from("products")
                .select("id")
                .eq("store_id", currentStore.id)
                .ilike("name", name)
                .maybeSingle();
              existing = data;
            }
            if (existing) {
              const { error: uErr } = await supabase
                .from("products")
                .update(payload)
                .eq("id", existing.id);
              if (uErr) throw uErr;
              productId = existing.id;
              updatedProducts++;
            } else {
              const { data: prod, error: pErr } = await supabase
                .from("products")
                .insert({ ...payload, store_id: currentStore.id, created_by: user.id })
                .select("id")
                .single();
              if (pErr) throw pErr;
              productId = prod.id;
              createdProducts++;
            }
          } else {
            const { data: prod, error: pErr } = await supabase
              .from("products")
              .insert({ ...payload, store_id: currentStore.id, created_by: user.id })
              .select("id")
              .single();
            if (pErr) throw pErr;
            productId = prod.id;
            createdProducts++;
          }

          // Variants
          for (const r of gRows) {
            const vName = String(r["Nama Varian"] || "").trim();
            if (!vName) continue;
            const vSku = String(r["SKU Varian"] || "").trim() || null;
            const { error: vErr } = await supabase
              .from("product_variants")
              .insert({
                product_id: productId,
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
                product_id: productId,
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

      if (createdProducts > 0 || updatedProducts > 0) {
        await logActivity({
          actionType: mode === "update" ? "updated" : "created",
          entityType: "Produk",
          description: `Import (${mode === "update" ? "ubah/tambah" : "tambah"}): ${createdProducts} baru, ${updatedProducts} diperbarui, ${createdVariants} varian, ${createdTiers} tingkatan harga`,
          storeId: currentStore.id,
        });
        toast.success(
          `${createdProducts} baru, ${updatedProducts} diperbarui, ${createdVariants} varian, ${createdTiers} tingkatan harga`
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
      setProgress({ current: 0, total: 0, label: "" });
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Produk & Varian dari Excel
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Kolom: Nama Produk, SKU Produk, Kategori, Koleksi, Brand, Jenis Bahan,
            Penyimpanan, Nama Varian, SKU Varian, Harga Modal, Harga Jual, Stok,
            Lacak Inventori, Harga Dinamis, PPN Aktif, Produk Aktif, Aktifkan di
            Website, lalu triplet (Tipe Pelanggan #N, Qty Order #N, Harga Jual #N)
            untuk tingkatan harga.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mode Import</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ImportMode)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              <label
                className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition ${
                  mode === "create" ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <RadioGroupItem value="create" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Tambah Produk Baru</div>
                  <div className="text-xs text-muted-foreground">
                    Setiap baris dibuat sebagai produk baru.
                  </div>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition ${
                  mode === "update" ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <RadioGroupItem value="update" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Edit / Perbarui Produk</div>
                  <div className="text-xs text-muted-foreground">
                    Cocokkan dengan SKU/Nama; bila tidak ada akan dibuat baru.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

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
                  <div className="text-center flex flex-col items-center gap-2">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · klik untuk ganti, atau drag & drop file lain
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                        if (inputRef.current) inputRef.current.value = "";
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Hapus File
                    </Button>
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
              </div>
              <div className="border rounded-md max-h-64 overflow-auto w-full">
                <Table className="text-xs">
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

          {importing && progress.total > 0 && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <div className="flex justify-between text-xs">
                <span className="font-medium truncate">{progress.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background shrink-0">
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