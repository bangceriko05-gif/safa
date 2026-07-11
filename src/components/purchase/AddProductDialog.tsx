import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import DiscountDialog from "./DiscountDialog";

export interface PickedProduct {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

interface PickItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  display_name: string;
  sku: string | null;
  name: string;
  purchase_price: number;
  price: number;
  stock_qty: number;
  has_variants: boolean;
}

interface UnitOpt {
  key: string;          // unique key
  label: string;        // e.g. "dus" or "pcs"
  price: number;        // price for 1 of this unit
  factor: number;       // how many base units = 1 of this unit
  baseUnit: string;     // the base unit name (to_unit)
  isBase: boolean;
}

export default function AddProductDialog({
  open,
  onClose,
  onAdd,
  editing,
  existingProductIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (p: PickedProduct) => void;
  editing?: PickedProduct | null;
  existingProductIds?: string[];
}) {
  const { currentStore } = useStore();
  const [products, setProducts] = useState<PickItem[]>([]);
  const [bestPrices, setBestPrices] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PickItem | null>(null);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"rp" | "pct">("rp");
  const [discountInput, setDiscountInput] = useState(0);
  const [unitOpts, setUnitOpts] = useState<UnitOpt[]>([]);
  const [unitKey, setUnitKey] = useState<string>("");

  useEffect(() => {
    if (!open || !currentStore) return;
    setSearch("");
    setDiscountMode("rp"); setDiscountInput(0);
    (async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,purchase_price,price,sku,stock_qty")
        .eq("store_id", currentStore.id)
        .order("name");
      const rawProducts = (prods as any[]) || [];
      const productIds = rawProducts.map((p) => p.id);
      let variantsByProduct: Record<string, any[]> = {};
      if (productIds.length > 0) {
        const { data: vars } = await supabase
          .from("product_variants")
          .select("id, product_id, variant_name, sku, price, purchase_price, stock, is_active")
          .in("product_id", productIds)
          .eq("is_active", true);
        (vars as any[] | null)?.forEach((v) => {
          (variantsByProduct[v.product_id] ||= []).push(v);
        });
      }
      const list: PickItem[] = [];
      rawProducts.forEach((p: any) => {
        const vs = variantsByProduct[p.id] || [];
        if (vs.length > 0) {
          vs.forEach((v: any) => {
            list.push({
              id: `v:${v.id}`,
              product_id: p.id,
              variant_id: v.id,
              display_name: `${p.name} - ${v.variant_name}`,
              sku: v.sku || null,
              name: p.name,
              purchase_price: Number(v.purchase_price) || Number(p.purchase_price) || 0,
              price: Number(v.price) || Number(p.price) || 0,
              stock_qty: Number(v.stock) || 0,
              has_variants: true,
            });
          });
        } else {
          list.push({
            id: `p:${p.id}`,
            product_id: p.id,
            variant_id: null,
            display_name: p.name,
            sku: p.sku || null,
            name: p.name,
            purchase_price: Number(p.purchase_price) || 0,
            price: Number(p.price) || 0,
            stock_qty: Number(p.stock_qty) || 0,
            has_variants: false,
          });
        }
      });
      setProducts(list);
      // Fetch active conversions to determine best (highest) unit price per product
      if (productIds.length > 0) {
        const { data: convs } = await supabase
          .from("product_unit_conversions")
          .select("product_id, price_per_from, is_active")
          .in("product_id", productIds)
          .eq("is_active", true);
        const map: Record<string, number> = {};
        (convs as any[] | null)?.forEach((c) => {
          const pid = c.product_id as string;
          const price = Number(c.price_per_from) || 0;
          if (price > 0 && (!map[pid] || price > map[pid])) map[pid] = price;
        });
        setBestPrices(map);
      } else {
        setBestPrices({});
      }
      if (editing) {
        // Match by product_id and try to match variant via SKU parenthetical
        const editName = editing.product_name || "";
        const found =
          list.find((p) => {
            if (p.product_id !== editing.product_id) return false;
            if (!p.has_variants) return true;
            return p.sku ? editName.includes(`(${p.sku})`) : editName.startsWith(p.display_name);
          }) || null;
        const fallback: PickItem = {
          id: `p:${editing.product_id || ""}`,
          product_id: editing.product_id || "",
          variant_id: null,
          display_name: editing.product_name,
          sku: null,
          name: editing.product_name,
          purchase_price: editing.unit_price,
          price: 0,
          stock_qty: 0,
          has_variants: false,
        };
        await pickProduct(found || fallback, editing.unit_price);
        setQty(editing.quantity);
        setDiscount(editing.discount || 0);
      } else {
        setSelected(null); setQty(1); setUnitPrice(0); setDiscount(0);
        setUnitOpts([]); setUnitKey("");
      }
    })();
  }, [open, currentStore, editing]);

  const isItemAlreadyAdded = (p: PickItem) => {
    if (editing) {
      // allow the currently-edited row
      const editName = editing.product_name || "";
      const stripped = editName.replace(/\s*\([^)]* \/ [^)]*\)\s*$/, "");
      const cur = p.sku ? `${p.display_name} (${p.sku})` : p.display_name;
      if (stripped === cur || stripped === p.display_name) return false;
    }
    return existingProductIds.some((key) => {
      // Backward-compat: keys are product_ids. For variant rows, compare against
      // composed identity encoded in name via extra prop existingProductNames.
      return key === `${p.product_id}::${p.variant_id ?? ""}` || (!p.has_variants && key === p.product_id);
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.display_name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const pick = (p: PickItem) => {
    pickProduct(p);
  };

  const pickProduct = async (p: PickItem, presetPrice?: number) => {
    setSelected(p);
    const baseUnit = (p as any).unit || "pcs";
    let opts: UnitOpt[] = [];
    // Only offer unit conversions for products without variants
    if (p.product_id && !p.has_variants) {
      const { data: convs } = await supabase
        .from("product_unit_conversions")
        .select("id, from_unit, to_unit, factor, price_per_from, is_active")
        .eq("product_id", p.product_id)
        .eq("is_active", true);
      opts = ((convs as any[]) || [])
        .filter((c) => Number(c.factor) > 0)
        .map((c) => ({
          key: `conv:${c.id}`,
          label: c.from_unit,
          price: Number(c.price_per_from) || 0,
          factor: Number(c.factor),
          baseUnit: c.to_unit,
          isBase: false,
        }));
    }
    // Jika ada konversi satuan aktif, hanya pakai satuan tersebut.
    if (opts.length === 0) {
      opts.push({
        key: "base",
        label: baseUnit,
        price: Number(p.purchase_price) || 0,
        factor: 1,
        baseUnit,
        isBase: true,
      });
    }
    setUnitOpts(opts);
    // Default: largest unit with a price > 0, else base
    const priced = opts.filter((o) => !o.isBase && o.price > 0);
    const def = priced.sort((a, b) => b.factor - a.factor)[0] || opts[opts.length - 1];
    setUnitKey(def.key);
    setUnitPrice(presetPrice ?? (def.price || Number(p.purchase_price) || 0));
  };

  const currentUnit = unitOpts.find((u) => u.key === unitKey);

  const changeUnit = (k: string) => {
    setUnitKey(k);
    const u = unitOpts.find((x) => x.key === k);
    if (u) setUnitPrice(u.price || (u.isBase ? Number(selected?.purchase_price) || 0 : 0));
  };

  const submit = () => {
    if (!selected) return;
    const unitSuffix = currentUnit ? ` (${currentUnit.label}${!currentUnit.isBase ? ` / ${currentUnit.factor} ${currentUnit.baseUnit}` : ""})` : "";
    const skuSuffix = selected.has_variants && selected.sku ? ` (${selected.sku})` : "";
    onAdd({
      product_id: selected.product_id,
      product_name: selected.display_name + skuSuffix + unitSuffix,
      quantity: qty,
      unit_price: unitPrice,
      discount,
    });
    onClose();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
       <DialogHeader>
          <DialogTitle>{editing ? "Ubah Produk" : "Tambah Produk"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="pl-9"
            />
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Produk tidak ditemukan</div>
            ) : (
              filtered.map((p) => {
                const isAlreadyAdded = isItemAlreadyAdded(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => !isAlreadyAdded && pick(p)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left border-b last:border-b-0 ${
                      selected?.id === p.id ? "bg-accent" : ""
                    } ${isAlreadyAdded ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"}`}
                  >
                    <div>
                      <div className="font-medium">{p.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ? `SKU: ${p.sku} · ` : ""}Stok: {p.stock_qty}
                        {isAlreadyAdded ? " · Sudah ditambahkan" : ""}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{fmt(p.has_variants ? Number(p.purchase_price) : (bestPrices[p.product_id] ?? Number(p.purchase_price) ?? 0))}</div>
                  </button>
                );
              })
            )}
          </div>

          {selected && (
            <div className="grid grid-cols-3 gap-3 border-t pt-4">
              <div className="col-span-3">
                <Label>Satuan</Label>
                <Select value={unitKey} onValueChange={changeUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOpts.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {u.isBase
                          ? `${u.label} (satuan dasar)`
                          : `${u.label} / ${u.factor} ${u.baseUnit}`}
                        {u.price > 0 ? ` — ${fmt(u.price)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentUnit && !currentUnit.isBase && (
                  <p className="text-xs text-muted-foreground mt-1">
                    1 {currentUnit.label} = {currentUnit.factor} {currentUnit.baseUnit}
                  </p>
                )}
              </div>
              <div>
                <Label>Qty</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Harga / {currentUnit?.label || "satuan"} (IDR)</Label>
                <Input
                  inputMode="numeric"
                  value={unitPrice ? new Intl.NumberFormat("id-ID").format(unitPrice) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setUnitPrice(raw ? parseInt(raw, 10) : 0);
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Diskon (IDR)</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setDiscountOpen(true)}
                >
                  <span>{fmt(discount)}</span>
                  <span className="text-xs text-muted-foreground">Atur</span>
                </Button>
              </div>
              <div className="col-span-3 text-right text-sm">
                Subtotal: <span className="font-bold">{fmt(qty * unitPrice - discount)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={submit} disabled={!selected}>{editing ? "Simpan" : "Tambahkan"}</Button>
          </div>
        </div>
        <DiscountDialog
          open={discountOpen}
          onClose={() => setDiscountOpen(false)}
          baseAmount={qty * unitPrice}
          initialMode={discountMode}
          initialValue={discountInput}
          onApply={(abs, mode, value) => {
            setDiscount(abs);
            setDiscountMode(mode);
            setDiscountInput(value);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
