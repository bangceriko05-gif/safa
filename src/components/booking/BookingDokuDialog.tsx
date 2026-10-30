import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DokuCheckoutPanel, { type DokuCheckoutState } from "@/components/booking-orders/DokuCheckoutPanel";
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/utils/userFacingError";
import { isVerifiedDokuCheckoutUrl } from "@/utils/dokuChannels";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  bookingId: string | null;
  onPrepare: () => Promise<void>;
  preparing: boolean;
}

export default function BookingDokuDialog({ open, onClose, storeId, bookingId, onPrepare, preparing }: Props) {
  const [checkout, setCheckout] = useState<DokuCheckoutState | null>(null);
  const [saving, setSaving] = useState(false);
  const load = async (renew = false) => {
    if (!bookingId || saving) return;
    setSaving(true);
    setCheckout({ orderId: bookingId, url: null, error: null, invoiceNumber: null, amount: null });
    try {
      const { data, error } = await supabase.functions.invoke("doku-booking-checkout", { body: { booking_id: bookingId, renew } });
      if (error || data?.error) throw new Error(await functionErrorMessage(error, data, "QRIS belum dapat dibuat. Silakan coba lagi."));
      if (!isVerifiedDokuCheckoutUrl(data?.checkout_url)) throw new Error("Halaman pembayaran DOKU belum tersedia. Silakan coba lagi.");
      setCheckout({ orderId: bookingId, url: data.checkout_url, error: null, invoiceNumber: data.invoice_number || null, amount: Number(data.amount) });
    } catch (error) {
      setCheckout({ orderId: bookingId, url: null, error: error instanceof Error ? error.message : "QRIS belum dapat dibuat. Silakan coba lagi.", invoiceNumber: null, amount: null });
    } finally { setSaving(false); }
  };
  useEffect(() => {
    if (open && bookingId) void load();
    if (!open) setCheckout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId]);
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !preparing && !saving) onClose(); }}>
    <DialogContent className="w-[95vw] max-w-3xl h-[90dvh] flex flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Pembayaran QRIS DOKU</DialogTitle></DialogHeader>
      {checkout ? <DokuCheckoutPanel checkout={checkout} storeId={storeId} saving={saving} booking onRetry={() => void load()} onRenew={() => void load(true)} /> :
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-center text-muted-foreground">{bookingId ? "Menyiapkan QRIS…" : "Lengkapi data booking, lalu buat QRIS untuk membayar tagihan."}</p>
          {!bookingId && <Button disabled={preparing} onClick={() => void onPrepare()}>{preparing ? "Menyiapkan booking…" : "Simpan booking & tampilkan QRIS"}</Button>}
        </div>}
    </DialogContent>
  </Dialog>;
}