import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DOKU_QR_TTL_MS, formatDokuQrCountdown } from "@/utils/dokuCheckoutLayout";

/** Waktu mulai tagihan QRIS DOKU yang masih menunggu pembayaran, per booking (termasuk kamar lain dalam BID yang sama). */
export function useBookingDokuTimers(bookingIds: string[]) {
  const [timers, setTimers] = useState<Record<string, string>>({});
  const key = [...bookingIds].sort().join(",");
  useEffect(() => {
    if (!key) { setTimers({}); return; }
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_booking_doku_payment_timers", { p_booking_ids: key.split(",") });
      if (active) setTimers(Object.fromEntries((data || []).map((row: { booking_id: string; created_at: string }) => [row.booking_id, row.created_at])));
    };
    void load();
    const poll = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(poll); };
  }, [key]);
  return timers;
}

export default function BookingDokuTimer({ since }: { since?: string }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!since) return;
    const start = new Date(since).getTime();
    const tick = () => setLeft(DOKU_QR_TTL_MS - (Date.now() - start));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  if (!since || left <= 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold tabular-nums text-amber-700" role="status" title="Sisa waktu pembayaran QRIS">
      <Timer className="h-3 w-3" />{formatDokuQrCountdown(left)}
    </span>
  );
}
