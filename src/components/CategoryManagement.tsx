import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags, X, Receipt } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { useStore } from "@/contexts/StoreContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoomCategory {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  tax_enabled: boolean;
  tax_mode: "include" | "exclude";
  created_at: string;
  updated_at: string;
}

interface CategoryManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryChanged?: () => void;
}

export default function CategoryManagement({ isOpen, onClose, onCategoryChanged }: CategoryManagementProps) {
  const { currentStore } = useStore();
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<RoomCategory | null>(null);
  const [roomsUsingCategory, setRoomsUsingCategory] = useState(0);
  const [storeTax, setStoreTax] = useState<{ enabled: boolean; modes: string[]; rate: number }>({
    enabled: false,
    modes: ["include", "exclude"],
    rate: 11,
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    tax_enabled: false,
    tax_mode: "exclude" as "include" | "exclude",
  });

  useEffect(() => {
    if (isOpen && currentStore) {
      fetchCategories();
      fetchStoreTax();
    }
  }, [isOpen, currentStore]);

  const fetchStoreTax = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from("stores")
      .select("tax_enabled, tax_modes_allowed, tax_rate")
      .eq("id", currentStore.id)
      .maybeSingle();
    if (data) {
      setStoreTax({
        enabled: !!(data as any).tax_enabled,
        modes: ((data as any).tax_modes_allowed as string[]) || ["include", "exclude"],
        rate: Number((data as any).tax_rate) || 11,
      });
    }
  };

  const fetchCategories = async () => {
    if (!currentStore) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("room_categories")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Gagal memuat data kategori");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;

    if (!formData.name.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("room_categories")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            tax_enabled: formData.tax_enabled,
            tax_mode: formData.tax_mode,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        await logActivity({
          actionType: "updated",
          entityType: "RoomCategory",
          entityId: editingCategory.id,
          description: `Mengubah kategori kamar: ${formData.name}`,
          storeId: currentStore?.id,
        });

        toast.success("Kategori berhasil diupdate");
      } else {
        const { data: newCategory, error } = await supabase
          .from("room_categories")
          .insert({
            store_id: currentStore.id,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            tax_enabled: formData.tax_enabled,
            tax_mode: formData.tax_mode,
          })
          .select()
          .single();

        if (error) throw error;

        await logActivity({
          actionType: "created",
          entityType: "RoomCategory",
          entityId: newCategory.id,
          description: `Menambahkan kategori kamar baru: ${formData.name}`,
          storeId: currentStore?.id,
        });

        toast.success("Kategori berhasil ditambahkan");
      }

      fetchCategories();
      handleCloseForm();
      onCategoryChanged?.();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Kategori dengan nama ini sudah ada");
      } else {
        toast.error(error.message || "Gagal menyimpan kategori");
      }
      console.error(error);
    }
  };

  const handleEdit = (category: RoomCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      is_active: category.is_active,
      tax_enabled: !!(category as any).tax_enabled,
      tax_mode: ((category as any).tax_mode as "include" | "exclude") || "exclude",
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = async (category: RoomCategory) => {
    if (!currentStore) return;

    // Check how many rooms are using this category
    const { count, error } = await supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("store_id", currentStore.id)
      .eq("category_id", category.id);

    if (error) {
      console.error("Error checking rooms:", error);
      toast.error("Gagal memeriksa penggunaan kategori");
      return;
    }

    setRoomsUsingCategory(count || 0);
    setDeleteCategory(category);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCategory) return;

    try {
      // First, unset category_id on rooms using this category
      if (roomsUsingCategory > 0) {
        const { error: updateError } = await supabase
          .from("rooms")
          .update({ category_id: null, category: "Regular" })
          .eq("category_id", deleteCategory.id);

        if (updateError) throw updateError;
      }

      // Then delete the category
      const { error } = await supabase
        .from("room_categories")
        .delete()
        .eq("id", deleteCategory.id);

      if (error) throw error;

      await logActivity({
        actionType: "deleted",
        entityType: "RoomCategory",
        entityId: deleteCategory.id,
        description: `Menghapus kategori kamar: ${deleteCategory.name}`,
        storeId: currentStore?.id,
      });

      toast.success("Kategori berhasil dihapus");
      fetchCategories();
      onCategoryChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus kategori");
      console.error(error);
    } finally {
      setDeleteCategory(null);
      setRoomsUsingCategory(0);
    }
  };

  const handleToggleActive = async (category: RoomCategory) => {
    try {
      const { error } = await supabase
        .from("room_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;

      await logActivity({
        actionType: "updated",
        entityType: "RoomCategory",
        entityId: category.id,
        description: `${category.is_active ? "Menonaktifkan" : "Mengaktifkan"} kategori: ${category.name}`,
      });

      toast.success(`Kategori ${category.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      fetchCategories();
      onCategoryChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah status kategori");
      console.error(error);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      is_active: true,
      tax_enabled: false,
      tax_mode: "exclude",
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Kelola Kategori Kamar
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsFormOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Kategori
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Memuat data...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada kategori. Klik "Tambah Kategori" untuk membuat kategori baru.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>PPN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.description || "-"}
                      </TableCell>
                      <TableCell>
                        {(category as any).tax_enabled ? (
                          <Badge variant="outline" className="gap-1">
                            <Receipt className="h-3 w-3" />
                            {(category as any).tax_mode === "include" ? "Include" : "Exclude"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={category.is_active ? "default" : "secondary"}
                          className={category.is_active ? "bg-green-500" : ""}
                        >
                          {category.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(category)}
                          >
                            {category.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(category)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Kategori" : "Tambah Kategori"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kategori *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: VIP, Regular, Deluxe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi (Opsional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi kategori..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Status Aktif</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            {storeTax.enabled && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="tax_enabled" className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Aktifkan PPN ({storeTax.rate}%)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      PPN akan dihitung otomatis pada booking dengan kategori kamar ini.
                    </p>
                  </div>
                  <Switch
                    id="tax_enabled"
                    checked={formData.tax_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, tax_enabled: checked })
                    }
                  />
                </div>
                {formData.tax_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="tax_mode">Mode PPN</Label>
                    <Select
                      value={formData.tax_mode}
                      onValueChange={(v) =>
                        setFormData({ ...formData, tax_mode: v as "include" | "exclude" })
                      }
                    >
                      <SelectTrigger id="tax_mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {storeTax.modes.includes("include") && (
                          <SelectItem value="include">
                            Include — harga sudah termasuk PPN
                          </SelectItem>
                        )}
                        {storeTax.modes.includes("exclude") && (
                          <SelectItem value="exclude">
                            Exclude — PPN ditambahkan ke harga
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Batal
              </Button>
              <Button type="submit">
                {editingCategory ? "Simpan Perubahan" : "Tambah Kategori"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCategory} onOpenChange={(open) => !open && setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              {roomsUsingCategory > 0 ? (
                <>
                  Kategori "<strong>{deleteCategory?.name}</strong>" masih digunakan oleh{" "}
                  <strong>{roomsUsingCategory} kamar</strong>. Kamar-kamar tersebut akan dikembalikan ke 
                  kategori "Regular" jika Anda melanjutkan penghapusan.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus kategori "<strong>{deleteCategory?.name}</strong>"?
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
