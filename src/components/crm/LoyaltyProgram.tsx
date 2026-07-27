import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award, Gift, Search, Settings2, Loader2, Save, Sparkles, History, Plus, Minus, Star,
} from "lucide-react";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

const TIERS: Record<TierKey, { label: string; className: string }> = {
  bronze: { label: "Bronze", className: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  silver: { label: "Silver", className: "bg-slate-400/20 text-slate-700 border-slate-400/40" },
  gold: { label: "Gold", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  platinum: { label: "Platinum", className: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

interface Settings {
  id?: string;
  is_enabled: boolean;
  earn_per_amount: number;
  points_per_earn: number;
  points_per_visit: number;
  redeem_point_value: number;
  min_redeem_points: number;
  tier_silver_points: number;
  tier_gold_points: number;
  tier_platinum_points: number;
  expiry_months: number;
}

const DEFAULTS: Settings = {
  is_enabled: true,
  earn_per_amount: 10000,
  points_per_earn: 1,
  points_per_visit: 0,
  redeem_point_value: 1000,
  min_redeem_points: 10,
  tier_silver_points: 100,
  tier_gold_points: 500,
  tier_platinum_points: 1000,
  expiry_months: 12,
};

interface Member {
  id: string;
  name: string;
  phone: string;
  visits: number;
  spend: number;
  lastVisit: string | null;
  earned: number;
  redeemed: number;
  adjusted: number;
  balance: number;
  tier: TierKey;
}

interface LedgerRow {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  type: string;
  points: number;
  amount: number;
  reference_bid: string | null;
  description: string | null;
  created_at: string;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const formatNum = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const normalizePhone = (p?: string | null) => (p || "").replace(/\D/g, "").replace(/^0/, "62");

export default function LoyaltyProgram() {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [customers, setCustomers] = useState<any[]>([]);
  const [txns, setTxns] = useState<{ phone: string; date: string; amount: number }[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | TierKey>("all");
  const [limit, setLimit] = useState(50);

  const [dialog, setDialog] = useState<{ member: Member; mode: "redeem" | "adjust" } | null>(null);
  const [points, setPoints] = useState(0);
  const [note, setNote] = useState("");
  const [adjustSign, setAdjustSign] = useState<"plus" | "minus">("plus");

  const load = async (silent = false) => {
    if (!currentStore?.id) return;
    if (!silent) setLoading(true);
    const [sRes, cRes, bRes, oRes, lRes] = await Promise.all([
      supabase.from("loyalty_settings").select("*").eq("store_id", currentStore.id).maybeSingle(),
      supabase.from("customers").select("id,name,phone").eq("store_id", currentStore.id),
      supabase.from("bookings").select("phone,date,price,status").eq("store_id", currentStore.id),
      supabase.from("booking_orders").select("customer_phone,date,total_amount,process_status").eq("store_id", currentStore.id),
      supabase.from("loyalty_transactions").select("*").eq("store_id", currentStore.id).order("created_at", { ascending: false }).limit(500),
    ]);

    if (sRes.data) setSettings({ ...DEFAULTS, ...(sRes.data as any) });

    const all: { phone: string; date: string; amount: number }[] = [];
    (bRes.data || []).forEach((b: any) => {
      if ((b.status || "").toUpperCase() === "BATAL") return;
      all.push({ phone: normalizePhone(b.phone), date: b.date, amount: Number(b.price) || 0 });
    });
    (oRes.data || []).forEach((o: any) => {
      if ((o.process_status || "") === "batal") return;
      all.push({ phone: normalizePhone(o.customer_phone), date: o.date, amount: Number(o.total_amount) || 0 });
    });

    setCustomers(cRes.data || []);
    setTxns(all);
    setLedger((lRes.data as LedgerRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!currentStore?.id) return;
    load();
    const channel = supabase
      .channel(`loyalty-${currentStore.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_transactions" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_settings" }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const tierOf = (balance: number): TierKey => {
    if (balance >= settings.tier_platinum_points) return "platinum";
    if (balance >= settings.tier_gold_points) return "gold";
    if (balance >= settings.tier_silver_points) return "silver";
    return "bronze";
  };

  const members: Member[] = useMemo(() => {
    const stat = new Map<string, { visits: number; spend: number; last: string | null }>();
    txns.forEach((t) => {
      if (!t.phone) return;
      const cur = stat.get(t.phone) || { visits: 0, spend: 0, last: null };
      cur.visits += 1;
      cur.spend += t.amount;
      if (!cur.last || t.date > cur.last) cur.last = t.date;
      stat.set(t.phone, cur);
    });

    const manual = new Map<string, { redeemed: number; adjusted: number }>();
    ledger.forEach((l) => {
      const key = normalizePhone(l.customer_phone);
      if (!key) return;
      const cur = manual.get(key) || { redeemed: 0, adjusted: 0 };
      if (l.type === "redeem") cur.redeemed += Math.abs(Number(l.points) || 0);
      else if (l.type === "expire") cur.redeemed += Math.abs(Number(l.points) || 0);
      else cur.adjusted += Number(l.points) || 0;
      manual.set(key, cur);
    });

    const perAmount = Math.max(settings.earn_per_amount || 1, 1);

    return customers.map((c) => {
      const key = normalizePhone(c.phone);
      const s = stat.get(key) || { visits: 0, spend: 0, last: null };
      const m = manual.get(key) || { redeemed: 0, adjusted: 0 };
      const earned =
        Math.floor(s.spend / perAmount) * (settings.points_per_earn || 0) +
        s.visits * (settings.points_per_visit || 0);
      const balance = Math.max(earned + m.adjusted - m.redeemed, 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        visits: s.visits,
        spend: s.spend,
        lastVisit: s.last,
        earned,
        redeemed: m.redeemed,
        adjusted: m.adjusted,
        balance,
        tier: tierOf(balance),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, txns, ledger, settings]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.balance > 0);
    const outstanding = active.reduce((s, m) => s + m.balance, 0);
    return {
      members: active.length,
      outstanding,
      liability: outstanding * (settings.redeem_point_value || 0),
      redeemed: ledger.filter((l) => l.type === "redeem").reduce((s, l) => s + Math.abs(Number(l.points) || 0), 0),
    };
  }, [members, ledger, settings.redeem_point_value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => (tierFilter === "all" || m.tier === tierFilter) &&
        (!q || m.name.toLowerCase().includes(q) || (m.phone || "").includes(q)))
      .sort((a, b) => b.balance - a.balance);
  }, [members, search, tierFilter]);

  const saveSettings = async () => {
    if (!currentStore?.id) return;
    setSaving(true);
    const payload = { ...settings, store_id: currentStore.id } as any;
    delete payload.created_at;
    delete payload.updated_at;
    const { error } = await supabase.from("loyalty_settings").upsert(payload, { onConflict: "store_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pengaturan poin tersimpan" });
    load(true);
  };

  const openDialog = (member: Member, mode: "redeem" | "adjust") => {
    setDialog({ member, mode });
    setPoints(0);
    setNote("");
    setAdjustSign("plus");
  };

  const submitDialog = async () => {
    if (!dialog || !currentStore?.id) return;
    const { member, mode } = dialog;
    const value = Math.abs(points);
    if (!value) {
      toast({ title: "Jumlah poin belum diisi", variant: "destructive" });
      return;
    }
    if (mode === "redeem") {
      if (value < settings.min_redeem_points) {
        toast({ title: `Minimal penukaran ${formatNum(settings.min_redeem_points)} poin`, variant: "destructive" });
        return;
      }
      if (value > member.balance) {
        toast({ title: "Poin tidak mencukupi", variant: "destructive" });
        return;
      }
    }
    if (mode === "adjust" && adjustSign === "minus" && value > member.balance) {
      toast({ title: "Poin tidak mencukupi", variant: "destructive" });
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const signedPoints = mode === "redeem" ? -value : adjustSign === "minus" ? -value : value;
    const { error } = await supabase.from("loyalty_transactions").insert({
      store_id: currentStore.id,
      customer_id: member.id,
      customer_name: member.name,
      customer_phone: member.phone,
      type: mode === "redeem" ? "redeem" : "adjust",
      points: mode === "redeem" ? value : signedPoints,
      amount: mode === "redeem" ? value * (settings.redeem_point_value || 0) : 0,
      description: note || (mode === "redeem" ? "Penukaran poin" : "Penyesuaian poin manual"),
      created_by: auth?.user?.id ?? null,
    });
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: mode === "redeem" ? "Poin berhasil ditukar" : "Poin berhasil disesuaikan",
      description: mode === "redeem" ? `Nilai tukar ${formatIDR(value * settings.redeem_point_value)}` : undefined,
    });
    setDialog(null);
    load(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { label: "Member Berpoin", value: formatNum(stats.members), icon: Award, sub: "Pelanggan dengan saldo poin" },
    { label: "Total Poin Beredar", value: formatNum(stats.outstanding), icon: Sparkles, sub: "Saldo poin aktif" },
    { label: "Nilai Poin (Liabilitas)", value: formatIDR(stats.liability), icon: Gift, sub: `1 poin = ${formatIDR(settings.redeem_point_value)}` },
    { label: "Poin Ditukar", value: formatNum(stats.redeemed), icon: Star, sub: "Akumulasi penukaran" },
  ];

  return (
    <div className="space-y-4">
      {!settings.is_enabled && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Program poin loyalitas sedang nonaktif. Aktifkan di tab Pengaturan agar poin pelanggan dihitung.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold mt-1 tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </div>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="member">
        <TabsList>
          <TabsTrigger value="member"><Award className="h-4 w-4 mr-1.5" /> Member Poin</TabsTrigger>
          <TabsTrigger value="riwayat"><History className="h-4 w-4 mr-1.5" /> Riwayat Poin</TabsTrigger>
          <TabsTrigger value="pengaturan"><Settings2 className="h-4 w-4 mr-1.5" /> Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="member" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Daftar Poin Pelanggan</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau telepon..." className="pl-9" />
                </div>
                <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tingkatan</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Tingkatan</TableHead>
                      <TableHead className="text-right">Kunjungan</TableHead>
                      <TableHead className="text-right">Total Belanja</TableHead>
                      <TableHead className="text-right">Poin Didapat</TableHead>
                      <TableHead className="text-right">Poin Terpakai</TableHead>
                      <TableHead className="text-right">Saldo Poin</TableHead>
                      <TableHead className="text-right">Nilai Tukar</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, limit).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{m.phone}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={TIERS[m.tier].className}>{TIERS[m.tier].label}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.visits}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatIDR(m.spend)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(m.earned + Math.max(m.adjusted, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(m.redeemed + Math.abs(Math.min(m.adjusted, 0)))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatNum(m.balance)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatIDR(m.balance * settings.redeem_point_value)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => openDialog(m, "redeem")}>
                            <Gift className="h-3.5 w-3.5 mr-1" /> Tukar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDialog(m, "adjust")}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Belum ada data poin.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > limit && (
                <div className="flex justify-center pt-3">
                  <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>
                    Tampilkan lebih banyak ({filtered.length - limit} lagi)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Riwayat Penukaran & Penyesuaian Poin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-right">Poin</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{formatDate(l.created_at)}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{l.customer_name || "-"}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{l.customer_phone}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={l.type === "redeem" ? "bg-rose-500/10 text-rose-700 border-rose-500/30" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"}>
                            {l.type === "redeem" ? "Tukar Poin" : l.type === "expire" ? "Kedaluwarsa" : "Penyesuaian"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${l.type === "redeem" || Number(l.points) < 0 ? "text-destructive" : ""}`}>
                          {l.type === "redeem" ? `-${formatNum(Math.abs(Number(l.points)))}` : formatNum(Number(l.points))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(l.amount) ? formatIDR(Number(l.amount)) : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {ledger.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Belum ada riwayat poin.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengaturan" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Aturan Program Poin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Aktifkan Program Poin</p>
                  <p className="text-xs text-muted-foreground">Poin dihitung otomatis dari transaksi kamar dan POS.</p>
                </div>
                <Switch checked={settings.is_enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Poin per Belanja (Rp)</Label>
                  <MoneyInput value={settings.earn_per_amount} onChange={(v) => setSettings((s) => ({ ...s, earn_per_amount: v }))} />
                  <p className="text-xs text-muted-foreground">Setiap belanja sejumlah ini menghasilkan poin.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jumlah Poin Didapat</Label>
                  <Input type="number" value={settings.points_per_earn} onChange={(e) => setSettings((s) => ({ ...s, points_per_earn: Number(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">Poin per kelipatan belanja di atas.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Poin per Kunjungan</Label>
                  <Input type="number" value={settings.points_per_visit} onChange={(e) => setSettings((s) => ({ ...s, points_per_visit: Number(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">Bonus poin setiap satu transaksi/kedatangan.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nilai 1 Poin (Rp)</Label>
                  <MoneyInput value={settings.redeem_point_value} onChange={(v) => setSettings((s) => ({ ...s, redeem_point_value: v }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Minimal Penukaran (poin)</Label>
                  <Input type="number" value={settings.min_redeem_points} onChange={(e) => setSettings((s) => ({ ...s, min_redeem_points: Number(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Masa Berlaku Poin (bulan)</Label>
                  <Input type="number" value={settings.expiry_months} onChange={(e) => setSettings((s) => ({ ...s, expiry_months: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Ambang Tingkatan Member</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Silver (poin)</Label>
                    <Input type="number" value={settings.tier_silver_points} onChange={(e) => setSettings((s) => ({ ...s, tier_silver_points: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gold (poin)</Label>
                    <Input type="number" value={settings.tier_gold_points} onChange={(e) => setSettings((s) => ({ ...s, tier_gold_points: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Platinum (poin)</Label>
                    <Input type="number" value={settings.tier_platinum_points} onChange={(e) => setSettings((s) => ({ ...s, tier_platinum_points: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Simpan Pengaturan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "redeem" ? "Tukar Poin" : "Penyesuaian Poin"} — {dialog?.member.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Saldo poin</span>
              <span className="font-semibold tabular-nums">
                {formatNum(dialog?.member.balance || 0)} poin · {formatIDR((dialog?.member.balance || 0) * settings.redeem_point_value)}
              </span>
            </div>

            {dialog?.mode === "adjust" && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={adjustSign === "plus" ? "default" : "outline"} onClick={() => setAdjustSign("plus")}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah
                </Button>
                <Button type="button" variant={adjustSign === "minus" ? "default" : "outline"} onClick={() => setAdjustSign("minus")}>
                  <Minus className="h-4 w-4 mr-1" /> Kurangi
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Jumlah Poin</Label>
              <Input type="number" value={points || ""} onChange={(e) => setPoints(Number(e.target.value) || 0)} placeholder="0" />
              {dialog?.mode === "redeem" && (
                <p className="text-xs text-muted-foreground">
                  Setara {formatIDR(points * settings.redeem_point_value)} · minimal {formatNum(settings.min_redeem_points)} poin
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Keterangan</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Contoh: potongan harga kamar / hadiah" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={submitDialog}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
