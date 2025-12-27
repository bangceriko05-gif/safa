import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { Calendar, Clock, Settings2 } from "lucide-react";

interface RoomVariantExtended {
  id: string;
  room_id: string;
  variant_name: string;
  duration: number;
  price: number;
  is_active: boolean;
  visibility_type: string | null;
  visible_days: number[] | null;
  booking_duration_type: string | null;
  booking_duration_value: number | null;
}

interface Room {
  id: string;
  name: string;
}

interface VariantScheduleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Minggu" },
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "Semua Hari" },
  { value: "weekdays", label: "Weekdays (Senin-Jumat)" },
  { value: "weekends", label: "Weekends (Sabtu-Minggu)" },
  { value: "specific_days", label: "Hari Tertentu" },
];

const DURATION_TYPE_OPTIONS = [
  { value: "hours", label: "Jam" },
  { value: "days", label: "Hari" },
  { value: "weeks", label: "Minggu" },
  { value: "months", label: "Bulan" },
];

export default function VariantScheduleSettings({
  isOpen,
  onClose,
}: VariantScheduleSettingsProps) {
  const { currentStore } = useStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [variants, setVariants] = useState<RoomVariantExtended[]>([]);
  const [editingVariant, setEditingVariant] = useState<RoomVariantExtended | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [visibilityType, setVisibilityType] = useState("all");
  const [visibleDays, setVisibleDays] = useState<number[]>([]);
  const [durationTypeValue, setDurationTypeValue] = useState("hours");
  const [durationValue, setDurationValue] = useState("1");

  useEffect(() => {
    if (currentStore && isOpen) {
      fetchRooms();
    }
  }, [currentStore, isOpen]);

  useEffect(() => {
    if (selectedRoom) {
      fetchVariants(selectedRoom);
    } else {
      setVariants([]);
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    if (!currentStore) return;
    
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchVariants = async (roomId: string) => {
    if (!currentStore) return;

    try {
      const { data, error } = await supabase
        .from("room_variants")
        .select("*")
        .eq("room_id", roomId)
        .eq("store_id", currentStore.id)
        .order("variant_name");

      if (error) throw error;
      setVariants(data as RoomVariantExtended[] || []);
    } catch (error) {
      console.error("Error fetching variants:", error);
    }
  };

  const handleEditVariant = (variant: RoomVariantExtended) => {
    setEditingVariant(variant);
    setVisibilityType(variant.visibility_type || "all");
    setVisibleDays(variant.visible_days || []);
    setDurationTypeValue(variant.booking_duration_type || "hours");
    setDurationValue((variant.booking_duration_value || 1).toString());
  };

  const handleDayToggle = (day: number) => {
    setVisibleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveSettings = async () => {
    if (!editingVariant) return;

    setLoading(true);
    try {
      const updateData: any = {
        visibility_type: visibilityType,
        visible_days: visibilityType === "specific_days" ? visibleDays : 
                      visibilityType === "weekdays" ? [1, 2, 3, 4, 5] :
                      visibilityType === "weekends" ? [0, 6] : null,
        booking_duration_type: durationTypeValue,
        booking_duration_value: parseInt(durationValue) || 1,
      };

      const { error } = await supabase
        .from("room_variants")
        .update(updateData)
        .eq("id", editingVariant.id);

      if (error) throw error;

      toast.success("Pengaturan varian berhasil disimpan");
      setEditingVariant(null);
      if (selectedRoom) {
        fetchVariants(selectedRoom);
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan pengaturan");
    } finally {
      setLoading(false);
    }
  };

  const getVisibilityLabel = (variant: RoomVariantExtended) => {
    const type = variant.visibility_type || "all";
    const option = VISIBILITY_OPTIONS.find((o) => o.value === type);
    return option?.label || "Semua Hari";
  };

  const getDurationLabel = (variant: RoomVariantExtended) => {
    const type = variant.booking_duration_type || "hours";
    const value = variant.booking_duration_value || variant.duration || 1;
    const typeOption = DURATION_TYPE_OPTIONS.find((o) => o.value === type);
    return `${value} ${typeOption?.label || "Jam"}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Pengaturan Jadwal Varian Kamar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room Selector */}
          <div className="space-y-2">
            <Label>Pilih Kamar</Label>
            <Select
              value={selectedRoom || ""}
              onValueChange={(value) => {
                setSelectedRoom(value);
                setEditingVariant(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kamar untuk melihat varian" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variants List */}
          {selectedRoom && (
            <div className="space-y-3">
              <Label>Varian Kamar</Label>
              {variants.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada varian untuk kamar ini.
                </p>
              ) : (
                <div className="space-y-2">
                  {variants.map((variant) => (
                    <Card
                      key={variant.id}
                      className={`cursor-pointer transition-all ${
                        editingVariant?.id === variant.id
                          ? "ring-2 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleEditVariant(variant)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{variant.variant_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Rp {variant.price.toLocaleString("id-ID")}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {getVisibilityLabel(variant)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {getDurationLabel(variant)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit Form */}
          {editingVariant && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Edit Pengaturan: {editingVariant.variant_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Visibility Settings */}
                <div className="space-y-2">
                  <Label>Tampil di Hari</Label>
                  <Select
                    value={visibilityType}
                    onValueChange={(value) => {
                      setVisibilityType(value);
                      // Reset visible days when changing type
                      if (value === "weekdays") {
                        setVisibleDays([1, 2, 3, 4, 5]);
                      } else if (value === "weekends") {
                        setVisibleDays([0, 6]);
                      } else if (value === "all") {
                        setVisibleDays([]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Specific Days Selector */}
                {visibilityType === "specific_days" && (
                  <div className="space-y-2">
                    <Label>Pilih Hari</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div
                          key={day.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={visibleDays.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <label
                            htmlFor={`day-${day.value}`}
                            className="text-sm cursor-pointer"
                          >
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duration Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Durasi Blokir</Label>
                    <Input
                      type="number"
                      min="1"
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Satuan</Label>
                    <Select
                      value={durationTypeValue}
                      onValueChange={setDurationTypeValue}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {DURATION_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {durationTypeValue === "months" && (
                    <p>
                      📅 Booking akan memblokir dari tanggal check-in sampai
                      tanggal yang sama di bulan berikutnya (bukan 30 hari).
                    </p>
                  )}
                  {durationTypeValue === "weeks" && (
                    <p>
                      📅 Booking akan memblokir selama {durationValue} minggu (
                      {parseInt(durationValue) * 7} hari).
                    </p>
                  )}
                  {durationTypeValue === "days" && (
                    <p>📅 Booking akan memblokir selama {durationValue} hari.</p>
                  )}
                  {durationTypeValue === "hours" && (
                    <p>⏰ Booking akan memblokir selama {durationValue} jam.</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingVariant(null)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
