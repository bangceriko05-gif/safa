import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Star, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import ProductCategoryManager from "./ProductCategoryManager";
import ProductVariantsTab from "./ProductVariantsTab";
import ProductPriceTiersTab from "./ProductPriceTiersTab";

export interface EditorProduct {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  brand_id: string | null;
  purchase_price: number;
  price: number;
  track_inventory: boolean;
  stock_qty: number;
  min_stock: number;
  is_active: boolean;
  tax_enabled: boolean;
  show_on_website: boolean;
  images: string[];
  description?: string;
}

interface Props {
  productId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const empty: EditorProduct = {
  name: "",
  sku: "",
  barcode: "",
  category_id: null,
  brand_id: null,
  purchase_price: 0,
  price: 0,
  track_inventory: true,
  stock_qty: 0,
  min_stock: 0,
  is_active: true,
  tax_enabled: false,
  show_on_website: false,
  images: [],
  description: "",
};

export default function ProductEditorModal({ productId, onClose, onSaved }: Props) {
  const { currentStore } = useStore();
  const [tab, setTab] = useState("edit");
  const [data, setData] = useState<EditorProduct>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(productId);

  const loadProduct = async () => {
    if (!productId) {
      setData(empty);
      setSavedId(null);
      return;
    }
    setLoading(true);
    const { data: p } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    if (p) {
      setData({
        id: p.id,
        name: p.name ?? "",
        sku: (p as any).sku ?? "",
        barcode: (p as any).barcode ?? "",
        category_id: (p as any).category_id ?? null,
        brand_id: (p as any).brand_id ?? null,
        purchase_price: Number((p as any).purchase_price ?? 0),
        price: Number(p.price ?? 0),
        track_inventory: (p as any).track_inventory ?? true,
        stock_qty: Number(p.stock_qty ?? 0),
        min_stock: Number((p as any).min_stock ?? 0),
        is_active: (p as any).is_active ?? true,
        tax_enabled: (p as any).tax_enabled ?? false,
        show_on_website: (p as any).show_on_website ?? false,
        images: Array.isArray((p as any).images) ? (p as any).images : [],
        description: (p as any).description ?? "",
      });
      setSavedId(p.id);
    }
    setLoading(false);
  };

  const loadOptions = async () => {
    if (!currentStore) return;
    const [{ data: cats }, { data: brs }] = await Promise.all([
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .order("name"),
      supabase
        .from("product_brands")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .order("name"),
    ]);
    setCategories(cats || []);
    setBrands(brs || []);
  };

  useEffect(() => {
    setTab("edit");
    setSavedId(productId);
    loadProduct();
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, currentStore?.id]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentStore) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} terlalu besar (max 5MB)`);
          continue;
        }
        const ext = file.name.split(".").pop();
        const path = `${currentStore.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }
      setData((prev) => ({ ...prev, images: [...prev.images, ...newUrls] }));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const setMain = (idx: number) => {
    setData((prev) => {
      const arr = [...prev.images];
      const [m] = arr.splice(idx, 1);
      return { ...prev, images: [m, ...arr] };
    });
  };

