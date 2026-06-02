import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

interface VariantConflict {
  productName: string;
  productSku: string;
  matchedBy: "sku_varian" | "nama_varian";
  oldData: {
    variant_name: string;
    sku: string | null;
    price: number;
    purchase_price: number;
    stock: number;
  };
  newData: {
    variant_name: string;
    sku: string | null;
    price: number;
    purchase_price: number;
    stock: number;
  };
  diffFields: string[];
}

export default function ImportProductsDialog({ open, onOpenChange, onImported }: Props) {
  const { currentStore } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<ImportMode>("create");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());
  const [checkingMissing, setCheckingMissing] = useState(false);
  const [conflicts, setConflicts] = useState<VariantConflict[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const overwriteConfirmedRef = useRef(false);
  const autoTriggeredRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const createdProductIdsRef = useRef<string[]>([]);
  const createdVariantIdsRef = useRef<string[]>([]);
  const createdTierIdsRef = useRef<string[]>([]);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const reset = () => {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setProgress({ current: 0, total: 0, label: "" });
    setMissingKeys(new Set());
    setConflicts([]);
    setConflictDialogOpen(false);
    overwriteConfirmedRef.current = false;
    autoTriggeredRef.current = null;
    cancelRef.current = false;
    createdProductIdsRef.current = [];
    createdVariantIdsRef.current = [];
    createdTierIdsRef.current = [];
    setCancelConfirmOpen(false);
  };

  // Unique product keys (name||sku) from rows
  const uniqueProducts = useMemo(() => {
    const m = new Map<string, { name: string; sku: string }>();
    for (const r of rows) {
      const name = String(r["Nama Produk"] || "").trim();
      if (!name) continue;
      const sku = String(r["SKU Produk"] || "").trim();
      const key = `${name.toLowerCase()}||${sku.toLowerCase()}`;
      if (!m.has(key)) m.set(key, { name, sku });
    }
    return m;
  }, [rows]);

  // Check existence on preview when mode = update
  useEffect(() => {
    if (mode !== "update" || !currentStore || uniqueProducts.size === 0) {
      setMissingKeys(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setCheckingMissing(true);
      const missing = new Set<string>();
      for (const [key, { name, sku }] of uniqueProducts) {
        let found: any = null;
        if (sku) {
          const { data } = await supabase
            .from("products")
            .select("id")
            .eq("store_id", currentStore.id)
            .eq("sku", sku)
            .maybeSingle();
          found = data;
        }
        if (!found) {
          const { data } = await supabase
            .from("products")
            .select("id")
            .eq("store_id", currentStore.id)
            .ilike("name", name)
            .maybeSingle();
          found = data;
        }
        if (!found) missing.add(key);
      }
      if (!cancelled) setMissingKeys(missing);
      setCheckingMissing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, uniqueProducts, currentStore]);

  const rowKey = (r: Row) => {
    const name = String(r["Nama Produk"] || "").trim().toLowerCase();
    const sku = String(r["SKU Produk"] || "").trim().toLowerCase();
    return `${name}||${sku}`;
  };

  // Auto-open conflict dialog when all products found in update mode
  useEffect(() => {
    if (mode !== "update") return;
    if (checkingMissing) return;
    if (rows.length === 0) return;
    if (missingKeys.size > 0) return;
    const sig = `${file?.name || ""}|${rows.length}`;
    if (autoTriggeredRef.current === sig) return;
    autoTriggeredRef.current = sig;
    (async () => {
      const found = await scanConflicts();
      if (found.length > 0) {
        setConflicts(found);
        setConflictDialogOpen(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingMissing, missingKeys, mode, rows, file]);

  const handleFiles = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    autoTriggeredRef.current = null;
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

  const runImport = async (overwriteVariants: boolean) => {
    if (!currentStore) return;
    if (rows.length === 0) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    cancelRef.current = false;
    createdProductIdsRef.current = [];
    createdVariantIdsRef.current = [];
    createdTierIdsRef.current = [];
    setImporting(true);
    let createdProducts = 0;
    let updatedProducts = 0;
    let createdVariants = 0;
    let updatedVariants = 0;
    let skippedVariants = 0;
    let createdTiers = 0;
    let skippedProducts = 0;
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
        if (cancelRef.current) break;
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
              skippedProducts++;
              errors.push(`${name}${sku ? ` (SKU: ${sku})` : ""}: produk tidak ditemukan, dilewati (mode Edit/Perbarui)`);
              continue;
            }
          } else {
            const { data: prod, error: pErr } = await supabase
              .from("products")
              .insert({ ...payload, store_id: currentStore.id, created_by: user.id })
              .select("id")
              .single();
            if (pErr) throw pErr;
            productId = prod.id;
            createdProductIdsRef.current.push(prod.id);
            createdProducts++;
          }

          // Variants
          for (const r of gRows) {
            if (cancelRef.current) break;
            const vName = String(r["Nama Varian"] || "").trim();
            if (!vName) continue;
            const vSku = String(r["SKU Varian"] || "").trim() || null;
            const vPrice = Number(r["Harga Jual"]) || 0;
            const vPurchase = Number(r["Harga Modal"]) || 0;
            const vStock = Number(r["Stok"]) || 0;
            const vPayload: any = {
              product_id: productId,
              variant_name: vName,
              sku: vSku,
              price: vPrice,
              purchase_price: vPurchase,
              stock: vStock,
            };

            // In update mode, try to match existing variant by SKU first, then by name
            let existingVariant: any = null;
            if (mode === "update") {
              if (vSku) {
                const { data } = await supabase
                  .from("product_variants")
                  .select("id")
                  .eq("product_id", productId)
                  .eq("sku", vSku)
                  .maybeSingle();
                existingVariant = data;
              }
              if (!existingVariant) {
                const { data } = await supabase
                  .from("product_variants")
                  .select("id")
                  .eq("product_id", productId)
                  .ilike("variant_name", vName)
                  .maybeSingle();
                existingVariant = data;
              }
            }

            if (existingVariant) {
              if (!overwriteVariants) {
                skippedVariants++;
                continue;
              }
              const { error: vErr } = await supabase
                .from("product_variants")
                .update(vPayload)
                .eq("id", existingVariant.id);
              if (!vErr) updatedVariants++;
              else errors.push(`Varian ${vName}: ${vErr.message}`);
            } else {
              const { data: insertedVariant, error: vErr } = await supabase
                .from("product_variants")
                .insert(vPayload)
                .select("id")
                .single();
              if (!vErr && insertedVariant) {
                createdVariants++;
                createdVariantIdsRef.current.push(insertedVariant.id);
              }
              else errors.push(`Varian ${vName}: ${vErr.message}`);
            }
          }

          // Tiers from first row only (product-level)
          for (let n = 1; n <= 20; n++) {
            if (cancelRef.current) break;
            const label = String(first[`Tipe Pelanggan ${n}`] || "").trim();
            const qty = Number(first[`Qty Order ${n}`]) || 0;
            const tprice = Number(first[`Harga Jual ${n}`]) || 0;
            if (!label && !qty && !tprice) continue;
            if (qty <= 0 && tprice <= 0) continue;
            const { data: insertedTier, error: tErr } = await supabase
              .from("product_price_tiers")
              .insert({
                product_id: productId,
                min_quantity: qty || 1,
                price: tprice,
                label: label || null,
              })
              .select("id")
              .single();
            if (!tErr && insertedTier) {
              createdTiers++;
              createdTierIdsRef.current.push(insertedTier.id);
            }
          }
        } catch (e: any) {
          errors.push(`${name}: ${e.message || e}`);
        }
      }

      // If cancelled, rollback all newly-created records from this run
      if (cancelRef.current) {
        setProgress({ current: 0, total: 1, label: "Membatalkan & menghapus data yang sudah terimport..." });
        const tierIds = createdTierIdsRef.current;
        const variantIds = createdVariantIdsRef.current;
        const productIds = createdProductIdsRef.current;
        try {
          if (tierIds.length > 0) {
            await supabase.from("product_price_tiers").delete().in("id", tierIds);
          }
          if (variantIds.length > 0) {
            await supabase.from("product_variants").delete().in("id", variantIds);
          }
          if (productIds.length > 0) {
            await supabase.from("products").delete().in("id", productIds);
          }
        } catch (delErr) {
          console.error("Rollback error:", delErr);
        }
        toast.warning(
          `Import dibatalkan. ${productIds.length} produk baru, ${variantIds.length} varian baru, ${tierIds.length} tingkatan harga telah dihapus.${
            updatedProducts > 0 || updatedVariants > 0
              ? ` Catatan: ${updatedProducts} produk & ${updatedVariants} varian yang sudah terlanjur diperbarui tidak dapat dikembalikan.`
              : ""
          }`
        );
        onImported();
        reset();
        onOpenChange(false);
        return;
      }

      if (createdProducts > 0 || updatedProducts > 0) {
        await logActivity({
          actionType: mode === "update" ? "updated" : "created",
          entityType: "Produk",
          description: `Import (${mode === "update" ? "perbarui" : "tambah"}): ${createdProducts} produk baru, ${updatedProducts} diperbarui, ${skippedProducts} dilewati, ${createdVariants} varian baru, ${updatedVariants} varian diperbarui, ${createdTiers} tingkatan harga`,
          storeId: currentStore.id,
        });
        toast.success(
          mode === "update"
            ? `${updatedProducts} produk diperbarui${skippedProducts ? `, ${skippedProducts} dilewati` : ""}, ${updatedVariants} varian diperbarui, ${createdVariants} varian baru${skippedVariants ? `, ${skippedVariants} varian dilewati` : ""}`
            : `${createdProducts} baru, ${createdVariants} varian, ${createdTiers} tingkatan harga`
        );
        onImported();
        reset();
        onOpenChange(false);
      } else if (mode === "update" && skippedProducts > 0) {
        toast.error(`${skippedProducts} produk tidak ditemukan di database — tidak ada yang diperbarui`);
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} baris gagal/dilewati`);
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

  // Scan for variant conflicts (only relevant in update mode)
  const scanConflicts = async (): Promise<VariantConflict[]> => {
    if (!currentStore || mode !== "update") return [];
    const found: VariantConflict[] = [];
    for (const r of rows) {
      const pName = String(r["Nama Produk"] || "").trim();
      if (!pName) continue;
      const pSku = String(r["SKU Produk"] || "").trim();
      const vName = String(r["Nama Varian"] || "").trim();
      if (!vName) continue;
      const vSku = String(r["SKU Varian"] || "").trim();

      // find product
      let product: any = null;
      if (pSku) {
        const { data } = await supabase
          .from("products")
          .select("id,name,sku")
          .eq("store_id", currentStore.id)
          .eq("sku", pSku)
          .maybeSingle();
        product = data;
      }
      if (!product) {
        const { data } = await supabase
          .from("products")
          .select("id,name,sku")
          .eq("store_id", currentStore.id)
          .ilike("name", pName)
          .maybeSingle();
        product = data;
      }
      if (!product) continue;

      // find variant
      let variant: any = null;
      let matchedBy: "sku_varian" | "nama_varian" = "sku_varian";
      if (vSku) {
        const { data } = await supabase
          .from("product_variants")
          .select("id,variant_name,sku,price,purchase_price,stock")
          .eq("product_id", product.id)
          .eq("sku", vSku)
          .maybeSingle();
        variant = data;
      }
      if (!variant) {
        const { data } = await supabase
          .from("product_variants")
          .select("id,variant_name,sku,price,purchase_price,stock")
          .eq("product_id", product.id)
          .ilike("variant_name", vName)
          .maybeSingle();
        if (data) {
          variant = data;
          matchedBy = "nama_varian";
        }
      }
      if (!variant) continue;

      const newData = {
        variant_name: vName,
        sku: vSku || null,
        price: Number(r["Harga Jual"]) || 0,
        purchase_price: Number(r["Harga Modal"]) || 0,
        stock: Number(r["Stok"]) || 0,
      };
      const oldData = {
        variant_name: variant.variant_name,
        sku: variant.sku,
        price: Number(variant.price) || 0,
        purchase_price: Number(variant.purchase_price) || 0,
        stock: Number(variant.stock) || 0,
      };
      const diffFields: string[] = [];
      (["variant_name", "sku", "price", "purchase_price", "stock"] as const).forEach((k) => {
        if (String(oldData[k] ?? "") !== String(newData[k] ?? "")) diffFields.push(k);
      });
      if (diffFields.length === 0) continue;

      found.push({
        productName: product.name,
        productSku: product.sku || "",
        matchedBy,
        oldData,
        newData,
        diffFields,
      });
    }
    return found;
  };

  const doImport = async () => {
    if (!currentStore) return;
    if (rows.length === 0) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    if (mode === "update") {
      setImporting(true);
      setProgress({ current: 0, total: 1, label: "Memeriksa perubahan varian..." });
      try {
        const found = await scanConflicts();
        if (found.length > 0) {
          setConflicts(found);
          setConflictDialogOpen(true);
          setImporting(false);
          setProgress({ current: 0, total: 0, label: "" });
          return;
        }
      } finally {
        // continue
      }
      setImporting(false);
    }
    await runImport(true);
  };

  const fieldLabel = (k: string) =>
    ({
      variant_name: "Nama Varian",
      sku: "SKU Varian",
      price: "Harga Jual",
      purchase_price: "Harga Modal",
      stock: "Stok",
    } as Record<string, string>)[k] || k;

  const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          if (importing) {
            // Block accidental close while importing — ask via cancel dialog
            setCancelConfirmOpen(true);
            return;
          }
          reset();
        }
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
                    Cocokkan dengan SKU/Nama; produk yang tidak ada akan dilewati.
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
                {mode === "update" && (
                  <div className="text-xs text-muted-foreground">
                    {checkingMissing
                      ? "Memeriksa keberadaan produk..."
                      : missingKeys.size > 0
                      ? `${missingKeys.size} produk tidak ditemukan`
                      : "Semua produk ditemukan"}
                  </div>
                )}
              </div>
              {mode === "update" && !checkingMissing && missingKeys.size > 0 && (
                <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs px-3 py-2">
                  Mode Edit/Perbarui: {missingKeys.size} produk tidak ditemukan di database
                  dan akan dilewati saat import. Untuk membuat produk baru, gunakan
                  mode <strong>Tambah Produk Baru</strong>.
                </div>
              )}
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
                    {rows.slice(0, 10).map((r, i) => {
                      const isMissing = mode === "update" && missingKeys.has(rowKey(r));
                      return (
                        <TableRow
                          key={i}
                          className={
                            isMissing
                              ? "bg-destructive/10 hover:bg-destructive/15"
                              : ""
                          }
                          title={isMissing ? "Produk tidak ditemukan di database" : undefined}
                        >
                          {headers.map((h, idx) => (
                            <TableCell
                              key={h}
                              className={`whitespace-nowrap text-xs ${
                                isMissing ? "text-destructive font-medium" : ""
                              } ${isMissing && idx === 0 ? "border-l-4 border-destructive" : ""}`}
                            >
                              {String(r[h] ?? "")}
                              {isMissing && idx === 0 && (
                                <span className="ml-2 inline-block rounded bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[10px] font-semibold">
                                  TIDAK DITEMUKAN
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
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
          <Button
            variant="outline"
            onClick={() => {
              if (importing) {
                setCancelConfirmOpen(true);
              } else {
                onOpenChange(false);
              }
            }}
          >
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

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan import?</AlertDialogTitle>
            <AlertDialogDescription>
              Proses import sedang berjalan ({progress.current}/{progress.total}). Jika
              dibatalkan, semua produk, varian, dan tingkatan harga yang sudah berhasil
              dibuat dalam proses ini akan dihapus. Produk/varian yang sudah terlanjur
              <strong> diperbarui</strong> (mode Edit) tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lanjutkan Import</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                cancelRef.current = true;
                setCancelConfirmOpen(false);
              }}
            >
              Ya, Batalkan & Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Perubahan Varian</AlertDialogTitle>
            <AlertDialogDescription>
              Ditemukan {conflicts.length} varian yang cocok (berdasarkan SKU Varian
              / Nama Varian) dengan data berbeda. Apakah Anda ingin mengganti data
              lama dengan data baru?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 border rounded-md">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Cocok via</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Data Lama</TableHead>
                  <TableHead>Data Baru</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.flatMap((c, ci) =>
                  c.diffFields.map((f, fi) => (
                    <TableRow key={`${ci}-${fi}`}>
                      {fi === 0 ? (
                        <>
                          <TableCell rowSpan={c.diffFields.length} className="align-top">
                            <div className="font-medium">{c.productName}</div>
                            {c.productSku && (
                              <div className="text-muted-foreground text-[10px]">
                                SKU: {c.productSku}
                              </div>
                            )}
                          </TableCell>
                          <TableCell rowSpan={c.diffFields.length} className="align-top">
                            <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]">
                              {c.matchedBy === "sku_varian" ? "SKU Varian" : "Nama Varian"}
                            </span>
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="font-medium">{fieldLabel(f)}</TableCell>
                      <TableCell className="text-destructive line-through">
                        {fmt((c.oldData as any)[f])}
                      </TableCell>
                      <TableCell className="text-emerald-600 font-medium">
                        {fmt((c.newData as any)[f])}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConflictDialogOpen(false);
                await runImport(true);
              }}
            >
              Ya, Ganti dengan Data Baru
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}