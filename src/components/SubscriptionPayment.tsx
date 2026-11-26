import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  FileText,
  Layers3,
  Loader2,
  Scale,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SubscriptionPaymentIcon from "./SubscriptionPaymentIcon";
import {
  buildSubscriptionItems,
  formatSubscriptionDate,
  formatSubscriptionPrice,
  nextSubscriptionBill,
  PMS_PAYMENT_ACCOUNT,
  subscriptionBillTiming,
  type SubscriptionFeatureRow,
  type SubscriptionItem,
  type SubscriptionStore,
} from "@/utils/subscription";
import { cn } from "@/lib/utils";

interface PaymentRow {
  id: string;
  feature_name: string;
  amount: number | string;
  period_end: string | null;
  status: "pending" | "paid" | "cancelled";
  payment_method: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
}

function SubscriptionItemIcon({ item }: { item: SubscriptionItem }) {
  const Icon = item.featureKey === "pms" ? Layers3 : item.featureKey === "reports.accounting" ? Scale : Store;
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </div>
  );
}

function SubscriptionCard({ item }: { item: SubscriptionItem }) {
  const statusLabel = item.isActive ? "Aktif" : item.isEnabled ? "Berakhir" : "Nonaktif";
  const nearest = item.daysLeft !== null && item.daysLeft <= 7;
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start gap-3">
          <SubscriptionItemIcon item={item} />
          <div className="min-w-0 flex-1 border-l border-border pl-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">{item.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 gap-1 border-transparent px-2 py-0.5 text-[11px]",
                  item.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {item.isActive && <Check className="h-3 w-3" />}
                {statusLabel}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border pt-3 min-[460px]:grid-cols-3">
          <div className="flex items-start gap-2">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Biaya Bulanan</p>
              <p className="text-xs font-bold">{formatSubscriptionPrice(item.monthlyPrice)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-[460px]:border-l min-[460px]:border-border min-[460px]:pl-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Aktif Sampai</p>
              <p className="text-xs font-bold">{formatSubscriptionDate(item.endDate)}</p>
            </div>
          </div>
          <div className={cn("flex items-start gap-2 rounded-lg px-2 py-1.5", nearest ? "bg-destructive/10" : "bg-primary/5")}>
            <CalendarDays className={cn("mt-0.5 h-4 w-4 shrink-0", nearest ? "text-destructive" : "text-primary")} />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Tagihan Berikutnya</p>
              <p className="text-xs font-bold">{item.isEnabled ? formatSubscriptionDate(item.endDate) : "Tidak ditagihkan"}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPayment({ store }: { store: SubscriptionStore }) {
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<SubscriptionFeatureRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedStoreId, setLoadedStoreId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [featureResult, paymentResult] = await Promise.all([
      supabase
        .from("store_features")
        .select("id, feature_key, is_enabled, activation_price, monthly_price, subscription_end_date")
        .eq("store_id", store.id),
      supabase
        .from("subscription_payments")
        .select("id, feature_name, amount, period_end, status, payment_method, reference, paid_at, created_at")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
    ]);

    if (featureResult.error || paymentResult.error) {
      toast.error("Data langganan belum dapat dimuat. Silakan coba lagi.");
    } else {
      setFeatures((featureResult.data || []) as SubscriptionFeatureRow[]);
      setPayments((paymentResult.data || []) as PaymentRow[]);
      setLoadedStoreId(store.id);
    }
    setLoading(false);
  }, [store.id]);

  useEffect(() => {
    setShowHistory(false);
    if (open) void loadData();
  }, [open, loadData]);

  const items = useMemo(() => buildSubscriptionItems(store, features), [store, features]);
  const nextBill = useMemo(() => nextSubscriptionBill(items), [items]);
  const accountActive = items[0]?.isActive ?? store.is_active;

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(PMS_PAYMENT_ACCOUNT.number);
      setCopied(true);
      toast.success("Nomor rekening berhasil disalin.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nomor rekening belum dapat disalin. Silakan salin secara manual.");
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn("h-10 w-10 rounded-xl bg-card shadow-sm", open && "border-primary ring-2 ring-primary/20")}
            aria-label="Pembayaran Langganan"
            title="Pembayaran Langganan"
          >
            <SubscriptionPaymentIcon className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Panel Pembayaran Langganan"
          className="w-[460px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl p-0 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b bg-card px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight">Pembayaran Langganan</h2>
              <p className="truncate text-xs text-muted-foreground">{store.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Tutup panel langganan" className="h-8 w-8 shrink-0 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[min(620px,78vh)] space-y-4 overflow-y-auto p-4">
            <section className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground shadow-sm">
              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-primary-foreground/10" />
              <div className="relative flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <Crown className="h-6 w-6" />
                </div>
                <div className="border-l border-primary-foreground/30 pl-3.5">
                  <p className="text-xs font-semibold">Status Akun</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <h3 className="text-xl font-bold">{accountActive ? "Aktif" : "Tidak Aktif"}</h3>
                    {accountActive && <CheckCircle2 className="h-5 w-5 text-success" />}
                  </div>
                  <p className="mt-0.5 text-xs text-primary-foreground/85">
                    {accountActive ? "PMS & fitur tambahan berjalan normal." : "Hubungi admin ANKA untuk mengaktifkan langganan."}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-sm font-bold">Detail Langganan</h3>
              {loading && loadedStoreId !== store.id ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item) => <SubscriptionCard key={item.id} item={item} />)}
                </div>
              )}
            </section>

            {!(loading && loadedStoreId !== store.id) && nextBill && (
              <section className="flex flex-col gap-2 rounded-xl border-l-4 border-l-destructive bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="h-6 w-6 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold">Tagihan Terdekat</h3>
                    <p className="text-xs text-muted-foreground">{nextBill.name} – {formatSubscriptionPrice(nextBill.monthlyPrice)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 border-transparent bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
                  {subscriptionBillTiming(nextBill.daysLeft)}
                </Badge>
              </section>
            )}

            <div className="space-y-2">
              <Button
                className="h-10 w-full gap-2 text-sm font-bold"
                onClick={() => {
                  setOpen(false);
                  setShowPayment(true);
                }}
                disabled={loading && loadedStoreId !== store.id}
              >
                <CreditCard className="h-4 w-4" />
                Bayar Sekarang
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full gap-2 text-sm font-bold"
                onClick={() => setShowHistory((value) => !value)}
                aria-expanded={showHistory}
              >
                <FileText className="h-4 w-4" />
                Riwayat Pembayaran
              </Button>
            </div>

            {showHistory && (
              <Card>
                <CardContent className="p-3.5">
                  <h3 className="mb-3 text-sm font-bold">Riwayat Pembayaran</h3>
                  {payments.length === 0 ? (
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className="text-sm font-medium">Belum ada pembayaran yang tercatat.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Riwayat akan muncul setelah pembayaran langganan dikonfirmasi admin ANKA.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{payment.feature_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatSubscriptionDate((payment.paid_at || payment.created_at).slice(0, 10))}
                              {payment.payment_method ? ` • ${payment.payment_method}` : ""}
                            </p>
                            {payment.reference && <p className="mt-1 text-[11px] text-muted-foreground">Referensi: {payment.reference}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold">{formatSubscriptionPrice(Number(payment.amount))}</p>
                            <p className={cn("text-xs", payment.status === "paid" ? "text-success" : "text-muted-foreground")}>
                              {payment.status === "paid" ? "Lunas" : payment.status === "pending" ? "Menunggu" : "Dibatalkan"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pembayaran Langganan</DialogTitle>
            <DialogDescription>Transfer sesuai tagihan, lalu hubungi administrator ANKA untuk konfirmasi.</DialogDescription>
          </DialogHeader>
          {nextBill && (
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Tagihan terdekat • {nextBill.name}</p>
              <p className="mt-1 text-2xl font-bold">{formatSubscriptionPrice(nextBill.monthlyPrice)}</p>
              <p className="mt-1 text-sm">Jatuh tempo {formatSubscriptionDate(nextBill.endDate)}</p>
            </div>
          )}
          <div className="space-y-4 rounded-xl border bg-muted/30 p-5 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Silakan transfer ke rekening berikut</p>
              <p className="mt-1 text-xl font-bold text-primary">{PMS_PAYMENT_ACCOUNT.bank}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <code className="rounded-md border bg-background px-3 py-2 text-xl font-bold tracking-wider">{PMS_PAYMENT_ACCOUNT.number}</code>
              <Button variant="outline" size="sm" onClick={handleCopyAccount} className="gap-2">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "Tersalin" : "Salin"}
              </Button>
            </div>
            <p className="text-sm font-medium">A/N. {PMS_PAYMENT_ACCOUNT.name}</p>
          </div>
          <p className="text-sm text-muted-foreground">Pembayaran DOKU untuk langganan belum tersedia. Setelah transfer, kirim bukti pembayaran kepada administrator agar masa aktif diperpanjang.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
