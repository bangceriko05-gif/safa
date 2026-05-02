import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Search,
  MoreVertical,
  ChevronDown,
  Pencil,
  Trash2,
  ImageIcon,
  FileText,
  Eye,
  Package,
  CheckCircle2,
} from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { useStore } from "@/contexts/StoreContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductEditorModal from "./products/ProductEditorModal";

interface Product {
  id: string;
  name: string;
  price: number;
  purchase_price: number;
  sku: string | null;
  barcode: string | null;
  stock_qty: number;
  track_inventory: boolean;
  show_on_website: boolean;
  is_available_offline?: boolean;
  category_id: string | null;
  brand_id: string | null;
  collection_id: string | null;
  images: any;
  store_id?: string | null;
}

interface Variant {
  id: string;
  product_id: string;
  variant_name: string;
}

interface RefItem {
  id: string;
  name: string;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

export default function ProductManagement() {
  const { currentStore, userStores } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [recipes, setRecipes] = useState<{ product_id: string }[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [brands, setBrands] = useState<RefItem[]>([]);
  const [collections, setCollections] = useState<RefItem[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProductId, setEditorProductId] = useState<string | null>(null);
  const [editorCopyMode, setEditorCopyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [filterCollection, setFilterCollection] = useState<string | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [targetStoreId, setTargetStoreId] = useState<string>("");

  // dialogs
  const [availabilityProduct, setAvailabilityProduct] = useState<Product | null>(null);
  const [availOnline, setAvailOnline] = useState(false);
  const [availOfflineHidden, setAvailOfflineHidden] = useState(false);
  const [stockDetailProduct, setStockDetailProduct] = useState<Product | null>(null);
  const [stockDetailRows, setStockDetailRows] = useState<any[]>([]);
  const [stockDetailLoading, setStockDetailLoading] = useState(false);
  const [stockDetailPage, setStockDetailPage] = useState(1);
  const [stockOnlyEmpty, setStockOnlyEmpty] = useState(false);
  const [logProduct, setLogProduct] = useState<Product | null>(null);
  const [logRows, setLogRows] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    if (currentStore) fetchAll();
  }, [currentStore]);

  const fetchAll = async () => {
    if (!currentStore) return;
    try {
      const [pRes, vRes, rRes, cRes, bRes, kRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,price,purchase_price,sku,barcode,stock_qty,track_inventory,show_on_website,is_available_offline,category_id,brand_id,collection_id,images,store_id"
          )
          .eq("store_id", currentStore.id)
          .order("name"),
        supabase.from("product_variants").select("id, product_id, variant_name"),
        supabase.from("product_recipes" as any).select("product_id"),
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
        supabase
          .from("product_collections" as any)
          .select("id, name")
          .eq("store_id", currentStore.id)
          .order("name"),
      ]);
      if (pRes.error) throw pRes.error;
      setProducts((pRes.data as any) || []);
      setVariants((vRes.data as any) || []);
      setRecipes((rRes.data as any) || []);
      setCategories((cRes.data as any) || []);
      setBrands((bRes.data as any) || []);
      setCollections((kRes.data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat data produk");
    }
  };

  const openCreate = () => {
    setEditorProductId(null);
    setEditorCopyMode(false);
    setEditorOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditorProductId(product.id);
    setEditorCopyMode(false);
    setEditorOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Yakin ingin menghapus produk "${product.name}"?`)) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      await logActivity({
        actionType: "deleted",
        entityType: "Produk",
        entityId: product.id,
        description: `Menghapus produk ${product.name}`,
        storeId: currentStore?.id,
      });
      toast.success("Produk berhasil dihapus");
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus produk");
    }
  };

  // "Salin" – open editor in copy mode (creates new product)
  const handleCopySingle = (product: Product) => {
    setEditorProductId(product.id);
    setEditorCopyMode(true);
    setEditorOpen(true);
  };

  // "Ubah ketersediaan"
  const handleOpenAvailability = (product: Product) => {
    setAvailabilityProduct(product);
    setAvailOnline(!!product.show_on_website);
    setAvailOfflineHidden(product.is_available_offline === false);
  };

  const handleSaveAvailability = async () => {
    if (!availabilityProduct) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({
          show_on_website: availOnline,
          is_available_offline: !availOfflineHidden,
        } as any)
        .eq("id", availabilityProduct.id);
      if (error) throw error;
      await logActivity({
        actionType: "updated",
        entityType: "Produk",
        entityId: availabilityProduct.id,
        description: `Mengubah ketersediaan produk ${availabilityProduct.name} (Online: ${availOnline ? "Ya" : "Tidak"}, Offline POS: ${!availOfflineHidden ? "Ya" : "Tidak"})`,
        storeId: currentStore?.id,
      });
      toast.success("Ketersediaan disimpan");
      setAvailabilityProduct(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    }
  };

  // "Detail Stok"
  const handleOpenStockDetail = async (product: Product) => {
    setStockDetailProduct(product);
    setStockDetailRows([]);
    setStockDetailLoading(true);
    setStockDetailPage(1);
    setStockOnlyEmpty(false);
    try {
      const { data, error } = await supabase
        .from("stock_in_items")
        .select("id, quantity, unit_price, stock_in:stock_in_id(id, bid, date, status, supplier_name)")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setStockDetailRows((data as any) || []);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat stok");
    } finally {
      setStockDetailLoading(false);
    }
  };

  // "Log"
  const handleOpenLog = async (product: Product) => {
    setLogProduct(product);
    setLogRows([]);
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, created_at, user_name, description, action_type")
        .eq("entity_id", product.id)
        .eq("entity_type", "Produk")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogRows((data as any) || []);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat log");
    } finally {
      setLogLoading(false);
    }
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditorProductId(null);
    setEditorCopyMode(false);
    fetchAll();
  };

  const handleToggleProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleToggleAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleCopyProducts = async () => {
    if (!targetStoreId) {
      toast.error("Pilih cabang tujuan");
      return;
    }
    if (targetStoreId === currentStore?.id) {
      toast.error("Tidak bisa menyalin ke cabang yang sama");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const toCopy = products.filter((p) => selectedProducts.has(p.id));
      const targetStore = userStores.find((s) => s.id === targetStoreId);
      const payload = toCopy.map((p) => ({
        name: p.name,
        price: p.price,
        created_by: user.id,
        store_id: targetStoreId,
      }));
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      await logActivity({
        actionType: "created",
        entityType: "Produk",
        description: `Menyalin ${toCopy.length} produk dari ${currentStore?.name} ke ${targetStore?.name}`,
      });
      toast.success(`${toCopy.length} produk berhasil disalin`);
      setIsCopyDialogOpen(false);
      setSelectedProducts(new Set());
      setTargetStoreId("");
    } catch (error: any) {
      toast.error(error.message || "Gagal menyalin produk");
    }
  };

  const availableStores = userStores.filter((s) => s.id !== currentStore?.id);

  const filteredProducts = products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hit =
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (filterBrand && p.brand_id !== filterBrand) return false;
    if (filterCollection && p.collection_id !== filterCollection) return false;
    return true;
  });

  const variantsByProduct = (productId: string) =>
    variants.filter((v) => v.product_id === productId);

  const hasRecipe = (productId: string) =>
    recipes.some((r) => r.product_id === productId);

  if (editorOpen) {
    return (
      <ProductEditorModal
        productId={editorProductId}
        onClose={handleCloseEditor}
        onSaved={fetchAll}
      />
    );
  }

  const FilterChip = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string | null;
    onChange: (v: string | null) => void;
    options: RefItem[];
  }) => {
    const selected = options.find((o) => o.id === value);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 rounded-md font-normal bg-background"
          >
            {selected ? selected.name : label}
            <ChevronDown className="ml-2 h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
          <DropdownMenuItem onClick={() => onChange(null)}>
            Semua {label}
          </DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem key={o.id} onClick={() => onChange(o.id)}>
              {o.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getImage = (images: any) => {
    if (Array.isArray(images) && images.length > 0) return images[0] as string;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedProducts.size > 0 && availableStores.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCopyDialogOpen(true)}
            title={`Salin ke cabang lain (${selectedProducts.size})`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}

        <FilterChip
          label="Kategori"
          value={filterCategory}
          onChange={setFilterCategory}
          options={categories}
        />
        <FilterChip
          label="Brand"
          value={filterBrand}
          onChange={setFilterBrand}
          options={brands}
        />
        <FilterChip
          label="Koleksi"
          value={filterCollection}
          onChange={setFilterCollection}
          options={collections}
        />

        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Produk / SKU / Barcode"
            className="pl-9 h-10"
          />
        </div>

        <Button
          onClick={openCreate}
          className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filteredProducts.length > 0 &&
                    selectedProducts.size === filteredProducts.length
                  }
                  onCheckedChange={handleToggleAll}
                />
              </TableHead>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Qty Stok</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead>Harga Beli</TableHead>
              <TableHead>Harga Jual di Toko</TableHead>
              <TableHead>Harga Jual Online</TableHead>
              <TableHead>Tersedia Online</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-center text-muted-foreground py-12"
                >
                  {searchQuery ||
                  filterCategory ||
                  filterBrand ||
                  filterCollection
                    ? "Tidak ada produk yang cocok"
                    : 'Belum ada produk. Klik tombol "Tambah" untuk menambahkan.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const img = getImage(product.images);
                const productVariants = variantsByProduct(product.id);
                const recipe = hasRecipe(product.id);
                return (
                  <TableRow key={product.id} className="align-top">
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-primary font-semibold hover:underline text-left"
                      >
                        {product.name}
                      </button>
                      <div className="text-xs text-muted-foreground mt-1">
                        {product.name}
                      </div>
                      {currentStore?.name && (
                        <div className="text-xs text-muted-foreground">
                          {currentStore.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {recipe ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs border rounded bg-muted/40">
                          Resep
                        </span>
                      ) : productVariants.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {productVariants.length} varian
                        </span>
                      ) : (
                        ""
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{product.sku || ""}</TableCell>
                    <TableCell className="text-sm">
                      {product.barcode || ""}
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.track_inventory ? (
                        product.stock_qty
                      ) : (
                        <span className="text-muted-foreground">
                          Tidak terbatas
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">pcs</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatRp(product.purchase_price)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <span className="border-b border-dotted">
                        {formatRp(product.price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <span className="border-b border-dotted">
                        {formatRp(product.show_on_website ? product.price : 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.show_on_website ? "Ya" : "Tidak"}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-48 p-1">
                          <button
                            onClick={() => handleCopySingle(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <Copy className="h-4 w-4" /> Salin
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <Eye className="h-4 w-4" /> Detail
                          </button>
                          <button
                            onClick={() => handleShowStockDetail(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <Package className="h-4 w-4" /> Detail Stok
                          </button>
                          <button
                            onClick={() => handleToggleAvailability(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Ubah ketersediaan
                          </button>
                          <button
                            onClick={() => handleShowLog(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <FileText className="h-4 w-4" /> Log
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted text-destructive text-left"
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Copy dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salin Produk ke Cabang Lain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produk yang akan disalin ({selectedProducts.size})</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto bg-muted/30">
                {products
                  .filter((p) => selectedProducts.has(p.id))
                  .map((product) => (
                    <div key={product.id} className="text-sm py-1">
                      • {product.name} - Rp {product.price.toLocaleString("id-ID")}
                    </div>
                  ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cabang Tujuan</Label>
              <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih cabang tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCopyDialogOpen(false);
                  setTargetStoreId("");
                }}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={handleCopyProducts}
                className="flex-1"
                disabled={!targetStoreId}
              >
                <Copy className="mr-2 h-4 w-4" />
                Salin Produk
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
