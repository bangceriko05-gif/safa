import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchGroupBilling } from "@/utils/groupBookingBilling";
import { bookingReceiptStay } from "@/utils/bookingReceiptStay";
import { canShareBookingPayment, paymentWhatsAppLink } from "@/utils/paymentWhatsApp";
import { functionErrorMessage } from "@/utils/userFacingError";

export default function BookingPaymentWhatsAppIcon({ booking, disabled = false }: {
  booking: { id: string; store_id?: string | null; booking_group_id?: string | null };
  disabled?: boolean;
}) {
  const { currentStore } = useStore();
  const [sharing, setSharing] = useState(false);
  const share = async () => {
    if (sharing || disabled || !currentStore || (booking.store_id && currentStore.id !== booking.store_id)) return;
    // Open during the click so browsers do not block the WhatsApp tab after the request.
    const chat = window.open("about:blank", "_blank");
    if (!chat) { toast.error("Izinkan pop-up untuk membuka WhatsApp, lalu coba kembali."); return; }
    chat.opener = null;
    setSharing(true);
    try {
      const initial = await fetchGroupBilling({ ...booking, store_id: currentStore.id });
      const first = initial.rooms[0];
      const billing = !booking.booking_group_id && first?.booking_group_id
        ? await fetchGroupBilling(first) : initial;
      const owner = billing.totals.owner;
      if (!owner || !canShareBookingPayment(billing.totals.remaining, billing.rooms.map(room => room.status))) {
        throw new Error("Booking sudah lunas atau dibatalkan. Tidak ada tagihan yang perlu dikirim.");
      }
      const stay = owner.date ? bookingReceiptStay({
        date: owner.date, duration: owner.duration, start_time: owner.start_time || "00:00:00",
        end_time: owner.end_time || "00:00:00", ota_source: owner.ota_source, ota_booking_id: owner.ota_booking_id,
      }, currentStore.calendar_type) : null;
      const customer = { phone: owner.phone, name: owner.customer_name, bid: owner.bid || undefined,
        storeName: currentStore.name, checkIn: stay?.checkIn, checkOut: stay?.checkout, withTime: stay?.unit === "jam" };
      if (!paymentWhatsAppLink(customer, "https://checkout.doku.com/", 1)) {
        throw new Error("Nomor WhatsApp pelanggan tidak valid. Periksa nomor pada booking.");
      }
      // The existing authorized checkout resumes the same invoice/amount, or creates a
      // link for the outstanding balance if no valid invoice remains. Never settle here.
      const { data, error } = await supabase.functions.invoke("doku-booking-checkout", {
        body: { booking_id: owner.id, resume: true },
      });
      if (error || data?.error) throw new Error(await functionErrorMessage(error, data, "Link pembayaran belum tersedia. Periksa pengaturan DOKU outlet, lalu coba kembali."));
      const href = paymentWhatsAppLink(customer, data?.checkout_url, Number(data?.amount));
      if (!href) throw new Error("Link pembayaran belum tersedia. Silakan coba kembali.");
      chat.location.href = href;
    } catch (error) {
      chat.close();
      toast.error(error instanceof Error ? error.message : "Link pembayaran belum dapat dikirim. Silakan coba kembali.");
    } finally { setSharing(false); }
  };
  return <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 p-0 [&_svg]:size-8"
    aria-label="Kirim link pembayaran via WhatsApp" title="Kirim link pembayaran via WhatsApp"
    disabled={disabled || sharing} onClick={event => { event.stopPropagation(); void share(); }}>
    {sharing ? <Loader2 className="animate-spin text-primary" /> : <WhatsAppBrandIcon />}
  </Button>;
}