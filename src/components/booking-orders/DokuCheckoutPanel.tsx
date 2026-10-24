import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface DokuCheckoutState {
  orderId: string;
  url: string | null;
  error: string | null;
}

interface Props {
  checkout: DokuCheckoutState;
  storeId: string;
  saving: boolean;
  onRetry: () => void;
}

export default function DokuCheckoutPanel({ checkout, storeId, saving, onRetry }: Props) {
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkPayment = async (notify = false) => {
    setChecking(true);
    const { data, error } = await supabase.from("booking_orders")
      .select("payment_status").eq("id", checkout.orderId).eq("store_id", storeId).maybeSingle();
    setChecking(false);
    if (error || !data) {
      if (notify) toast.error("Status pembayaran belum dapat diperiksa. Silakan coba lagi.");
      return;
    }
    const settled = data.payment_status === "lunas";
    setPaid(settled);
    if (notify) settled ? toast.success("Pembayaran sudah diterima. Transaksi LUNAS.") : toast.info("Pembayaran belum dikonfirmasi DOKU. Silakan tunggu sebentar.");
  };

  useEffect(() => {
    if (!checkout.orderId || paid) return;
    void checkPayment();
    const timer = window.setInterval(() => { void checkPayment(); }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout.orderId, storeId, paid]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-md border bg-background" aria-label="Halaman pembayaran DOKU">
      {paid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-primary" role="status">
          <CheckCircle2 className="h-12 w-12" /><p className="text-2xl font-bold">LUNAS</p>
          <p className="text-sm text-foreground">Pembayaran sudah diterima.</p>
        </div>
      ) : checkout.error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-center" role="alert">{checkout.error}</p>
          <Button onClick={onRetry} disabled={saving}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>
        </div>
      ) : checkout.url ? (
        <div className="relative flex flex-1 min-h-0">
          {!loaded && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground pointer-events-none"><Loader2 className="h-5 w-5 animate-spin" />Memuat pembayaran DOKU…</div>}
          <iframe key={reload} src={checkout.url} title="Pembayaran QRIS DOKU" className="relative w-full flex-1 min-h-0 border-0 bg-background" onLoad={() => setLoaded(true)} allow="payment" referrerPolicy="no-referrer" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin" />Menyiapkan tagihan DOKU…</div>
      )}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t p-2">
        <Button variant="ghost" size="sm" disabled={!checkout.url || saving} onClick={() => { setLoaded(false); setReload((value) => value + 1); }}><RefreshCw className="mr-2 h-4 w-4" />Muat ulang</Button>
        <Button variant="outline" size="sm" disabled={!checkout.orderId || checking || saving} onClick={() => { void checkPayment(true); }}>{checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cek status pembayaran</Button>
        <Button variant="ghost" size="sm" disabled={!checkout.url} onClick={() => { if (checkout.url) window.open(checkout.url, "_blank", "noopener,noreferrer"); }}><ExternalLink className="mr-2 h-4 w-4" />Buka di tab baru</Button>
      </footer>
    </div>
  );
}