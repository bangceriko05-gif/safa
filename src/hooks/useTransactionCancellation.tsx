import { useState } from "react";
import CancelBookingDialog from "@/components/booking/CancelBookingDialog";

export function appendCancellationReason(existing: string | null | undefined, reason: string) {
  return [existing, `Alasan pembatalan: ${reason.trim()}`].filter(Boolean).join("\n\n");
}

export function useTransactionCancellation(transactionLabel: string) {
  const [pending, setPending] = useState<{
    bid?: string;
    confirm: (reason: string) => Promise<void> | void;
  } | null>(null);

  const requestCancellation = (bid: string | undefined, confirm: (reason: string) => Promise<void> | void) => {
    setPending({ bid, confirm });
  };

  const cancellationDialog = (
    <CancelBookingDialog
      open={Boolean(pending)}
      transactionLabel={transactionLabel}
      transactionBid={pending?.bid}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      onConfirm={async (reason) => { if (pending) await pending.confirm(reason); }}
    />
  );

  return { requestCancellation, cancellationDialog };
}