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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { Banknote, CreditCard, Upload, X, Loader2 } from "lucide-react";

interface DepositFormModalProps {
  open: boolean;
  roomId: string | null;
  roomName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DepositFormModal({ 
  open, 
  roomId, 
  roomName,
  onClose, 
  onSuccess 
}: DepositFormModalProps) {
  const { currentStore } = useStore();
  const [depositType, setDepositType] = useState<"uang" | "identitas">("uang");
  const [amount, setAmount] = useState("");
  const [identityType, setIdentityType] = useState("KTP");
  const [identityOwnerName, setIdentityOwnerName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setDepositType("uang");
    setAmount("");
    setIdentityType("KTP");
    setIdentityOwnerName("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
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
    if (!roomId) {
      toast.error("Kamar tidak valid");
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

      // Create deposit record
      const { error: insertError } = await supabase
        .from("room_deposits")
        .insert({
          room_id: roomId,
          store_id: currentStore!.id,
          deposit_type: depositType,
          amount: depositType === "uang" ? parseFloat(amount.replace(/\D/g, "")) : null,
          identity_type: depositType === "identitas" ? identityType : null,
          identity_owner_name: depositType === "identitas" ? identityOwnerName : null,
          notes: notes || null,
          photo_url: photoUrl,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      // Log activity
      await logActivity({
        actionType: "created",
        entityType: "Deposit",
        description: `Menambahkan deposit ${depositType === "uang" ? `Rp ${amount}` : `Identitas (${identityType})`} untuk kamar: ${roomName}`,
      });

      toast.success(`Deposit berhasil ditambahkan untuk kamar ${roomName}`);
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
            Form Deposit - {roomName}
          </DialogTitle>
        </DialogHeader>

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
                        htmlFor={`id-${type}`}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                          identityType === type ? "bg-primary/10 border-primary" : "hover:bg-muted"
                        }`}
                      >
                        <RadioGroupItem value={type} id={`id-${type}`} />
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

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Deposit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
