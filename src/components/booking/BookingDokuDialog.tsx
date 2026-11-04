import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DokuCheckoutPanel, { type DokuCheckoutState } from "@/components/booking-orders/DokuCheckoutPanel";
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/utils/userFacingError";
import { isVerifiedDokuCheckoutUrl } from "@/utils/dokuChannels";

interface Props {
  storeId: string;
  bookingId: string | null;
  onPrepare: () => Promise<void>;
  preparing: boolean;
}

/** QRIS DOKU booking tampil langsung di formulir (menggantikan Bukti Bayar), bukan popup. */
export default function BookingDokuInline({ storeId, bookingId, onPrepare, preparing }: Props) {
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
    if (bookingId) void load();
    else setCheckout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  return <div className="space-y-2">
    <p className="text-sm font-medium leading-none">Pembayaran QRIS DOKU</p>
    <div className={`flex flex-col ${checkout ? "h-[540px]" : "min-h-[160px]"}`}>
      {checkout ? <DokuCheckoutPanel checkout={checkout} storeId={storeId} saving={saving} booking qrOnly onRetry={() => void load()} onRenew={() => void load(true)} /> :
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-md border border-dashed p-6">
          {bookingId || preparing ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Menyiapkan QRIS…</p> : <>
            <p className="text-sm text-center text-muted-foreground">Lengkapi data booking, lalu buat QRIS untuk membayar tagihan.</p>
            <Button type="button" disabled={preparing} onClick={() => void onPrepare()}>Simpan booking & tampilkan QRIS</Button>
          </>}
        </div>}
    </div>
  </div>;
}
