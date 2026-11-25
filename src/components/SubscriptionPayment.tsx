import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Icon className="h-8 w-8" strokeWidth={1.8} />
    </div>
  );
}

function SubscriptionCard({ item }: { item: SubscriptionItem }) {
  const statusLabel = item.isActive ? "Aktif" : item.isEnabled ? "Berakhir" : "Nonaktif";
  const nearest = item.daysLeft !== null && item.daysLeft <= 7;
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <SubscriptionItemIcon item={item} />
          <div className="min-w-0 flex-1 border-l border-border pl-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 border-transparent",
                  item.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {item.isActive && <Check className="h-3.5 w-3.5" />}
                {statusLabel}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Biaya Bulanan</p>
              <p className="font-bold">{formatSubscriptionPrice(item.monthlyPrice)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
            <CalendarDays className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Aktif Sampai</p>
              <p className="font-bold">{formatSubscriptionDate(item.endDate)}</p>
            </div>
          </div>
          <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", nearest ? "bg-destructive/10" : "bg-primary/5")}>
            <CalendarDays className={cn("h-6 w-6 shrink-0", nearest ? "text-destructive" : "text-primary")} />
            <div>
              <p className="text-xs text-muted-foreground">Tagihan Berikutnya</p>
              <p className="font-bold">{item.isEnabled ? formatSubscriptionDate(item.endDate) : "Tidak ditagihkan"}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPayment({ store, onBack }: { store: SubscriptionStore; onBack: () => void }) {
  const [features, setFeatures] = useState<SubscriptionFeatureRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    }
    setLoading(false);
  }, [store.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Kembali" className="mt-1 h-11 w-11 shrink-0 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pembayaran Langganan</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Kelola pembayaran PMS dan fitur tambahan properti Anda.</p>
          <p className="mt-1 text-sm font-medium">{store.name}</p>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg sm:p-6">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-primary-foreground/10" />
        <div className="relative flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <Crown className="h-9 w-9" />
          </div>
          <div className="border-l border-primary-foreground/30 pl-5">
            <p className="text-sm font-semibold">Status Akun</p>
            <div className="mt-0.5 flex items-center gap-2">
              <h3 className="text-3xl font-bold">{accountActive ? "Aktif" : "Tidak Aktif"}</h3>
              {accountActive && <CheckCircle2 className="h-7 w-7 text-success" />}
            </div>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {accountActive ? "PMS & fitur tambahan berjalan normal." : "Hubungi admin ANKA untuk mengaktifkan langganan."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">Detail Langganan</h3>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : (
          items.map((item) => <SubscriptionCard key={item.id} item={item} />)
        )}
      </section>

      {!loading && nextBill && (
        <section className="flex flex-col gap-3 rounded-xl border-l-4 border-l-destructive bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-8 w-8 shrink-0 text-destructive" />
            <div>
              <h3 className="font-bold">Tagihan Terdekat</h3>
              <p className="text-sm text-muted-foreground">{nextBill.name} – {formatSubscriptionPrice(nextBill.monthlyPrice)}</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-transparent bg-destructive/10 px-4 py-2 text-destructive">
            {subscriptionBillTiming(nextBill.daysLeft)}
          </Badge>
        </section>
      )}

      <div className="space-y-3">
        <Button size="lg" className="h-12 w-full gap-3 text-base font-bold" onClick={() => setShowPayment(true)} disabled={loading}>
          <CreditCard className="h-5 w-5" />
          Bayar Sekarang
        </Button>
        <Button size="lg" variant="outline" className="h-12 w-full gap-3 text-base font-bold" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>
          <FileText className="h-5 w-5" />
          Riwayat Pembayaran
        </Button>
      </div>

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

      {showHistory && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-lg font-bold">Riwayat Pembayaran</h3>
            {payments.length === 0 ? (
              <div className="rounded-lg bg-muted/50 p-6 text-center">
                <p className="font-medium">Belum ada pembayaran yang tercatat.</p>
                <p className="mt-1 text-sm text-muted-foreground">Riwayat akan muncul setelah pembayaran langganan dikonfirmasi admin ANKA.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{payment.feature_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSubscriptionDate((payment.paid_at || payment.created_at).slice(0, 10))}
                        {payment.payment_method ? ` • ${payment.payment_method}` : ""}
                      </p>
                      {payment.reference && <p className="mt-1 text-xs text-muted-foreground">Referensi: {payment.reference}</p>}
                    </div>
                    <div className="sm:text-right">
                      <p className="font-bold">{formatSubscriptionPrice(Number(payment.amount))}</p>
                      <p className={cn("text-sm", payment.status === "paid" ? "text-success" : "text-muted-foreground")}>
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
  );
}
