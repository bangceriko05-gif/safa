import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DokuCheckoutPanel, { type DokuCheckoutState } from "@/components/booking-orders/DokuCheckoutPanel";
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/utils/userFacingError";
import { isVerifiedDokuCheckoutUrl } from "@/utils/dokuChannels";
import { fetchGroupBilling } from "@/utils/groupBookingBilling";
import { matchesBookingDokuSettlement, type BookingDokuReceipt } from "@/utils/bookingDokuSettlement";
import { useCashDrawerSound } from "@/hooks/useCashDrawerSound";

interface Props {
  storeId: string;
  bookingId: string | null;
  onPrepare: () => Promise<void>;
  preparing: boolean;
  amount?: number;
  /** Buka kembali tagihan aktif tanpa mengganti nominal atau invoice. */
  resumeActive?: boolean;
  onReceived?: (receipt: BookingDokuReceipt) => void;
  onComplete?: () => void | Promise<void>;
}

/** QRIS DOKU booking tampil langsung di formulir (menggantikan Bukti Bayar), bukan popup. */
export default function BookingDokuInline({ storeId, bookingId, onPrepare, preparing, amount, resumeActive = false, onReceived, onComplete }: Props) {
  const [checkout, setCheckout] = useState<DokuCheckoutState | null>(null);
  const [saving, setSaving] = useState(false);
  const playCashDrawer = useCashDrawerSound();
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedInvoice = useRef<string | null>(null);
  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current); }, []);
  const confirmReceipt = async (receipt: BookingDokuReceipt) => {
    if (!bookingId || completedInvoice.current === receipt.invoiceNumber) return;
    const [attemptResult, initial] = await Promise.all([
      supabase.from("doku_booking_attempts").select("booking_id,store_id,invoice_number,amount,status")
        .eq("booking_id", bookingId).eq("store_id", storeId).eq("invoice_number", receipt.invoiceNumber).single(),
      fetchGroupBilling({ id: bookingId, store_id: storeId }),
    ]);
    if (attemptResult.error) throw attemptResult.error;
    const groupId = initial.rooms[0]?.booking_group_id;
    const billing = groupId ? await fetchGroupBilling({ id: bookingId, store_id: storeId, booking_group_id: groupId }) : initial;
    const owner = billing.rooms.find(room => room.id === bookingId);
    if (!matchesBookingDokuSettlement({ bookingId, storeId, invoiceNumber: receipt.invoiceNumber, amount: receipt.amount }, attemptResult.data, owner)) {
      throw new Error("Pembayaran belum sesuai dengan booking, invoice atau nominal tersimpan.");
    }
    const fullyPaid = billing.totals.total > 0 && billing.totals.remaining <= 0;
    if (receipt.fullyPaid && !fullyPaid) throw new Error("Tagihan belum terkonfirmasi lunas.");
    completedInvoice.current = receipt.invoiceNumber;
    onReceived?.({ ...receipt, fullyPaid });
    window.dispatchEvent(new CustomEvent("booking-changed"));
    if (fullyPaid) {
      playCashDrawer();
      completionTimer.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("booking-payment-completed", { detail: { bookingId, storeId } }));
        void onComplete?.();
      }, 1800);
    }
  };
  const load = async (renew = false) => {
    if (!bookingId || saving) return;
    setSaving(true);
    setCheckout({ orderId: bookingId, url: null, error: null, invoiceNumber: null, amount: null });
    try {
      const requestedAmount = renew ? checkout?.amount ?? amount : amount;
      const resuming = resumeActive && !renew;
      const { data, error } = await supabase.functions.invoke("doku-booking-checkout", { body: { booking_id: bookingId, renew, ...(resuming ? { resume: true } : requestedAmount && requestedAmount > 0 ? { amount: Math.round(requestedAmount) } : {}) } });
      if (error || data?.error) throw new Error(await functionErrorMessage(error, data, "QRIS belum dapat dibuat. Silakan coba lagi."));
      if (!isVerifiedDokuCheckoutUrl(data?.checkout_url)) throw new Error("Halaman pembayaran DOKU belum tersedia. Silakan coba lagi.");
      setCheckout({ orderId: bookingId, url: data.checkout_url, error: null, invoiceNumber: data.invoice_number || null, amount: Number(data.amount), dueMinutes: Number(data.due_minutes) || null, createdAt: typeof data.created_at === "string" ? data.created_at : null });
    } catch (error) {
      setCheckout({ orderId: bookingId, url: null, error: error instanceof Error ? error.message : "QRIS belum dapat dibuat. Silakan coba lagi.", invoiceNumber: null, amount: null });
    } finally { setSaving(false); }
  };
  useEffect(() => {
    if (bookingId) void load();
    else setCheckout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  // Total Bayar berubah → buat QR & invoice baru dengan nominal baru (ditunda agar tidak tiap ketikan).
  useEffect(() => {
    if (resumeActive || !bookingId || !amount || amount <= 0 || checkout?.amount == null || checkout.amount === Math.round(amount)) return;
    const t = setTimeout(() => void load(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, bookingId, checkout?.amount]);
  return <div className="space-y-2">
    <p className="text-sm font-medium leading-none">Pembayaran QRIS DOKU</p>
    <div className={`flex flex-col ${checkout ? "h-[540px]" : "min-h-[160px]"}`}>
      {checkout ? <DokuCheckoutPanel key={checkout.invoiceNumber || "preparing"} checkout={checkout} storeId={storeId} saving={saving} booking qrOnly onReceived={confirmReceipt} onRetry={() => void load()} onRenew={() => void load(true)} /> :
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-md border border-dashed p-6">
          {bookingId || preparing ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Menyiapkan QRIS…</p> : <>
            <p className="text-sm text-center text-muted-foreground">Lengkapi data booking, lalu buat QRIS untuk membayar tagihan.</p>
            <Button type="button" disabled={preparing} onClick={() => void onPrepare()}>Simpan booking & tampilkan QRIS</Button>
          </>}
        </div>}
    </div>
  </div>;
}
