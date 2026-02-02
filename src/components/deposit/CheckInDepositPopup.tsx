import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { logActivity } from "@/utils/activityLogger";
import { Banknote, CreditCard, Loader2, SkipForward } from "lucide-react";

interface CheckInDepositPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookingData: {
    id: string;
    room_id: string;
    room_name?: string;
    customer_name: string;
    store_id: string;
  };
}

export default function CheckInDepositPopup({
  open,
  onClose,
  onConfirm,
  bookingData,
}: CheckInDepositPopupProps) {
  const [depositType, setDepositType] = useState<"uang" | "identitas">("uang");
  const [amount, setAmount] = useState("");
  const [identityType, setIdentityType] = useState("KTP");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleSkip = () => {
    onConfirm();
    onClose();
  };

  const handleSaveDeposit = async () => {
    if (depositType === "uang" && !amount) {
      toast.error("Masukkan nominal deposit");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create deposit record
      const depositData = {
        room_id: bookingData.room_id,
        store_id: bookingData.store_id,
        deposit_type: depositType,
        amount: depositType === "uang" ? parseFloat(amount.replace(/\D/g, "")) : null,
        identity_type: depositType === "identitas" ? identityType : null,
        identity_owner_name: depositType === "identitas" ? bookingData.customer_name : null,
        created_by: user.id,
        status: "active",
      };

      const { error: insertError } = await supabase
        .from("room_deposits")
        .insert(depositData);

      if (insertError) throw insertError;

      // Log activity
      const depositDescription = depositType === "uang" 
        ? `Rp ${amount}` 
        : `Identitas (${identityType})`;
      
      await logActivity({
        actionType: "created",
        entityType: "Deposit",
        description: `Menambahkan deposit ${depositDescription} untuk kamar ${bookingData.room_name || 'Unknown'} (Check-In ${bookingData.customer_name})`,
      });

      toast.success("Deposit berhasil disimpan");
      
      // Proceed with check-in
      onConfirm();
      onClose();
    } catch (error: any) {
      console.error("Error creating deposit:", error);
      toast.error(error.message || "Gagal menyimpan deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDepositType("uang");
    setAmount("");
    setIdentityType("KTP");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💰 Deposit Check-In
          </DialogTitle>
          <DialogDescription>
            Tambahkan deposit untuk <strong>{bookingData.customer_name}</strong> sebelum check-in
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Deposit Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Jenis Deposit</Label>
            <RadioGroup
              value={depositType}
              onValueChange={(value) => setDepositType(value as "uang" | "identitas")}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="deposit-uang"
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  depositType === "uang" 
                    ? "bg-primary/10 border-primary shadow-sm" 
                    : "hover:bg-muted border-border"
                }`}
              >
                <RadioGroupItem value="uang" id="deposit-uang" />
                <Banknote className="h-5 w-5 text-green-600" />
                <span className="font-medium">Uang</span>
              </Label>
              <Label
                htmlFor="deposit-identitas"
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  depositType === "identitas" 
                    ? "bg-primary/10 border-primary shadow-sm" 
                    : "hover:bg-muted border-border"
                }`}
              >
                <RadioGroupItem value="identitas" id="deposit-identitas" />
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Identitas</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Money Deposit Fields */}
          {depositType === "uang" && (
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Nominal Deposit (Rp) *</Label>
              <Input
                id="deposit-amount"
                placeholder="Contoh: 100.000"
                value={amount}
                onChange={(e) => setAmount(formatCurrency(e.target.value))}
                className="text-lg font-semibold"
              />
            </div>
          )}

          {/* Identity Deposit Fields */}
          {depositType === "identitas" && (
            <div className="space-y-3">
              <Label>Jenis Identitas *</Label>
              <RadioGroup
                value={identityType}
                onValueChange={setIdentityType}
                className="grid grid-cols-2 gap-2"
              >
                {["KTP", "SIM", "Paspor", "Lainnya"].map((type) => (
                  <Label
                    key={type}
                    htmlFor={`identity-${type}`}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      identityType === type 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-muted"
                    }`}
                  >
                    <RadioGroupItem value={type} id={`identity-${type}`} />
                    <span className="text-sm font-medium">{type}</span>
                  </Label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Nama pemilik: <strong>{bookingData.customer_name}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Lewati
          </Button>
          <Button
            onClick={handleSaveDeposit}
            disabled={isSubmitting || (depositType === "uang" && !amount)}
            className="flex-1 gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan & Check In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
