import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  User, Phone, Mail, Cake, MapPin, Award, Wallet, Repeat, CalendarDays, MessageCircle, Star, ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BookingModal from "@/components/BookingModal";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

const TIERS: Record<TierKey, { label: string; className: string }> = {
  bronze: { label: "Bronze", className: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  silver: { label: "Silver", className: "bg-slate-400/20 text-slate-700 border-slate-400/40" },
  gold: { label: "Gold", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  platinum: { label: "Platinum", className: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const formatNum = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const normalizePhone = (p?: string | null) => (p || "").replace(/\D/g, "").replace(/^0/, "62");

export interface DetailTxn {
  phone: string;
  name: string;
  date: string;
  amount: number;
  source: "booking" | "pos";
  bid?: string | null;
  status?: string | null;
  id?: string;
}

export interface DetailCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  domicile: string | null;
  createdAt: string;
  visits: number;
  totalSpend: number;
  lastVisit: string | null;
  segmentLabel: string;
  segmentClass: string;
}

interface Props {
  customer: DetailCustomer | null;
  txns: DetailTxn[];
  storeId?: string;
  storeName?: string;
  onClose: () => void;
}

export default function CustomerDetailDialog({ customer, txns, storeId, storeName, onClose }: Props) {
  const [settings, setSettings] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [extra, setExtra] = useState<any>(null);
  const [bidPreview, setBidPreview] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const navigate = useNavigate();

  const openTxn = async (t: DetailTxn) => {
    if (!t.id) return;
    if (t.source === "pos") {
      onClose();
      navigate(`/pos-order/${t.id}`);
      return;
    }
    const { data } = await supabase.from("bookings").select("*").eq("id", t.id).maybeSingle();
    if (data) setBidPreview(data);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || ""));
  }, []);

  useEffect(() => {
    if (!customer || !storeId) return;
    let active = true;
    (async () => {
      const [sRes, lRes, cRes] = await Promise.all([
        supabase.from("loyalty_settings").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("loyalty_transactions").select("*").eq("store_id", storeId).eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("customers").select("identity_type,identity_number,notes").eq("id", customer.id).maybeSingle(),
      ]);
      if (!active) return;
      setSettings(sRes.data);
      setLedger(lRes.data || []);
      setExtra(cRes.data);
    })();
    return () => { active = false; };
  }, [customer?.id, storeId]);

  const history = useMemo(() => {
    if (!customer) return [];
    const p = normalizePhone(customer.phone);
    return txns.filter((t) => t.phone === p).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [customer, txns]);

  const loyalty = useMemo(() => {
    const perAmount = Math.max(settings?.earn_per_amount || 10000, 1);
    const earned =
      Math.floor((customer?.totalSpend || 0) / perAmount) * (settings?.points_per_earn ?? 1) +
      (customer?.visits || 0) * (settings?.points_per_visit ?? 0);
    let redeemed = 0;
    let adjusted = 0;
    ledger.forEach((l) => {
      const pts = Number(l.points) || 0;
      if (l.type === "redeem" || l.type === "expire") redeemed += Math.abs(pts);
      else adjusted += pts;
    });
    const balance = Math.max(earned + adjusted - redeemed, 0);
    const tier: TierKey =
      balance >= (settings?.tier_platinum_points ?? 1000) ? "platinum" :
      balance >= (settings?.tier_gold_points ?? 500) ? "gold" :
      balance >= (settings?.tier_silver_points ?? 100) ? "silver" : "bronze";
    return { earned, redeemed, adjusted, balance, tier, value: balance * (settings?.redeem_point_value ?? 1000) };
  }, [customer, ledger, settings]);

  if (!customer) return null;

  const info = [
    { icon: User, label: "Nama Pelanggan", value: customer.name },
    { icon: Phone, label: "No. Telepon", value: customer.phone || "-" },
    { icon: Mail, label: "Email", value: customer.email || "-" },
    { icon: Cake, label: "Tanggal Lahir", value: formatDate(customer.birth_date) },
    { icon: MapPin, label: "Alamat / Domisili", value: customer.domicile || "-" },
    { icon: CalendarDays, label: "Terdaftar Sejak", value: formatDate(customer.createdAt) },
    { icon: User, label: "Identitas", value: extra?.identity_number ? `${extra.identity_type || "ID"} · ${extra.identity_number}` : "-" },
    { icon: MessageCircle, label: "Catatan", value: extra?.notes || "-" },
  ];

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 overflow-y-auto">
        <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
              </Button>
              <div>
              <DialogTitle className="text-lg">{customer.name}</DialogTitle>
              <p className="text-sm text-muted-foreground tabular-nums">{customer.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={customer.segmentClass}>{customer.segmentLabel}</Badge>
              <Badge variant="outline" className={TIERS[loyalty.tier].className}>{TIERS[loyalty.tier].label}</Badge>
              <Button size="sm" variant="outline" asChild>
                <a href={`https://wa.me/${normalizePhone(customer.phone)}?text=${encodeURIComponent(`Halo ${customer.name}, terima kasih telah menjadi pelanggan ${storeName || ""}.`)}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Kunjungan", value: formatNum(customer.visits), icon: Repeat, sub: `Terakhir ${formatDate(customer.lastVisit)}` },
              { label: "Total Belanja", value: formatIDR(customer.totalSpend), icon: Wallet, sub: "Akumulasi transaksi" },
              { label: "Poin Pelanggan", value: formatNum(loyalty.balance), icon: Star, sub: `Setara ${formatIDR(loyalty.value)}` },
              { label: "Kategori / Tier", value: TIERS[loyalty.tier].label, icon: Award, sub: `${customer.segmentLabel} · ${formatNum(loyalty.earned)} poin diperoleh` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-semibold mt-1 tabular-nums">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                    </div>
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Data Pelanggan</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {info.map((i) => (
                <div key={i.label} className="flex items-start gap-2">
                  <i.icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{i.label}</p>
                    <p className="text-sm font-medium break-words">{i.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Poin</CardTitle></CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada mutasi poin manual.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Poin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{formatDate(l.created_at)}</TableCell>
                        <TableCell className="text-sm capitalize">{l.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.description || "-"}</TableCell>
                        <TableCell className={`text-right tabular-nums ${Number(l.points) < 0 || l.type === "redeem" ? "text-destructive" : ""}`}>
                          {l.type === "redeem" ? `-${formatNum(Math.abs(Number(l.points)))}` : formatNum(Number(l.points))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Riwayat Transaksi ({history.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>BID</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((t, i) => (
                      <TableRow key={`${t.bid || t.date}-${i}`} className={t.id ? "cursor-pointer hover:bg-muted/50" : ""} onClick={() => openTxn(t)}>
                        <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {t.bid ? (
                            <button type="button" className="text-primary font-medium hover:underline" onClick={(e) => { e.stopPropagation(); openTxn(t); }}>
                              {t.bid}
                            </button>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.source === "booking" ? "Booking" : "POS"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground uppercase">{t.status || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatIDR(t.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Belum ada transaksi.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
      <TransactionBidPopup
        open={!!bidPreview}
        onClose={() => setBidPreview(null)}
        type="booking"
        data={bidPreview}
        onEdit={() => setBidPreview(null)}
      />
    </Dialog>
  );
}
