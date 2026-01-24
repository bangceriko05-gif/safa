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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Copy } from "lucide-react";
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

interface Product {
  id: string;
  name: string;
  price: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function ProductManagement() {
  const { currentStore, userRole, userStores } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductSectionExpanded, setIsProductSectionExpanded] = useState(true);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [targetStoreId, setTargetStoreId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    price: "",
  });

  useEffect(() => {
    if (currentStore) {
      fetchProducts();
    }
  }, [currentStore]);

  const fetchProducts = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Gagal memuat data produk");
    }
  };

  const formatPrice = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return parseInt(numericValue).toLocaleString('id-ID');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPrice(e.target.value);
    setFormData({ ...formData, price: formattedValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Anda harus login terlebih dahulu");
        return;
      }

      if (!currentStore) {
        toast.error("Pilih cabang terlebih dahulu");
        return;
      }

      const productData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price.replace(/\./g, '')),
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        
        await logActivity({
          actionType: 'updated',
          entityType: 'Produk',
          entityId: editingProduct.id,
          description: `Mengubah produk ${productData.name} dengan harga Rp ${productData.price.toLocaleString('id-ID')}`,
          storeId: currentStore?.id,
        });
        
        toast.success("Produk berhasil diupdate");
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([{ ...productData, created_by: user.id, store_id: currentStore.id }])
          .select()
          .single();

        if (error) throw error;
        
        await logActivity({
          actionType: 'created',
          entityType: 'Produk',
          entityId: newProduct.id,
          description: `Menambahkan produk baru: ${productData.name} dengan harga Rp ${productData.price.toLocaleString('id-ID')}`,
          storeId: currentStore?.id,
        });
        
        toast.success("Produk berhasil ditambahkan");
      }

      fetchProducts();
      handleCloseDialog();
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error(error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toLocaleString('id-ID'),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Yakin ingin menghapus produk "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'Produk',
        entityId: product.id,
        description: `Menghapus produk ${product.name}`,
        storeId: currentStore?.id,
      });

      toast.success("Produk berhasil dihapus");
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus produk");
      console.error(error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      price: "",
    });
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleOpenCopyDialog = () => {
    if (selectedProducts.size === 0) {
      toast.error("Pilih minimal 1 produk untuk disalin");
      return;
    }
    setIsCopyDialogOpen(true);
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
      if (!user) {
        toast.error("Anda harus login terlebih dahulu");
        return;
      }

      const productsToCopy = products.filter(p => selectedProducts.has(p.id));
      const targetStore = userStores.find(s => s.id === targetStoreId);

      const productsData = productsToCopy.map(product => ({
        name: product.name,
        price: product.price,
        created_by: user.id,
        store_id: targetStoreId,
      }));

      const { error } = await supabase
        .from("products")
        .insert(productsData);

      if (error) throw error;

      await logActivity({
        actionType: 'created',
        entityType: 'Produk',
        description: `Menyalin ${productsToCopy.length} produk dari ${currentStore?.name} ke ${targetStore?.name}`,
      });

      toast.success(`${productsToCopy.length} produk berhasil disalin ke ${targetStore?.name}`);
      setIsCopyDialogOpen(false);
      setSelectedProducts(new Set());
      setTargetStoreId("");
    } catch (error: any) {
      toast.error(error.message || "Gagal menyalin produk");
      console.error(error);
    }
  };

  const availableStores = userStores.filter(s => s.id !== currentStore?.id);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsProductSectionExpanded(!isProductSectionExpanded)}
              className="p-1"
            >
              {isProductSectionExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
            <CardTitle>Kelola Produk</CardTitle>
          </div>
          <div className="flex gap-2">
            {selectedProducts.size > 0 && availableStores.length > 0 && (
              <Button variant="outline" onClick={handleOpenCopyDialog}>
                <Copy className="mr-2 h-4 w-4" />
                Salin ke Cabang Lain ({selectedProducts.size})
              </Button>
            )}
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
            </Button>
          </div>
        </div>
      </CardHeader>
      {isProductSectionExpanded && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {availableStores.length > 0 && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onCheckedChange={handleToggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>Nama Produk</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={availableStores.length > 0 ? 4 : 3} className="text-center text-muted-foreground">
                    Belum ada produk. Klik tombol "Tambah Produk" untuk menambahkan.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    {availableStores.length > 0 && (
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => handleToggleProduct(product.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>Rp {product.price.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {(userRole === "admin" || userRole === "leader") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Produk</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Kopi Latte"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Harga Jual</Label>
              <Input
                id="price"
                type="text"
                value={formData.price}
                onChange={handlePriceChange}
                placeholder="25000"
                required
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                Batal
              </Button>
              <Button type="submit" className="flex-1">
                {editingProduct ? "Update" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Copy Products Dialog */}
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
                  .filter(p => selectedProducts.has(p.id))
                  .map(product => (
                    <div key={product.id} className="text-sm py-1">
                      • {product.name} - Rp {product.price.toLocaleString('id-ID')}
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
                  {availableStores.map(store => (
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
    </Card>
  );
}