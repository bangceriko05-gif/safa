import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Package } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

interface Recipe {
  id: string;
  product_id: string;
  variant_id: string | null;
  ingredient_product_id: string;
  qty: number;
  unit_from: string | null;
  unit_to: string | null;
  unit_factor: number;
  note?: string | null;
  ingredient?: { name: string; purchase_price: number };
}

interface Variant {
  id: string;
  variant_name: string;
  price: number;
}

interface IngredientOpt {
  id: string;
  name: string;
  purchase_price: number;
  stock_qty?: number;
  material_name?: string | null;
}

interface Props {
  productId: string | null;
  productPrice: number;
}

const fmt = (n: number) => {
  if (!isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return rounded.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
};

export default function ProductRecipeTab({ productId, productPrice }: Props) {
  const { currentStore } = useStore();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOpt[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [filterVariant, setFilterVariant] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [forVariantId, setForVariantId] = useState<string | null>(null);

  // form
  const [ingId, setIngId] = useState<string>("");
  const [ingSearch, setIngSearch] = useState<string>("");
  const [ingFocused, setIngFocused] = useState(false);
  const [measureValue, setMeasureValue] = useState<number>(1);
  const [satuan, setSatuan] = useState<string>("gram");
  const [note, setNote] = useState<string>("");

  const load = async () => {
    if (!productId) {
      setVariants([]);
      setRecipes([]);
      return;
    }
    const [{ data: vs }, { data: rs }] = await Promise.all([
      supabase
        .from("product_variants")
        .select("id, variant_name, price")
        .eq("product_id", productId)
        .order("created_at"),
      supabase
        .from("product_recipes")
        .select("*, ingredient:ingredient_product_id(name, purchase_price)")
        .eq("product_id", productId),
    ]);
    setVariants((vs as any) || []);
    setRecipes((rs as any) || []);
  };

  const loadIngredients = async () => {
    if (!currentStore) return;
    const { data: mats } = await supabase
      .from("product_materials" as any)
      .select("id, name")
      .eq("store_id", currentStore.id);
    const matMap = new Map<string, string>(
      ((mats as any[]) || []).map((m) => [m.id, m.name])
    );
    const allowedIds = ((mats as any[]) || [])
      .filter((m) => ["bahan mentah", "kemasan"].includes((m.name || "").toLowerCase()))
      .map((m) => m.id);
    if (allowedIds.length === 0) {
      setIngredients([]);
      return;
    }
    const { data } = await supabase
      .from("products")
      .select("id, name, purchase_price, material_id, stock_qty")
      .eq("store_id", currentStore.id)
      .in("material_id", allowedIds)
      .order("name");
    setIngredients(
      ((data as any) || [])
        .filter((p: any) => p.id !== productId)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          purchase_price: p.purchase_price,
          stock_qty: p.stock_qty,
          material_name: matMap.get(p.material_id) || null,
        }))
    );
  };

  const loadUnits = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from("product_units" as any)
      .select("id, name")
      .eq("store_id", currentStore.id)
      .order("name");
    setUnits(((data as any) || []) as any);
  };

  useEffect(() => {
    load();
    loadIngredients();
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, currentStore?.id]);

  const openAdd = (variantId: string | null) => {
    setEditing(null);
    setForVariantId(variantId);
    setIngId("");
    setIngSearch("");
    setMeasureValue(1);
    setSatuan(units[0]?.name || "gram");
    setNote("");
    setDialogOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setForVariantId(r.variant_id);
    setIngId(r.ingredient_product_id);
    setIngSearch(r.ingredient?.name || "");
    setMeasureValue(Number(r.unit_factor) || Number(r.qty) || 1);
    setSatuan(r.unit_from || units[0]?.name || "gram");
    setNote(r.note || "");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!productId || !ingId) {
      toast.error("Pilih item inventori terlebih dahulu");
      return;
    }
    const v = Number(measureValue) || 0;
    const payload = {
      product_id: productId,
      variant_id: forVariantId,
      ingredient_product_id: ingId,
      qty: v,
      unit_from: satuan,
      unit_to: "pcs",
      unit_factor: v || 1,
      note: note || null,
    };
    if (editing) {
      const { error } = await supabase
        .from("product_recipes")
        .update(payload as any)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("product_recipes").insert([payload as any]);
      if (error) return toast.error(error.message);
    }
    toast.success("Bahan disimpan");
    setDialogOpen(false);
    load();
  };

  const remove = async (r: Recipe) => {
    if (!confirm("Hapus bahan ini?")) return;
    await supabase.from("product_recipes").delete().eq("id", r.id);
    load();
  };

  // HPP per variant = sum(qty * (ingredient.purchase_price / unit_factor))
  const hppForVariant = (variantId: string | null) => {
    return recipes
      .filter((r) => (r.variant_id ?? null) === variantId)
      .reduce((sum, r) => {
        const unitPrice =
          (r.ingredient?.purchase_price || 0) / (Number(r.unit_factor) || 1);
        return sum + Number(r.qty) * unitPrice;
      }, 0);
  };

  if (!productId) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-md">
        Simpan produk terlebih dahulu untuk menambahkan bahan/resep.
      </div>
    );
  }

  // Mengikuti produk asli: jika ada varian, gunakan varian saja (tanpa BIASA).
  // Jika tidak ada varian, gunakan satu group "BIASA" sebagai default.
  const groups: { id: string | null; name: string; price: number }[] =
    variants.length > 0
      ? variants.map((v) => ({ id: v.id, name: v.variant_name, price: v.price }))
      : [{ id: null, name: "BIASA", price: productPrice }];

  const visibleGroups =
    filterVariant === "all"
      ? groups
      : groups.filter((g) => (g.id ?? "biasa") === filterVariant);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Bahan / Resep</h3>
          <p className="text-sm text-muted-foreground">
            Kelola bahan per varian dengan qty dan unit pengukuran
          </p>
        </div>
        <Select value={filterVariant} onValueChange={setFilterVariant}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id ?? "biasa"} value={g.id ?? "biasa"}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {visibleGroups.map((g) => {
          const groupRecipes = recipes.filter(
            (r) => (r.variant_id ?? null) === g.id
          );
          const hpp = hppForVariant(g.id);
          const margin = (g.price || 0) - hpp;
          const marginPct = g.price > 0 ? (margin / g.price) * 100 : 0;
          return (
            <div key={g.id ?? "biasa"} className="border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 border-2 border-primary rounded-md font-bold text-sm">
                    {g.name}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-red-50 text-red-700 border border-red-200">
                    HPP: Rp {fmt(hpp)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                    Jual: Rp {fmt(g.price)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200">
                    Margin: Rp {fmt(margin)} ({fmt(marginPct)}%)
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAdd(g.id)}
                >
                  <Plus className="mr-1 h-4 w-4" /> Tambah
                </Button>
              </div>
              {groupRecipes.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Belum ada bahan
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupRecipes.map((r) => {
                    const unitPrice =
                      (r.ingredient?.purchase_price || 0) /
                      (Number(r.unit_factor) || 1);
                    const itemHpp = Number(r.qty) * unitPrice;
                    return (
                      <div
                        key={r.id}
                        className="bg-muted/40 rounded-md p-3 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded bg-background border flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {r.ingredient?.name || "—"}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                              HPP: Rp {fmt(itemHpp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              value={r.qty}
                              onChange={async (e) => {
                                const v = Number(e.target.value) || 0;
                                setRecipes((prev) =>
                                  prev.map((x) =>
                                    x.id === r.id ? { ...x, qty: v } : x
                                  )
                                );
                                await supabase
                                  .from("product_recipes")
                                  .update({ qty: v })
                                  .eq("id", r.id);
                              }}
                              className="h-7 w-20 text-xs"
                            />
                          </div>
                          <p className="text-[11px] text-blue-600 mt-1">
                            Unit Pengukuran: ({Number(r.qty)} {r.unit_from} -{" "}
                            {Number(r.qty) * Number(r.unit_factor)}
                            {r.unit_to})
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(r)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Bahan" : "Tambah Bahan Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Untuk Varian</Label>
              <Select
                value={forVariantId ?? "biasa"}
                onValueChange={(v) => setForVariantId(v === "biasa" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.length === 0 && (
                    <SelectItem value="biasa">BIASA</SelectItem>
                  )}
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.variant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pilih dari Inventori *</Label>
              <div className="relative">
                <Input
                  value={ingSearch}
                  placeholder="Ketik untuk mencari item inventori..."
                  onChange={(e) => {
                    setIngSearch(e.target.value);
                    setIngId("");
                    setIngFocused(true);
                  }}
                  onFocus={() => setIngFocused(true)}
                  onBlur={() => setTimeout(() => setIngFocused(false), 150)}
                />
                {ingFocused && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-auto border rounded-md bg-popover shadow-md">
                    {(() => {
                      const q = ingSearch.toLowerCase().trim();
                      const list = ingredients.filter((i) =>
                        !q || i.name.toLowerCase().includes(q)
                      );
                      if (list.length === 0) {
                        return (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Item inventori tidak ditemukan.
                          </div>
                        );
                      }
                      return list.map((i) => (
                        <button
                          type="button"
                          key={i.id}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-b-0",
                            ingId === i.id && "bg-accent"
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIngId(i.id);
                            setIngSearch(i.name);
                            setIngFocused(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{i.name}</span>
                            {i.material_name && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                                {i.material_name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Stok: {i.stock_qty ?? 0} pcs
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Bahan *</Label>
              <Input
                value={ingSearch}
                readOnly
                placeholder="Otomatis terisi dari inventori"
                className="bg-muted/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unit Pengukuran (per pcs) *</Label>
                <Input
                  type="number"
                  value={measureValue}
                  onChange={(e) => setMeasureValue(Number(e.target.value))}
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Select value={satuan} onValueChange={setSatuan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length === 0 ? (
                      <SelectItem value="gram">gram</SelectItem>
                    ) : (
                      units.map((u) => (
                        <SelectItem key={u.id} value={u.name}>
                          {u.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Contoh: {measureValue || 80} = {measureValue || 80}{satuan} per pcs
            </p>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan tambahan..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button className="flex-1" onClick={save}>
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}