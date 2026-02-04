import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logActivity } from "@/utils/activityLogger";
import { Banknote, CreditCard, Loader2, CheckCircle, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CheckOutDepositPopupProps {
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

interface ActiveDeposit {
  id: string;
  deposit_type: string;
  amount: number | null;
  identity_type: string | null;
  identity_owner_name: string | null;
  created_at: string;
  status: string;
}

export default function CheckOutDepositPopup({
  open,
  onClose,
  onConfirm,
  bookingData,
}: CheckOutDepositPopupProps) {
  const [deposits, setDeposits] = useState<ActiveDeposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    if (open && bookingData.room_id) {
      fetchActiveDeposits();
    }
  }, [open, bookingData.room_id]);

  const fetchActiveDeposits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("room_deposits")
        .select("*")
        .eq("room_id", bookingData.room_id)
        .eq("status", "active");

      if (error) throw error;
      setDeposits(data || []);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      toast.error("Gagal memuat data deposit");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleReturnDeposits = async () => {
    setIsReturning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update all active deposits to returned
      const { error } = await supabase
        .from("room_deposits")
        .update({
          status: "returned",
          returned_by: user.id,
          returned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", bookingData.room_id)
        .eq("status", "active");

      if (error) throw error;

      // Log activity for each deposit
      for (const deposit of deposits) {
        const depositDescription = deposit.deposit_type === "uang"
          ? formatCurrency(deposit.amount || 0)
          : `Identitas (${deposit.identity_type})`;
        
        await logActivity({
          actionType: "updated",
          entityType: "Deposit",
          entityId: deposit.id,
          description: `Mengembalikan deposit ${depositDescription} untuk kamar ${bookingData.room_name || 'Unknown'} (Check-Out ${bookingData.customer_name})`,
        });
      }

      toast.success("Deposit berhasil dikembalikan");
      
      // Proceed with checkout
      onConfirm();
      onClose();
    } catch (error: any) {
      console.error("Error returning deposits:", error);
      toast.error(error.message || "Gagal mengembalikan deposit");
    } finally {
      setIsReturning(false);
    }
  };

  const handleSkipReturn = () => {
    // Proceed with checkout without returning deposits
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-orange-500" />
            Pengembalian Deposit
          </DialogTitle>
          <DialogDescription>
            Kamar <strong>{bookingData.room_name}</strong> memiliki deposit aktif yang perlu dikembalikan saat check-out.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            Tidak ada deposit aktif
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Deposit List */}
            <div className="space-y-3">
              {deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50"
                >
                  {deposit.deposit_type === "uang" ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                      <Banknote className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {deposit.deposit_type === "uang" ? (
                        <span className="text-green-700">
                          {formatCurrency(deposit.amount || 0)}
                        </span>
                      ) : (
                        <span className="text-blue-700">
                          {deposit.identity_type} - {deposit.identity_owner_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dibuat: {format(new Date(deposit.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            {deposits.some(d => d.deposit_type === "uang") && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  <span className="font-medium">Total Deposit Uang: </span>
                  {formatCurrency(
                    deposits
                      .filter(d => d.deposit_type === "uang")
                      .reduce((sum, d) => sum + (d.amount || 0), 0)
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleSkipReturn}
            disabled={isReturning}
            className="flex-1"
          >
            Lewati
          </Button>
          <Button
            onClick={handleReturnDeposits}
            disabled={isReturning || isLoading || deposits.length === 0}
            className="flex-1 gap-2"
          >
            {isReturning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Kembalikan & Check Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
