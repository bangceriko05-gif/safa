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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, ImageIcon, X, Loader2, Building2, Users, DoorOpen, Package } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";

interface Store {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface StoreStats {
  rooms: number;
  products: number;
  users: number;
}

export default function SuperAdminStoreManagement() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeStats, setStoreStats] = useState<Record<string, StoreStats>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    is_active: true,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) throw error;
      setStores((data as Store[]) || []);

      // Fetch stats for each store
      if (data) {
        const stats: Record<string, StoreStats> = {};
        for (const store of data) {
          const [roomsRes, productsRes, usersRes] = await Promise.all([
            supabase.from("rooms").select("id", { count: "exact" }).eq("store_id", store.id),
            supabase.from("products").select("id", { count: "exact" }).eq("store_id", store.id),
            supabase.from("user_store_access").select("id", { count: "exact" }).eq("store_id", store.id),
          ]);
          stats[store.id] = {
            rooms: roomsRes.count || 0,
            products: productsRes.count || 0,
            users: usersRes.count || 0,
          };
        }
        setStoreStats(stats);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Gagal memuat data outlet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("store-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("store-images")
        .getPublicUrl(fileName);

      setFormData({ ...formData, image_url: publicUrl });
      setPreviewUrl(publicUrl);
      toast.success("Foto berhasil diupload");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Gagal mengupload foto");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (formData.image_url) {
      const url = formData.image_url;
      const fileName = url.split("/").pop();
      
      if (fileName) {
        try {
          await supabase.storage.from("store-images").remove([fileName]);
        } catch (error) {
          console.error("Error removing old image:", error);
        }
      }
    }
    
    setFormData({ ...formData, image_url: "" });
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const storeData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        location: formData.location.trim() || null,
        image_url: formData.image_url || null,
        is_active: formData.is_active,
        slug: formData.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      };

      if (editingStore) {
        const { error } = await supabase
          .from("stores")
          .update(storeData)
          .eq("id", editingStore.id);

        if (error) throw error;
        
        await logActivity({
          actionType: 'updated',
          entityType: 'Outlet',
          entityId: editingStore.id,
          description: `[Super Admin] Mengubah data outlet ${storeData.name}`,
        });
        
        toast.success("Outlet berhasil diupdate");
      } else {
        const { data: newStore, error } = await supabase
          .from("stores")
          .insert([storeData])
          .select()
          .single();

        if (error) throw error;
        
        await logActivity({
          actionType: 'created',
          entityType: 'Outlet',
          entityId: newStore.id,
          description: `[Super Admin] Menambahkan outlet baru: ${storeData.name}`,
        });
        
        toast.success("Outlet berhasil ditambahkan");
      }

      fetchStores();
      handleCloseDialog();
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error(error);
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      description: store.description || "",
      location: store.location || "",
      image_url: store.image_url || "",
      is_active: store.is_active,
    });
    setPreviewUrl(store.image_url || null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`Yakin ingin menghapus outlet "${store.name}"?\n\nSemua data terkait (kamar, produk, booking, dll) akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      if (store.image_url) {
        const fileName = store.image_url.split("/").pop();
        if (fileName) {
          await supabase.storage.from("store-images").remove([fileName]);
        }
      }

      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", store.id);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'Outlet',
        entityId: store.id,
        description: `[Super Admin] Menghapus outlet ${store.name}`,
      });

      toast.success("Outlet berhasil dihapus");
      fetchStores();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus outlet");
      console.error(error);
    }
  };

  const handleToggleActive = async (store: Store) => {
    const newStatus = !store.is_active;
    const actionText = newStatus ? 'mengaktifkan' : 'menonaktifkan (jatuh tempo pembayaran)';
    
    if (!newStatus) {
      // Confirm before deactivating
      if (!confirm(`Yakin ingin menonaktifkan outlet "${store.name}"?\n\nSemua pengguna tidak akan dapat mengakses PMS di outlet ini dan akan melihat pesan jatuh tempo pembayaran.`)) {
        return;
      }
    }
    
    try {
      const { error } = await supabase
        .from("stores")
        .update({ is_active: newStatus })
        .eq("id", store.id);

      if (error) throw error;

      await logActivity({
        actionType: 'updated',
        entityType: 'Outlet',
        entityId: store.id,
        description: `[Super Admin] ${newStatus ? 'Mengaktifkan' : 'Menonaktifkan (jatuh tempo)'} outlet ${store.name}`,
      });

      toast.success(`Outlet berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchStores();
    } catch (error: any) {
      console.error("Error toggling store status:", error);
      toast.error(error.message || "Gagal mengubah status outlet");
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStore(null);
    setPreviewUrl(null);
    setFormData({
      name: "",
      description: "",
      location: "",
      image_url: "",
      is_active: true,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Kelola Semua Outlet
            </CardTitle>
            <CardDescription>
              Tambah, edit, dan kelola semua outlet dalam sistem
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Outlet
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Foto</TableHead>
                <TableHead>Nama Outlet</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead className="text-center">Kamar</TableHead>
                <TableHead className="text-center">Produk</TableHead>
                <TableHead className="text-center">User</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Belum ada outlet. Klik tombol "Tambah Outlet" untuk menambahkan.
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      {store.image_url ? (
                        <img
                          src={store.image_url}
                          alt={store.name}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{store.name}</p>
                        {store.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {store.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{store.location || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        <span>{storeStats[store.id]?.rooms || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{storeStats[store.id]?.products || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{storeStats[store.id]?.users || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={store.is_active}
                        onCheckedChange={() => handleToggleActive(store)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(store)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(store)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Add/Edit Store Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStore ? "Edit Outlet" : "Tambah Outlet Baru"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Foto Outlet</Label>
              {previewUrl ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploading ? (
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Klik untuk upload foto
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG (maks. 2MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Outlet *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Treebox Malang"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi singkat outlet..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Contoh: Malang"
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

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={uploading}>
                {editingStore ? "Update" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
