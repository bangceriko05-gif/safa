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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { Banknote, CreditCard, Upload, X, Loader2, Pencil, Trash2, Shield, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
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

interface DepositData {
  id: string;
  room_id: string;
  store_id: string;
  deposit_type: string;
  amount: number | null;
  identity_type: string | null;
  identity_owner_name: string | null;
  notes: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  created_by: string;
  returned_at: string | null;
  returned_by: string | null;
}

interface DepositDetailPopupProps {
  open: boolean;
  roomId: string | null;
  roomName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DepositDetailPopup({
  open,
  roomId,
  roomName,
  onClose,
  onSuccess,
}: DepositDetailPopupProps) {
  const { currentStore } = useStore();
  const [deposit, setDeposit] = useState<DepositData | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [depositType, setDepositType] = useState<"uang" | "identitas">("uang");
  const [amount, setAmount] = useState("");
  const [identityType, setIdentityType] = useState("KTP");
  const [identityOwnerName, setIdentityOwnerName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && roomId && currentStore) {
      fetchDeposit();
    }
  }, [open, roomId, currentStore]);

  const fetchDeposit = async () => {
    if (!roomId || !currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("room_deposits")
        .select("*")
        .eq("room_id", roomId)
        .eq("store_id", currentStore.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      setDeposit(data);
      populateEditForm(data);

      // Fetch creator name
      if (data.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", data.created_by)
          .single();
        setCreatorName(profile?.name || "Unknown");
      }
    } catch (error) {
      console.error("Error fetching deposit:", error);
      toast.error("Gagal memuat data deposit");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const populateEditForm = (data: DepositData) => {
    setDepositType(data.deposit_type as "uang" | "identitas");
    setAmount(
      data.amount
        ? data.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        : ""
    );
    setIdentityType(data.identity_type || "KTP");
    setIdentityOwnerName(data.identity_owner_name || "");
    setNotes(data.notes || "");
    setExistingPhotoUrl(data.photo_url);
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
      setExistingPhotoUrl(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhotoUrl(null);
  };

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSave = async () => {
    if (!deposit) return;

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
      let photoUrl = existingPhotoUrl;

      // Upload new photo if exists
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

      const { error } = await supabase
        .from("room_deposits")
        .update({
          deposit_type: depositType,
          amount: depositType === "uang" ? parseFloat(amount.replace(/\D/g, "")) : null,
          identity_type: depositType === "identitas" ? identityType : null,
          identity_owner_name: depositType === "identitas" ? identityOwnerName : null,
          notes: notes || null,
          photo_url: photoUrl,
        })
        .eq("id", deposit.id);

      if (error) throw error;

      await logActivity({
        actionType: "updated",
        entityType: "Deposit",
        entityId: deposit.id,
        description: `Mengubah deposit untuk kamar: ${roomName}`,
        storeId: currentStore?.id,
      });

      toast.success("Deposit berhasil diperbarui");
      setIsEditing(false);
      onSuccess?.();
      fetchDeposit();
    } catch (error: any) {
      console.error("Error updating deposit:", error);
      toast.error(error.message || "Gagal memperbarui deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deposit) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("room_deposits")
        .delete()
        .eq("id", deposit.id);

      if (error) throw error;

      await logActivity({
        actionType: "deleted",
        entityType: "Deposit",
        entityId: deposit.id,
        description: `Menghapus deposit untuk kamar: ${roomName}`,
        storeId: currentStore?.id,
      });

      toast.success("Deposit berhasil dihapus");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error deleting deposit:", error);
      toast.error(error.message || "Gagal menghapus deposit");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              Deposit - {roomName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !deposit ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada deposit aktif
            </div>
          ) : isEditing ? (
            /* Edit Mode */
            <>
              <ScrollArea className="flex-1 max-h-[400px] pr-4">
                <div className="space-y-5">
                  {/* Deposit Type */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Jenis Deposit *</Label>
                    <RadioGroup
                      value={depositType}
                      onValueChange={(v) => setDepositType(v as "uang" | "identitas")}
                      className="grid grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="edit-uang"
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          depositType === "uang" ? "bg-primary/10 border-primary" : "hover:bg-muted"
                        }`}
                      >
                        <RadioGroupItem value="uang" id="edit-uang" />
                        <Banknote className="h-4 w-4" />
                        <span className="text-sm">Uang</span>
                      </Label>
                      <Label
                        htmlFor="edit-identitas"
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          depositType === "identitas" ? "bg-primary/10 border-primary" : "hover:bg-muted"
                        }`}
                      >
                        <RadioGroupItem value="identitas" id="edit-identitas" />
                        <CreditCard className="h-4 w-4" />
                        <span className="text-sm">Identitas</span>
                      </Label>
                    </RadioGroup>
                  </div>

                  {depositType === "uang" && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-amount">Nominal Deposit (Rp) *</Label>
                      <Input
                        id="edit-amount"
                        placeholder="Contoh: 100.000"
                        value={amount}
                        onChange={(e) => setAmount(formatCurrency(e.target.value))}
                      />
                    </div>
                  )}

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
                              htmlFor={`edit-id-${type}`}
                              className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors text-sm ${
                                identityType === type ? "bg-primary/10 border-primary" : "hover:bg-muted"
                              }`}
                            >
                              <RadioGroupItem value={type} id={`edit-id-${type}`} />
                              {type}
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-ownerName">Nama Pemilik Identitas *</Label>
                        <Input
                          id="edit-ownerName"
                          placeholder="Masukkan nama sesuai identitas"
                          value={identityOwnerName}
                          onChange={(e) => setIdentityOwnerName(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Catatan (opsional)</Label>
                    <Textarea
                      id="edit-notes"
                      placeholder="Catatan tambahan..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lampiran Foto (opsional)</Label>
                    {(photoPreview || existingPhotoUrl) ? (
                      <div className="relative inline-block">
                        <img
                          src={photoPreview || existingPhotoUrl || ""}
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
                      <label className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="flex flex-col items-center">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Upload foto</span>
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
                <Button variant="ghost" onClick={() => {
                  setIsEditing(false);
                  if (deposit) populateEditForm(deposit);
                }}>
                  Batal Edit
                </Button>
                <Button onClick={handleSave} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                    <Shield className="w-3 h-3 mr-1" />
                    Deposit Aktif
                  </Badge>
                </div>

                {/* Deposit Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {deposit.deposit_type === "uang" ? (
                      <Banknote className="h-4 w-4 text-green-600" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-sm font-semibold">
                      {deposit.deposit_type === "uang" ? "Deposit Uang" : "Deposit Identitas"}
                    </span>
                  </div>

                  {deposit.deposit_type === "uang" && deposit.amount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Nominal</Label>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrencyDisplay(deposit.amount)}
                      </div>
                    </div>
                  )}

                  {deposit.deposit_type === "identitas" && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Jenis Identitas</Label>
                        <div className="text-sm font-medium">{deposit.identity_type || "-"}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Nama Pemilik</Label>
                        <div className="text-sm font-medium">{deposit.identity_owner_name || "-"}</div>
                      </div>
                    </>
                  )}

                  {deposit.notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Catatan</Label>
                      <div className="text-sm">{deposit.notes}</div>
                    </div>
                  )}

                  {deposit.photo_url && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Foto</Label>
                      <img
                        src={deposit.photo_url}
                        alt="Deposit photo"
                        className="mt-1 max-w-full h-40 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Dibuat: {format(new Date(deposit.created_at), "d MMM yyyy, HH:mm", { locale: localeId })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    <span>Oleh: {creatorName}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    Tutup
                  </Button>
                  <Button size="sm" onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus deposit untuk kamar {roomName}? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
