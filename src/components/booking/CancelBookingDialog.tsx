import { useEffect, useState } from "react";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";

const reasonSchema = z.string().trim().min(1, "Alasan pembatalan wajib diisi").max(500, "Alasan pembatalan maksimal 500 karakter");

interface Props {
  open: boolean;
  bookingName?: string;
  transactionLabel?: string;
  transactionBid?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function CancelBookingDialog({ open, bookingName, transactionLabel, transactionBid, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    const result = reasonSchema.safeParse(reason);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Alasan pembatalan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(result.data);
      onOpenChange(false);
    } catch {
      setError("Pembatalan belum berhasil. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan {transactionLabel || "Booking"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {transactionLabel || "Booking"}{transactionBid ? ` ${transactionBid}` : ""}{bookingName ? ` atas nama ${bookingName}` : " ini"} akan dipindahkan ke daftar batal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="booking-cancel-reason" className="text-sm font-medium">
            Alasan Pembatalan <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="booking-cancel-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError("");
            }}
            placeholder={`Tuliskan alasan pembatalan ${transactionLabel ? "transaksi" : "booking"} ini...`}
            maxLength={500}
            disabled={submitting}
            className="min-h-[96px] resize-y"
            aria-invalid={Boolean(error)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Tutup</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || reason.trim().length === 0}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? "Membatalkan..." : "Batalkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}