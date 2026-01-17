import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { Banknote, CreditCard, Upload, X, Loader2 } from "lucide-react";

interface Room {
  id: string;
  name: string;
  hasDeposit?: boolean;
}

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "select-rooms" | "form";

export default function DepositModal({ open, onClose, onSuccess }: DepositModalProps) {
  const { currentStore } = useStore();
  const [step, setStep] = useState<Step>("select-rooms");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [depositType, setDepositType] = useState<"uang" | "identitas">("uang");
  const [amount, setAmount] = useState("");
  const [identityType, setIdentityType] = useState("KTP");
  const [identityOwnerName, setIdentityOwnerName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && currentStore) {
      fetchRooms();
      resetForm();
    }
  }, [open, currentStore]);

  const resetForm = () => {
    setStep("select-rooms");
    setSelectedRooms([]);
    setDepositType("uang");
    setAmount("");
    setIdentityType("KTP");
    setIdentityOwnerName("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const fetchRooms = async () => {
    if (!currentStore) return;
    setIsLoading(true);
    try {
      // Fetch all active rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, status")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif")
        .order("name");

      if (roomsError) throw roomsError;

      // Fetch rooms that already have active deposits
      const { data: depositsData, error: depositsError } = await supabase
        .from("room_deposits")
        .select("room_id")
        .eq("store_id", currentStore.id)
        .eq("status", "active");

      if (depositsError) throw depositsError;

      const roomsWithDeposit = new Set(depositsData?.map(d => d.room_id) || []);

      const roomsWithStatus = roomsData?.map(room => ({
        ...room,
        hasDeposit: roomsWithDeposit.has(room.id),
      })) || [];

      setRooms(roomsWithStatus);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Gagal memuat data kamar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoomToggle = (roomId: string) => {
    setSelectedRooms(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Hanya file gambar yang diperbolehkan");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async () => {
    if (selectedRooms.length === 0) {
      toast.error("Pilih minimal 1 kamar");
      return;
    }

    if (depositType === "uang" && !amount) {
      toast.error("Masukkan nominal deposit");
      return;
    }

    if (depositType === "identitas" && !identityOwnerName) {
      toast.error("Masukkan nama pemilik identitas");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let photoUrl = null;

      // Upload photo if exists
      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const fileName = `${currentStore!.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("deposit-photos")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("deposit-photos")
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
      }

      // Create deposit records for each selected room
      const depositsToInsert = selectedRooms.map(roomId => ({
        room_id: roomId,
        store_id: currentStore!.id,
        deposit_type: depositType,
        amount: depositType === "uang" ? parseFloat(amount.replace(/\D/g, "")) : null,
        identity_type: depositType === "identitas" ? identityType : null,
        identity_owner_name: depositType === "identitas" ? identityOwnerName : null,
        notes: notes || null,
        photo_url: photoUrl,
        created_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from("room_deposits")
        .insert(depositsToInsert);

      if (insertError) throw insertError;

      // Log activity
      const roomNames = rooms
        .filter(r => selectedRooms.includes(r.id))
        .map(r => r.name)
        .join(", ");

      await logActivity({
        actionType: "created",
        entityType: "Deposit",
        description: `Menambahkan deposit ${depositType === "uang" ? `Rp ${amount}` : `Identitas (${identityType})`} untuk kamar: ${roomNames}`,
      });

      toast.success(`Deposit berhasil ditambahkan untuk ${selectedRooms.length} kamar`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error creating deposit:", error);
      toast.error(error.message || "Gagal menambahkan deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "select-rooms" ? "Pilih Kamar untuk Deposit" : "Form Deposit"}
          </DialogTitle>
        </DialogHeader>

        {step === "select-rooms" ? (
          <>
            <ScrollArea className="flex-1 max-h-[400px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        room.hasDeposit
                          ? "bg-amber-50 border-amber-200 cursor-not-allowed opacity-60"
                          : selectedRooms.includes(room.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => !room.hasDeposit && handleRoomToggle(room.id)}
                    >
                      <Checkbox
                        checked={selectedRooms.includes(room.id)}
                        disabled={room.hasDeposit}
                        onCheckedChange={() => handleRoomToggle(room.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{room.name}</span>
                        {room.hasDeposit && (
                          <p className="text-xs text-amber-600">Sudah ada deposit</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedRooms.length} kamar dipilih
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Batal
                </Button>
                <Button
                  onClick={() => setStep("form")}
                  disabled={selectedRooms.length === 0}
                >
                  Lanjutkan
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[400px] pr-4">
              <div className="space-y-6">
                {/* Deposit Type */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Jenis Deposit *</Label>
                  <RadioGroup
                    value={depositType}
                    onValueChange={(value) => setDepositType(value as "uang" | "identitas")}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="uang"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        depositType === "uang" ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      }`}
                    >
                      <RadioGroupItem value="uang" id="uang" />
                      <Banknote className="h-5 w-5" />
                      <span>Uang</span>
                    </Label>
                    <Label
                      htmlFor="identitas"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        depositType === "identitas" ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      }`}
                    >
                      <RadioGroupItem value="identitas" id="identitas" />
                      <CreditCard className="h-5 w-5" />
                      <span>Identitas</span>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Money deposit fields */}
                {depositType === "uang" && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">Nominal Deposit (Rp) *</Label>
                    <Input
                      id="amount"
                      placeholder="Contoh: 100.000"
                      value={amount}
                      onChange={(e) => setAmount(formatCurrency(e.target.value))}
                    />
                  </div>
                )}

                {/* Identity deposit fields */}
                {depositType === "identitas" && (
                  <>
                    <div className="space-y-2">
                      <Label>Jenis Identitas *</Label>
                      <RadioGroup
                        value={identityType}
                        onValueChange={setIdentityType}
                        className="grid grid-cols-2 gap-2"
                      >
                        {["KTP", "SIM", "Paspor", "Lainnya"].map((type) => (
                          <Label
                            key={type}
                            htmlFor={type}
                            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                              identityType === type ? "bg-primary/10 border-primary" : "hover:bg-muted"
                            }`}
                          >
                            <RadioGroupItem value={type} id={type} />
                            <span className="text-sm">{type}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ownerName">Nama Pemilik Identitas *</Label>
                      <Input
                        id="ownerName"
                        placeholder="Masukkan nama sesuai identitas"
                        value={identityOwnerName}
                        onChange={(e) => setIdentityOwnerName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Catatan (opsional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Catatan tambahan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Photo upload */}
                <div className="space-y-2">
                  <Label>Lampiran Foto (opsional)</Label>
                  {photoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-w-full h-40 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={removePhoto}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex flex-col items-center">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mt-1">
                          Upload foto
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep("select-rooms")}>
                ← Kembali
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Batal
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Deposit
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
