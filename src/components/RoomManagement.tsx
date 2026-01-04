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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, AlertTriangle, ChevronDown, ChevronUp, Trash2, Tags } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import ProductManagement from "./ProductManagement";
import CategoryManagement from "./CategoryManagement";
import { useStore } from "@/contexts/StoreContext";

interface Room {
  id: string;
  name: string;
  status: string;
  category: string;
  category_id: string | null;
  created_at: string;
  room_categories?: {
    id: string;
    name: string;
  } | null;
}

interface RoomVariant {
  id: string;
  room_id: string;
  variant_name: string;
  duration: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

interface RoomCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export default function RoomManagement() {
  const { currentStore, userRole } = useStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomVariants, setRoomVariants] = useState<Record<string, RoomVariant[]>>({});
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingVariant, setEditingVariant] = useState<RoomVariant | null>(null);
  const [selectedRoomForVariant, setSelectedRoomForVariant] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [isRoomSectionExpanded, setIsRoomSectionExpanded] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    status: "Aktif",
    category_id: "",
  });
  const [variantFormData, setVariantFormData] = useState({
    variant_name: "",
    price: "",
    description: "",
    is_active: "true",
  });
  const [displaySize, setDisplaySize] = useState<string>(() => {
    return localStorage.getItem("schedule-display-size") || "normal";
  });

  useEffect(() => {
    if (currentStore) {
      fetchRooms();
      fetchCategories();
      fetchAllVariantCounts();
    }
  }, [currentStore]);

  useEffect(() => {
    rooms.forEach(room => {
      if (expandedRooms.has(room.id)) {
        fetchRoomVariants(room.id);
      }
    });
  }, [expandedRooms, rooms]);

  const fetchAllVariantCounts = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("room_variants")
        .select("room_id")
        .eq("store_id", currentStore.id)
        .eq("is_active", true);

      if (error) throw error;
      
      // Count variants per room
      const counts: Record<string, number> = {};
      (data || []).forEach((v) => {
        counts[v.room_id] = (counts[v.room_id] || 0) + 1;
      });
      setVariantCounts(counts);
    } catch (error) {
      console.error("Error fetching variant counts:", error);
    }
  };

  const fetchCategories = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("room_categories")
        .select("id, name, is_active")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("rooms")
        .select("*, room_categories(id, name)")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Gagal memuat data ruangan");
    }
  };

  const fetchRoomVariants = async (roomId: string) => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("room_variants")
        .select("*")
        .eq("room_id", roomId)
        .eq("store_id", currentStore.id)
        .order("variant_name");

      if (error) throw error;
      setRoomVariants(prev => ({ ...prev, [roomId]: data || [] }));
    } catch (error) {
      console.error("Error fetching room variants:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!currentStore) {
        toast.error("Pilih cabang terlebih dahulu");
        return;
      }

      if (editingRoom) {
        const { error } = await supabase
          .from("rooms")
          .update(formData)
          .eq("id", editingRoom.id);

        if (error) throw error;
        
        // Log activity
        await logActivity({
          actionType: 'updated',
          entityType: 'Kamar',
          entityId: editingRoom.id,
          description: `Mengubah data kamar ${formData.name} (status: ${formData.status})`,
        });
        
        toast.success("Ruangan berhasil diupdate");
      } else {
        const { data: newRoom, error } = await supabase
          .from("rooms")
          .insert([{ ...formData, store_id: currentStore.id }])
          .select()
          .single();

        if (error) throw error;
        
        // Log activity
        await logActivity({
          actionType: 'created',
          entityType: 'Kamar',
          entityId: newRoom.id,
          description: `Menambahkan kamar baru: ${formData.name}`,
        });
        
        toast.success("Ruangan berhasil ditambahkan");
      }

      fetchRooms();
      handleCloseDialog();
      
      // Trigger refresh for other components
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error(error);
    }
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      status: room.status,
      category_id: room.category_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRoom = async (room: Room) => {
    if (!confirm(`Yakin ingin menghapus kamar "${room.name}"? Semua varian kamar ini juga akan terhapus.`)) return;

    try {
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", room.id);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'Kamar',
        entityId: room.id,
        description: `Menghapus kamar ${room.name}`,
      });

      toast.success("Kamar berhasil dihapus");
      fetchRooms();
      
      // Trigger refresh for other components
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus kamar");
      console.error(error);
    }
  };

  const handleAddVariant = (roomId: string) => {
    setSelectedRoomForVariant(roomId);
    setEditingVariant(null);
    setVariantFormData({
      variant_name: "",
      price: "",
      description: "",
      is_active: "true",
    });
    setIsVariantDialogOpen(true);
  };

  const handleEditVariant = (variant: RoomVariant) => {
    setSelectedRoomForVariant(variant.room_id);
    setEditingVariant(variant);
    setVariantFormData({
      variant_name: variant.variant_name,
      price: variant.price.toLocaleString('id-ID'),
      description: variant.description || "",
      is_active: variant.is_active ? "true" : "false",
    });
    setIsVariantDialogOpen(true);
  };

  const handleDeleteVariant = async (variantId: string, roomId: string) => {
    if (!confirm("Yakin ingin menghapus varian ini?")) return;

    try {
      const { error } = await supabase
        .from("room_variants")
        .delete()
        .eq("id", variantId);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'RoomVariant',
        entityId: variantId,
        description: `Menghapus varian kamar`,
      });

      toast.success("Varian berhasil dihapus");
      fetchRoomVariants(roomId);
      fetchAllVariantCounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus varian");
      console.error(error);
    }
  };

  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoomForVariant) return;

    if (!currentStore) {
      toast.error("Pilih cabang terlebih dahulu");
      return;
    }

    const variantData = {
      room_id: selectedRoomForVariant,
      variant_name: variantFormData.variant_name.trim(),
      duration: 1, // Default duration
      price: parseFloat(variantFormData.price.replace(/\./g, '')),
      description: variantFormData.description.trim() || null,
      is_active: variantFormData.is_active === "true",
      store_id: currentStore.id,
    };

    try {
      const roomName = rooms.find(r => r.id === selectedRoomForVariant)?.name;

      if (editingVariant) {
        const { error } = await supabase
          .from("room_variants")
          .update(variantData)
          .eq("id", editingVariant.id);

        if (error) throw error;

        await logActivity({
          actionType: 'updated',
          entityType: 'RoomVariant',
          entityId: editingVariant.id,
          description: `Mengubah varian ${variantData.variant_name} untuk kamar ${roomName}`,
        });

        toast.success("Varian berhasil diupdate");
      } else {
        const { data: newVariant, error } = await supabase
          .from("room_variants")
          .insert([variantData])
          .select()
          .single();

        if (error) throw error;

        await logActivity({
          actionType: 'created',
          entityType: 'RoomVariant',
          entityId: newVariant.id,
          description: `Menambahkan varian ${variantData.variant_name} untuk kamar ${roomName}`,
        });

        toast.success("Varian berhasil ditambahkan");
      }

      fetchRoomVariants(selectedRoomForVariant);
      fetchAllVariantCounts();
      handleCloseVariantDialog();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan varian");
      console.error(error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoom(null);
    setFormData({
      name: "",
      status: "Aktif",
      category_id: "",
    });
  };

  const handleCloseVariantDialog = () => {
    setIsVariantDialogOpen(false);
    setEditingVariant(null);
    setSelectedRoomForVariant(null);
    setVariantFormData({
      variant_name: "",
      price: "",
      description: "",
      is_active: "true",
    });
  };

  const toggleRoomExpand = (roomId: string) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  const formatPrice = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return parseInt(numericValue).toLocaleString('id-ID');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPrice(e.target.value);
    setVariantFormData({ ...variantFormData, price: formattedValue });
  };

  const getStatusBadge = (status: string) => {
    if (status === "Aktif") {
      return <Badge className="bg-green-500">Aktif</Badge>;
    } else if (status === "Rusak") {
      return <Badge variant="destructive">Rusak</Badge>;
    } else {
      return <Badge variant="secondary">Maintenance</Badge>;
    }
  };

  const getCategoryName = (room: Room) => {
    // Use category from joined room_categories if available
    if (room.room_categories?.name) {
      return room.room_categories.name;
    }
    // Fallback to legacy category field
    return room.category || "Regular";
  };

  const handleQuickCategoryChange = async (roomId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ category_id: categoryId })
        .eq("id", roomId);

      if (error) throw error;

      const categoryName = categories.find(c => c.id === categoryId)?.name;
      const roomName = rooms.find(r => r.id === roomId)?.name;

      await logActivity({
        actionType: 'updated',
        entityType: 'Kamar',
        entityId: roomId,
        description: `Mengubah kategori kamar ${roomName} menjadi ${categoryName}`,
      });

      toast.success("Kategori berhasil diubah");
      fetchRooms();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah kategori");
      console.error(error);
    }
  };

  const getCategoryBadgeColor = (categoryName: string) => {
    const colorMap: Record<string, string> = {
      "vip": "bg-purple-500 text-white",
      "premium": "bg-amber-500 text-white",
      "deluxe": "bg-blue-500 text-white",
      "suite": "bg-rose-500 text-white",
      "regular": "",
    };
    
    const lowerName = categoryName?.toLowerCase() || "";
    return colorMap[lowerName] || "bg-slate-500 text-white";
  };

  const handleDisplaySizeChange = (size: string) => {
    setDisplaySize(size);
    localStorage.setItem("schedule-display-size", size);
    window.dispatchEvent(new CustomEvent("display-size-changed", { detail: size }));
    toast.success("Ukuran tampilan berhasil diubah");
  };

  return (
    <div className="space-y-6">
      {/* Product Management Section */}
      <ProductManagement />

      {/* Room Management Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRoomSectionExpanded(!isRoomSectionExpanded)}
                className="p-1"
              >
                {isRoomSectionExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
              <CardTitle>Kelola Kamar</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
                <Tags className="mr-2 h-4 w-4" />
                Kelola Kategori
              </Button>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Kamar
              </Button>
            </div>
          </div>
        </CardHeader>
        {isRoomSectionExpanded && (
          <CardContent>
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.id} className="border rounded-lg">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRoomExpand(room.id)}
                      className="p-1"
                    >
                      {expandedRooms.has(room.id) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="font-medium">{room.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {expandedRooms.has(room.id) ? (roomVariants[room.id]?.length || 0) : (variantCounts[room.id] || 0)} varian
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={room.category_id || ""}
                        onValueChange={(value) => handleQuickCategoryChange(room.id, value)}
                      >
                        <SelectTrigger className={`w-auto min-w-[100px] h-7 text-xs ${
                          getCategoryBadgeColor(getCategoryName(room))
                        }`}>
                          <SelectValue placeholder={getCategoryName(room)} />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {getStatusBadge(room.status)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddVariant(room.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Varian
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(room)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(userRole === "admin" || userRole === "leader") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRoom(room)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {expandedRooms.has(room.id) && (
                  <div className="border-t p-4 bg-muted/30">
                    {!roomVariants[room.id] || roomVariants[room.id].length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        Belum ada varian. Klik tombol "Varian" untuk menambahkan.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama Varian</TableHead>
                            <TableHead>Durasi</TableHead>
                            <TableHead>Harga</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roomVariants[room.id].map((variant) => (
                            <TableRow key={variant.id}>
                              <TableCell className="font-medium">
                                {variant.variant_name}
                              </TableCell>
                              <TableCell>{variant.duration} malam</TableCell>
                              <TableCell>Rp {variant.price.toLocaleString('id-ID')}</TableCell>
                              <TableCell>
                                <Badge variant={variant.is_active ? "default" : "secondary"}>
                                  {variant.is_active ? "Aktif" : "Tidak Aktif"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditVariant(variant)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {(userRole === "admin" || userRole === "leader") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteVariant(variant.id, room.id)}
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
        )}
      </Card>

      {/* Add/Edit Room Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? "Edit Kamar" : "Tambah Kamar Baru"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kamar</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="Aktif">Aktif</SelectItem>
                  <SelectItem value="Rusak">Rusak</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              {formData.status !== "Aktif" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Kamar dengan status ini tidak dapat dibooking
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategori *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {categories.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Belum ada kategori. Silakan buat kategori terlebih dahulu.
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1"
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1">
                {editingRoom ? "Update" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={isVariantDialogOpen} onOpenChange={handleCloseVariantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? "Edit Varian" : "Tambah Varian"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleVariantSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variant_name">Nama Varian</Label>
              <Input
                id="variant_name"
                value={variantFormData.variant_name}
                onChange={(e) =>
                  setVariantFormData({ ...variantFormData, variant_name: e.target.value })
                }
                placeholder="Contoh: Standard, Full Day, Half Day"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Harga</Label>
              <Input
                id="price"
                value={variantFormData.price}
                onChange={handlePriceChange}
                placeholder="Masukkan harga"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi (opsional)</Label>
              <Textarea
                id="description"
                value={variantFormData.description}
                onChange={(e) =>
                  setVariantFormData({ ...variantFormData, description: e.target.value })
                }
                placeholder="Keterangan tambahan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <Select
                value={variantFormData.is_active}
                onValueChange={(value) =>
                  setVariantFormData({ ...variantFormData, is_active: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Tidak Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseVariantDialog}
                className="flex-1"
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1">
                {editingVariant ? "Update" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <CategoryManagement 
        isOpen={isCategoryDialogOpen} 
        onClose={() => setIsCategoryDialogOpen(false)}
        onCategoryChanged={() => {
          fetchCategories();
          fetchRooms();
        }}
      />
    </div>
  );
}
