import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DOKU_QR_TTL_MS, dokuBrandingCrop, formatDokuQrCountdown } from "@/utils/dokuCheckoutLayout";

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
  onRenew: () => void;
}

export default function DokuCheckoutPanel({ checkout, storeId, saving, onRetry, onRenew }: Props) {
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [crop, setCrop] = useState(() => dokuBrandingCrop(768));
  const [left, setLeft] = useState(DOKU_QR_TTL_MS);

  // Zona branding DOKU (bar hitung mundur, pemilih bahasa, logo & nama outlet) dipotong
  // agar kasir langsung melihat QRIS. Tingginya berubah menurut lebar panel.
  useEffect(() => {
    if (!checkout.url) return;
    const box = boxRef.current;
    if (!box) return;
    const apply = () => setCrop(dokuBrandingCrop(box.clientWidth));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [checkout.url]);

  // Hitung mundur QR diganti milik ANKA karena bar DOKU ikut terpotong.
  useEffect(() => {
    if (!checkout.url || paid) return;
    const start = Date.now();
    setLeft(DOKU_QR_TTL_MS);
    const timer = window.setInterval(() => setLeft(DOKU_QR_TTL_MS - (Date.now() - start)), 1000);
    return () => window.clearInterval(timer);
  }, [checkout.url, paid]);

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

  // QR DOKU kedaluwarsa setelah 60 menit: buat invoice & QR baru otomatis.
  useEffect(() => {
    if (!checkout.url || paid) return;
    const timer = window.setTimeout(() => { setLoaded(false); onRenew(); }, DOKU_QR_TTL_MS + 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout.url, paid]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-md border bg-background" aria-label="Pembayaran QRIS DOKU">
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
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
            <span className="font-semibold text-foreground">Pembayaran QRIS</span>
            <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
              <Timer className="h-3 w-3" />QR berlaku {formatDokuQrCountdown(left)}
            </span>
          </div>
          <div ref={boxRef} className="relative flex-1 min-h-0 overflow-hidden bg-background">
            {!loaded && <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground pointer-events-none"><Loader2 className="h-5 w-5 animate-spin" />Memuat pembayaran DOKU…</div>}
            <iframe
              key={reload}
              src={checkout.url}
              title="Pembayaran QRIS DOKU"
              className="absolute inset-x-0 top-0 w-full border-0 bg-background"
              style={{ height: `calc(100% + ${crop}px)`, transform: `translateY(-${crop}px)` }}
              onLoad={() => setLoaded(true)}
              allow="payment"
              referrerPolicy="no-referrer"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin" />Menyiapkan tagihan DOKU…</div>
      )}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t p-2">
        <Button variant="ghost" size="sm" disabled={!checkout.url || saving} onClick={() => { setLoaded(false); setReload((value) => value + 1); }}><RefreshCw className="mr-2 h-4 w-4" />Muat ulang</Button>
        <Button variant="outline" size="sm" disabled={!checkout.orderId || saving || paid} onClick={() => { setLoaded(false); onRenew(); }}><QrCode className="mr-2 h-4 w-4" />Buat QR baru</Button>
        <Button variant="outline" size="sm" disabled={!checkout.orderId || checking || saving} onClick={() => { void checkPayment(true); }}>{checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cek status pembayaran</Button>
        <Button variant="ghost" size="sm" disabled={!checkout.url} onClick={() => { if (checkout.url) window.open(checkout.url, "_blank", "noopener,noreferrer"); }}><ExternalLink className="mr-2 h-4 w-4" />Buka di tab baru</Button>
      </footer>
    </div>
  );
}