  const handleSave = async () => {
    if (!currentStore) {
      toast.error("Pilih cabang terlebih dahulu");
      return;
    }
    if (!data.name.trim()) {
      toast.error("Nama produk wajib diisi");
      return;
    }
    if (!data.purchase_price || data.purchase_price <= 0) {
      toast.error("Harga beli wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Belum login");

      const payload: any = {
        name: data.name.trim(),
        sku: data.sku.trim() || null,
        barcode: data.barcode.trim() || null,
        category_id: data.category_id,
        brand_id: data.brand_id,
        purchase_price: Number(data.purchase_price) || 0,
        price: Number(data.price) || 0,
        track_inventory: data.track_inventory,
        stock_qty: Number(data.stock_qty) || 0,
        min_stock: Number(data.min_stock) || 0,
        is_active: data.is_active,
        tax_enabled: data.tax_enabled,
        show_on_website: data.show_on_website,
        images: data.images,
        description: data.description?.trim() || null,
      };

      let id = savedId;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        await logActivity({
          actionType: "updated",
          entityType: "Produk",
          entityId: id,
          description: `Mengubah produk ${payload.name}`,
          storeId: currentStore.id,
        });
        toast.success("Produk berhasil diperbarui");
      } else {
        const { data: created, error } = await supabase
          .from("products")
          .insert([{ ...payload, store_id: currentStore.id, created_by: user.id }])
          .select()
          .single();
        if (error) throw error;
        id = created.id;
        setSavedId(id);
        setData((prev) => ({ ...prev, id }));
        await logActivity({
          actionType: "created",
          entityType: "Produk",
          entityId: id!,
          description: `Menambahkan produk ${payload.name}`,
          storeId: currentStore.id,
        });
        toast.success("Produk berhasil ditambahkan");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!savedId) return;
    if (!confirm(`Hapus produk "${data.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", savedId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      actionType: "deleted",
      entityType: "Produk",
      entityId: savedId,
      description: `Menghapus produk ${data.name}`,
      storeId: currentStore?.id,
    });
    toast.success("Produk dihapus");
    onSaved();
    onClose();
  };

  return (
    <div className="w-full">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">
            {savedId ? `Edit Produk: ${data.name || "-"}` : "Tambah Produk Baru"}
          </h2>
        </div>
      </div>

      <div className="px-6 py-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-5 bg-muted">
              <TabsTrigger value="edit">Edit Produk</TabsTrigger>
              <TabsTrigger value="variants">Varian</TabsTrigger>
              <TabsTrigger value="tiers">Tingkatan Harga</TabsTrigger>
              <TabsTrigger value="categories">Kategori</TabsTrigger>
              <TabsTrigger value="brands">Brand</TabsTrigger>
            </TabsList>

            {/* EDIT */}
            <TabsContent value="edit" className="mt-6 space-y-6">
              {/* Images */}
              <div className="space-y-2">
                <Label>Gambar Produk (Katalog)</Label>
                <div className="flex flex-wrap gap-3">
                  {data.images.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-32 h-32 rounded-md border overflow-hidden bg-muted group"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Star className="h-3 w-3" /> Utama
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        {idx !== 0 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={() => setMain(idx)}
                            className="h-7 w-7"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          onClick={() => removeImage(idx)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <label className="w-32 h-32 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/50">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mb-1" />
                        Upload Gambar
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: JPG, PNG, WebP. Max 5MB per gambar.
                </p>
              </div>

              {/* Basic info */}
              <div className="space-y-2">
                <Label>
                  Nama Produk <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="Nama produk"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={data.sku}
                    onChange={(e) => setData({ ...data, sku: e.target.value })}
                    placeholder="SKU"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input
                    value={data.barcode}
                    onChange={(e) => setData({ ...data, barcode: e.target.value })}
                    placeholder="8991234567890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={data.category_id ?? "none"}
                    onValueChange={(v) =>
                      setData({ ...data, category_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tidak ada —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select
                    value={data.brand_id ?? "none"}
                    onValueChange={(v) =>
                      setData({ ...data, brand_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tidak ada —</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Harga Beli <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={data.purchase_price}
                    onChange={(e) =>
                      setData({ ...data, purchase_price: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Harga Jual</Label>
                  <Input
                    type="number"
                    value={data.price}
                    onChange={(e) => setData({ ...data, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Inventory toggle */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium text-sm">Aktifkan Inventori Stok</p>
                  <p className="text-xs text-muted-foreground">
                    Lacak stok produk ini secara otomatis.
                  </p>
                </div>
                <Switch
                  checked={data.track_inventory}
                  onCheckedChange={(v) => setData({ ...data, track_inventory: v })}
                />
              </div>

              {data.track_inventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stok</Label>
                    <Input
                      type="number"
                      value={data.stock_qty}
                      onChange={(e) =>
                        setData({ ...data, stock_qty: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimal Stok</Label>
                    <Input
                      type="number"
                      value={data.min_stock}
                      onChange={(e) =>
                        setData({ ...data, min_stock: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={data.description ?? ""}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                  placeholder="Deskripsi produk (opsional)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium text-sm">Produk Aktif</p>
                    <p className="text-xs text-muted-foreground">Tampil di POS / penjualan.</p>
                  </div>
                  <Switch
                    checked={data.is_active}
                    onCheckedChange={(v) => setData({ ...data, is_active: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium text-sm">Aktifkan di Website</p>
                    <p className="text-xs text-muted-foreground">
                      Tampilkan di katalog publik.
                    </p>
                  </div>
                  <Switch
                    checked={data.show_on_website}
                    onCheckedChange={(v) => setData({ ...data, show_on_website: v })}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2 pt-4 border-t">
                <div>
                  {savedId && (
                    <Button variant="destructive" onClick={handleDelete}>
                      <Trash2 className="mr-2 h-4 w-4" /> Hapus Produk
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={onClose}>
                    Batal
                  </Button>
                  <Button onClick={handleSave} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="mt-6">
              <ProductVariantsTab productId={savedId} />
            </TabsContent>

            <TabsContent value="tiers" className="mt-6">
              <ProductPriceTiersTab productId={savedId} />
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <ProductCategoryManager
                table="product_categories"
                searchPlaceholder="Cari kategori..."
                onChanged={loadOptions}
              />
            </TabsContent>

            <TabsContent value="brands" className="mt-6">
              <ProductCategoryManager
                table="product_brands"
                searchPlaceholder="Cari brand..."
                onChanged={loadOptions}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}