import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Copy, 
  Loader2, 
  DoorOpen, 
  Package, 
  Settings, 
  Palette, 
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { logActivity } from "@/utils/activityLogger";

interface Store {
  id: string;
  name: string;
  location: string | null;
}

interface DuplicationOptions {
  rooms: boolean;
  roomVariants: boolean;
  products: boolean;
  categories: boolean;
  statusColors: boolean;
}

export default function StoreDuplication() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreLocation, setNewStoreLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [duplicationResult, setDuplicationResult] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);
  
  const [options, setOptions] = useState<DuplicationOptions>({
    rooms: true,
    roomVariants: true,
    products: true,
    categories: true,
    statusColors: true,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, location")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Gagal memuat data outlet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedStoreId || !newStoreName.trim()) {
      toast.error("Pilih outlet sumber dan masukkan nama outlet baru");
      return;
    }

    setIsDuplicating(true);
    setDuplicationResult(null);
    const details: string[] = [];

    try {
      const sourceStore = stores.find(s => s.id === selectedStoreId);
      
      // Fetch source store's calendar_type
      const { data: sourceStoreData } = await supabase
        .from("stores")
        .select("calendar_type")
        .eq("id", selectedStoreId)
        .single();
      
      // 1. Create new store with same calendar_type as source
      const { data: newStore, error: storeError } = await supabase
        .from("stores")
        .insert([{
          name: newStoreName.trim(),
          location: newStoreLocation.trim() || null,
          is_active: true,
          slug: newStoreName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          calendar_type: sourceStoreData?.calendar_type || 'schedule',
        }])
        .select()
        .single();

      if (storeError) throw storeError;
      details.push(`✓ Outlet "${newStoreName}" berhasil dibuat (tipe kalender: ${sourceStoreData?.calendar_type || 'schedule'})`);

      // 2. Copy categories if selected
      if (options.categories) {
        const { data: categories, error: catError } = await supabase
          .from("room_categories")
          .select("name, description")
          .eq("store_id", selectedStoreId);

        if (!catError && categories && categories.length > 0) {
          const newCategories = categories.map(cat => ({
            ...cat,
            store_id: newStore.id,
          }));

          await supabase.from("room_categories").insert(newCategories);
          details.push(`✓ ${categories.length} kategori kamar disalin`);
        }
      }

      // Fetch new categories for mapping
      const { data: newCategories } = await supabase
        .from("room_categories")
        .select("id, name")
        .eq("store_id", newStore.id);

      const categoryMap = new Map<string, string>();
      if (newCategories) {
        const { data: oldCategories } = await supabase
          .from("room_categories")
          .select("id, name")
          .eq("store_id", selectedStoreId);
        
        if (oldCategories) {
          oldCategories.forEach(oldCat => {
            const newCat = newCategories.find(nc => nc.name === oldCat.name);
            if (newCat) {
              categoryMap.set(oldCat.id, newCat.id);
            }
          });
        }
      }

      // 3. Copy rooms if selected
      const roomMap = new Map<string, string>();
      if (options.rooms) {
        const { data: rooms, error: roomError } = await supabase
          .from("rooms")
          .select("name, status, category_id")
          .eq("store_id", selectedStoreId);

        if (!roomError && rooms && rooms.length > 0) {
          for (const room of rooms) {
            const newRoom = {
              name: room.name,
              status: room.status,
              store_id: newStore.id,
              category_id: room.category_id ? categoryMap.get(room.category_id) || null : null,
            };

            const { data: insertedRoom } = await supabase
              .from("rooms")
              .insert([newRoom])
              .select("id")
              .single();

            if (insertedRoom) {
              // Get original room id
              const { data: originalRoom } = await supabase
                .from("rooms")
                .select("id")
                .eq("store_id", selectedStoreId)
                .eq("name", room.name)
                .single();
              
              if (originalRoom) {
                roomMap.set(originalRoom.id, insertedRoom.id);
              }
            }
          }
          details.push(`✓ ${rooms.length} kamar disalin`);
        }
      }

      // 4. Copy room variants if selected
      if (options.roomVariants && options.rooms) {
        let variantCount = 0;
        for (const [oldRoomId, newRoomId] of roomMap) {
          const { data: variants, error: varError } = await supabase
            .from("room_variants")
            .select("variant_name, duration, price, description, is_active, visibility_type, visible_days, booking_duration_type, booking_duration_value")
            .eq("room_id", oldRoomId);

          if (!varError && variants && variants.length > 0) {
            const newVariants = variants.map(v => ({
              variant_name: v.variant_name,
              duration: v.duration,
              price: v.price,
              description: v.description,
              is_active: v.is_active,
              visibility_type: v.visibility_type,
              visible_days: v.visible_days,
              booking_duration_type: v.booking_duration_type,
              booking_duration_value: v.booking_duration_value,
              room_id: newRoomId,
            }));

            await supabase.from("room_variants").insert(newVariants);
            variantCount += variants.length;
          }
        }
        if (variantCount > 0) {
          details.push(`✓ ${variantCount} varian kamar disalin`);
        }
      }

      // 5. Copy products if selected
      if (options.products) {
        const { data: products, error: prodError } = await supabase
          .from("products")
          .select("name, price")
          .eq("store_id", selectedStoreId);

        if (!prodError && products && products.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          
          const newProducts = products.map(prod => ({
            ...prod,
            store_id: newStore.id,
            created_by: user?.id,
          }));

          await supabase.from("products").insert(newProducts);
          details.push(`✓ ${products.length} produk disalin`);
        }
      }

      // 6. Copy status colors if selected
      if (options.statusColors) {
        const { data: colors, error: colorError } = await supabase
          .from("status_colors")
          .select("status, color")
          .eq("store_id", selectedStoreId);

        if (!colorError && colors && colors.length > 0) {
          const newColors = colors.map(c => ({
            ...c,
            store_id: newStore.id,
          }));

          await supabase.from("status_colors").insert(newColors);
          details.push(`✓ ${colors.length} warna status disalin`);
        }
      }

      // Log activity
      await logActivity({
        actionType: 'created',
        entityType: 'Outlet',
        entityId: newStore.id,
        description: `[Super Admin] Menyalin outlet dari "${sourceStore?.name}" ke "${newStoreName}"`,
      });

      setDuplicationResult({
        success: true,
        message: `Outlet "${newStoreName}" berhasil dibuat dari salinan "${sourceStore?.name}"`,
        details,
      });

      // Reset form
      setNewStoreName("");
      setNewStoreLocation("");
      setSelectedStoreId("");
      fetchStores();
      
    } catch (error: any) {
      console.error("Error duplicating store:", error);
      setDuplicationResult({
        success: false,
        message: error.message || "Gagal menyalin outlet",
        details,
      });
    } finally {
      setIsDuplicating(false);
      setShowConfirmDialog(false);
    }
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Salin Outlet
          </CardTitle>
          <CardDescription>
            Buat outlet baru dengan menyalin pengaturan, kamar, produk, dan lainnya dari outlet yang sudah ada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source Store Selection */}
          <div className="space-y-2">
            <Label>Pilih Outlet Sumber</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih outlet yang akan disalin..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name} {store.location && `(${store.location})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStore && (
            <>
              <Separator />

              {/* New Store Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newStoreName">Nama Outlet Baru *</Label>
                  <Input
                    id="newStoreName"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="Contoh: Treebox Surabaya"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newStoreLocation">Lokasi</Label>
                  <Input
                    id="newStoreLocation"
                    value={newStoreLocation}
                    onChange={(e) => setNewStoreLocation(e.target.value)}
                    placeholder="Contoh: Surabaya"
                  />
                </div>
              </div>

              <Separator />

              {/* Duplication Options */}
              <div className="space-y-4">
                <Label>Data yang Akan Disalin</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id="rooms"
                      checked={options.rooms}
                      onCheckedChange={(checked) => 
                        setOptions({ ...options, rooms: !!checked, roomVariants: !!checked && options.roomVariants })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="rooms" className="cursor-pointer">Kamar</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id="roomVariants"
                      checked={options.roomVariants}
                      onCheckedChange={(checked) => setOptions({ ...options, roomVariants: !!checked })}
                      disabled={!options.rooms}
                    />
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="roomVariants" className={`cursor-pointer ${!options.rooms ? 'text-muted-foreground' : ''}`}>
                        Varian Kamar (Durasi & Harga)
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id="products"
                      checked={options.products}
                      onCheckedChange={(checked) => setOptions({ ...options, products: !!checked })}
                    />
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="products" className="cursor-pointer">Produk</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id="categories"
                      checked={options.categories}
                      onCheckedChange={(checked) => setOptions({ ...options, categories: !!checked })}
                    />
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="categories" className="cursor-pointer">Kategori Kamar</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id="statusColors"
                      checked={options.statusColors}
                      onCheckedChange={(checked) => setOptions({ ...options, statusColors: !!checked })}
                    />
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="statusColors" className="cursor-pointer">Warna Status Booking</Label>
                    </div>
                  </div>

                </div>
              </div>

              <Separator />

              {/* Action Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!newStoreName.trim() || isDuplicating}
                  size="lg"
                >
                  {isDuplicating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyalin...
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Salin Outlet
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Result Display */}
          {duplicationResult && (
            <div className={`p-4 rounded-lg border ${
              duplicationResult.success 
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {duplicationResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="space-y-2">
                  <p className={`font-medium ${
                    duplicationResult.success 
                      ? 'text-green-800 dark:text-green-200' 
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {duplicationResult.message}
                  </p>
                  {duplicationResult.details && duplicationResult.details.length > 0 && (
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {duplicationResult.details.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Salin Outlet</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Anda akan membuat outlet baru "<strong>{newStoreName}</strong>" 
                dengan menyalin data dari outlet "<strong>{selectedStore?.name}</strong>".
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {options.rooms && <Badge variant="secondary">Kamar</Badge>}
                {options.roomVariants && <Badge variant="secondary">Varian Kamar</Badge>}
                {options.products && <Badge variant="secondary">Produk</Badge>}
                {options.categories && <Badge variant="secondary">Kategori</Badge>}
                {options.statusColors && <Badge variant="secondary">Warna Status</Badge>}
                {options.statusColors && <Badge variant="secondary">Warna Status</Badge>}
              </div>
              <p className="text-sm mt-3">
                Lanjutkan proses penyalinan?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDuplicating}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyalin...
                </>
              ) : (
                "Ya, Salin Outlet"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
