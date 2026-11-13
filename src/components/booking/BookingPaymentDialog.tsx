import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { usePermissions } from "@/hooks/usePermissions";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchGroupBilling } from "@/utils/groupBookingBilling";
import { handleHutangOnEdit } from "@/utils/autoHutang";
import { logActivity } from "@/utils/activityLogger";
import cashDrawer from "@/assets/cash-drawer.mp3.asset.json";
import { bookingPaymentMethods } from "@/utils/dokuChannels";
import { activeBookingDokuTimer } from "@/utils/activeBookingDokuPayment";
import { bookingPaymentProofMissing, bookingPaymentProofRequired } from "@/utils/bookingDokuPayment";
import BookingDokuInline from "@/components/booking/BookingDokuDialog";

type Billing = Awaited<ReturnType<typeof fetchGroupBilling>>;
const currency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function BookingPaymentDialog({ open, onOpenChange, bookingId, initialBilling = null, onPaid, onComplete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  /** Tagihan yang sudah tampil di detail booking dipakai langsung agar formulir tidak menunggu. */
  initialBilling?: Billing | null;
  onPaid: () => void | Promise<void>;
  onComplete?: () => void;
}) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions(open);
  const { activeMethodNames, loading: methodsLoading } = usePaymentMethods();
  const { data: dokuSettings, error: dokuSettingsError } = useQuery({
    queryKey: ["booking-doku-methods", currentStore?.id],
    enabled: open && Boolean(currentStore?.id),
    queryFn: async () => {
      if (!currentStore?.id) return null;
      const { data, error } = await supabase.from("website_payment_settings")
        .select("doku_enabled,doku_channels").eq("store_id", currentStore.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: activeDokuTimer, isLoading: activeDokuLoading } = useQuery({
    queryKey: ["booking-active-doku-payment", bookingId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking_doku_payment_timers", { p_booking_ids: [bookingId] });
      if (error) throw error;
      return activeBookingDokuTimer(data, Date.now());
    },
    refetchInterval: 30_000,
  });
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [loadError, setLoadError] = useState("");
  const submitting = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const audioBuffer = useRef<AudioBuffer | null>(null);
  const initialBillingRef = useRef(initialBilling);
  initialBillingRef.current = initialBilling;
  const methodOptions = bookingPaymentMethods(
    [...activeMethodNames, ...(method ? [method] : [])],
    !dokuSettingsError && dokuSettings?.doku_enabled === true,
    Array.isArray(dokuSettings?.doku_channels) ? dokuSettings.doku_channels.filter((value): value is string => typeof value === "string") : [],
  );
  const resumingDoku = Boolean(activeDokuTimer);
  const qrisDoku = resumingDoku || method === "QRIS DOKU";

  useEffect(() => {
    if (open && dokuSettingsError) toast.error("Pilihan pembayaran DOKU belum dapat dimuat. Silakan coba lagi.");
  }, [open, dokuSettingsError]);

  useEffect(() => {
    if (!open || !currentStore) return;
    let cancelled = false;
    const cached = initialBillingRef.current?.rooms.length ? initialBillingRef.current : null;
    setBilling(cached);
    setLoading(!cached);
    setSettled(false);
    setLoadError("");
    setProof(null);
    setMethod(cached?.totals.paid2 ? cached.totals.owner?.payment_method_2 || "" : "");
    setReference("");
    setAmount(cached ? Math.max(0, cached.totals.remaining) : 0);
    if (!cached) fetchGroupBilling({ id: bookingId, store_id: currentStore.id }).then(async initial => {
      const room = initial.rooms[0];
      if (!room) throw new Error("Booking tidak ditemukan");
      const data = room.booking_group_id ? await fetchGroupBilling(room) : initial;
      if (cancelled) return;
      setBilling(data);
      setAmount(Math.max(0, data.totals.remaining));
      if (data.totals.paid2 > 0) setMethod(data.totals.owner?.payment_method_2 || "");
    }).catch(error => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "Gagal memuat tagihan");
    }).finally(() => { if (!cancelled) setLoading(false); });

    // Decode ahead of the click; resume during the user's gesture, play only after settlement.
    try {
      const context = new AudioContext();
      audioContext.current = context;
      fetch(cashDrawer.url).then(response => response.arrayBuffer()).then(bytes => context.decodeAudioData(bytes)).then(buffer => {
        if (!cancelled) audioBuffer.current = buffer;
      }).catch(() => {});
    } catch { /* Audio may be unavailable; payment remains usable. */ }
    return () => {
      cancelled = true;
      audioBuffer.current = null;
      void audioContext.current?.close().catch(() => {});
      audioContext.current = null;
    };
  }, [open, bookingId, currentStore?.id]);

  const pay = async () => {
    if (qrisDoku || submitting.current || !billing || !currentStore || bookingPaymentProofMissing(method, proof, amount) || !method || amount <= 0 || !hasPermission("edit_bookings")) return;
    submitting.current = true;
    setSaving(true);
    void audioContext.current?.resume().catch(() => {});
    try {
      const fresh = await fetchGroupBilling({ id: bookingId, store_id: currentStore.id, booking_group_id: billing.rooms[0]?.booking_group_id });
      const owner = fresh.totals.owner;
      if (!owner || fresh.rooms.some(room => room.status === "BATAL")) throw new Error("Booking dibatalkan dan tidak dapat dibayar");
      if (JSON.stringify(fresh) !== JSON.stringify(billing)) throw new Error("Tagihan telah berubah. Tutup lalu buka kembali Pembayaran.");
      if (amount > fresh.totals.remaining) throw new Error("Nominal melebihi sisa pembayaran");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan masuk kembali");
      const second = fresh.totals.paid1 > 0;
      if (second && fresh.totals.paid2 > 0 && method !== owner.payment_method_2) throw new Error("Dua metode sudah digunakan. Ubah metode melalui Edit Booking.");
      const isSettled = fresh.totals.total > 0 && fresh.totals.paid + amount >= fresh.totals.total;
      const payment = {
        price: second ? fresh.totals.paid1 : amount,
        price_2: second ? fresh.totals.paid2 + amount : null,
        dual_payment: second,
        payment_method: second ? owner.payment_method || null : method,
        payment_method_2: second ? method : null,
        reference_no: second ? owner.reference_no || "-" : reference.trim() || "-",
        reference_no_2: second ? reference.trim() || owner.reference_no_2 || null : null,
        payment_proof_url: second ? owner.payment_proof_url || null : proof,
        payment_proof_url_2: second ? proof : null,
        discount_type: owner.discount_type || null,
        discount_value: owner.discount_value || 0,
        discount_applies_to: owner.discount_applies_to || null,
        payment_status: isSettled ? "lunas" : "belum_lunas",
      };
      if (fresh.rooms.length > 1) {
        const { error } = await supabase.rpc("update_shared_booking_billing", {
          p_booking_id: bookingId, p_payment: payment,
          // Payment-only updates never rewrite historical room rates.
          p_room_rates: [],
          p_products: fresh.products.map(product => ({ product_id: product.product_id, product_name: product.product_name, product_price: product.product_price, quantity: product.quantity, subtotal: product.subtotal })),
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("bookings").update(payment).eq("id", bookingId).eq("store_id", currentStore.id).neq("status", "BATAL").select("id").single();
        if (error || !data) throw error || new Error("Pembayaran tidak tersimpan");
      }
      const confirmed = await fetchGroupBilling({ id: bookingId, store_id: currentStore.id, booking_group_id: owner.booking_group_id });
      const confirmedSettled = isSettled && confirmed.totals.total > 0 && confirmed.totals.remaining <= 0;
      await handleHutangOnEdit({
        previousPaymentMethod: (second ? owner.payment_method_2 : owner.payment_method) || null,
        newPaymentMethod: method, amount: second ? payment.price_2 || 0 : payment.price,
        supplierName: (owner as typeof owner & { customer_name?: string }).customer_name || "Pelanggan",
        description: "Pembayaran booking", storeId: currentStore.id, userId: user.id,
        bid: (owner as typeof owner & { bid?: string }).bid || null,
      });
      await logActivity({ actionType: "updated", entityType: "Booking", entityId: bookingId, storeId: currentStore.id,
        description: `Pembayaran ${currency(amount)} melalui ${method}; No. Reff: ${reference.trim() || "-"}; bukti: ${proof}; status ${confirmedSettled ? "LUNAS" : "BELUM LUNAS"}` });
      if (confirmedSettled) {
        setSettled(true);
        if (audioContext.current && audioBuffer.current) {
          const source = audioContext.current.createBufferSource();
          source.buffer = audioBuffer.current;
          source.connect(audioContext.current.destination);
          source.start();
        } else {
          void new Audio(cashDrawer.url).play().catch(() => {});
        }
      } else {
        toast.success("Pembayaran berhasil disimpan");
        onOpenChange(false);
      }
      await onPaid();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pembayaran");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="booking-payment-dialog max-h-[calc(100vh-2rem)] max-w-md w-[calc(100%-2rem)] overflow-y-auto" onClick={event => event.stopPropagation()}>
      <Button type="button" variant="ghost" size="icon" aria-label="Tutup pembayaran" className="absolute right-2 top-2 h-8 w-8" disabled={saving} onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
      <DialogHeader className="pr-8">
        <DialogTitle>{settled ? "Pembayaran Berhasil" : resumingDoku ? "Pembayaran QRIS DOKU" : "Pembayaran"}</DialogTitle>
        <DialogDescription>{settled ? "Tagihan booking telah lunas." : resumingDoku ? "Lanjutkan QR yang sedang menunggu pembayaran." : "Pembayaran booking"}</DialogDescription>
      </DialogHeader>
      {settled ? <div role="status" className="booking-settled flex flex-col items-center gap-4 py-10 text-success">
        <CheckCircle2 className="h-20 w-20" strokeWidth={1.5} />
        <span className="text-4xl font-bold">LUNAS</span>
        <span className="text-sm font-semibold">{currency(billing?.totals.total || 0)}</span>
      </div> : loading || activeDokuLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : loadError ? <p role="alert" className="text-destructive">{loadError}</p> : billing && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void pay(); }}>
        <div className="flex justify-between border-b pb-3 text-sm"><span>Sisa Pembayaran</span><span className="font-semibold tabular-nums">{currency(Math.max(0, billing.totals.remaining))}</span></div>
        {!resumingDoku && <>
          <div className="space-y-2"><Label htmlFor="booking-payment-amount">Jumlah Bayar *</Label><MoneyInput id="booking-payment-amount" value={amount} onChange={setAmount} className="font-semibold" disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="booking-payment-method">Metode Pembayaran *</Label>
            <Select value={method} onValueChange={setMethod} disabled={saving || methodsLoading || billing.totals.paid2 > 0}>
              <SelectTrigger id="booking-payment-method"><SelectValue placeholder="Pilih metode pembayaran" /></SelectTrigger>
              <SelectContent className="booking-payment-methods">{methodOptions.map(name => <SelectItem value={name} key={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </>}
        {qrisDoku && currentStore ? <BookingDokuInline
          storeId={currentStore.id}
          bookingId={billing.totals.owner?.id || bookingId}
          amount={resumingDoku ? undefined : amount}
          resumeActive={resumingDoku}
          preparing={false}
          onPrepare={async () => {}}
          onReceived={({ invoiceNumber }) => { setReference(invoiceNumber); void onPaid(); }}
          onComplete={() => { onOpenChange(false); onComplete?.(); }}
        /> : <PaymentProofUpload value={proof} onChange={setProof} required={bookingPaymentProofRequired(method, amount)} label={bookingPaymentProofRequired(method, amount) ? "Bukti Bayar" : "Bukti Bayar (Opsional)"} disabled={saving} compact />}
        {qrisDoku && reference && <div className="space-y-2"><Label htmlFor="booking-doku-reference">No. Reff</Label><Input id="booking-doku-reference" value={reference} readOnly /></div>}
        {!qrisDoku && <>
          <div className="space-y-2"><Label htmlFor="booking-payment-reference">No. Reff</Label><Input id="booking-payment-reference" value={reference} onChange={event => setReference(event.target.value)} disabled={saving} placeholder="Nomor referensi (opsional)" /></div>
          <Button type="submit" className="w-full gap-2" disabled={saving || bookingPaymentProofMissing(method, proof, amount) || !method || amount <= 0 || amount > billing.totals.remaining || !hasPermission("edit_bookings") || billing.rooms.some(room => room.status === "BATAL")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Bayar
          </Button>
        </>}
      </form>}
    </DialogContent>
  </Dialog>;
}