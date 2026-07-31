import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoyaltyProgram from "./LoyaltyProgram";
import CustomerDetailDialog, { DetailCustomer } from "./CustomerDetailDialog";
import {
  Users, UserPlus, Repeat, Wallet, Search, MessageCircle, Cake, Loader2, Crown, Clock, Award, LayoutDashboard,
} from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  domicile: string | null;
  created_at: string;
}

interface Txn {
  phone: string;
  name: string;
  date: string;
  amount: number;
  source: "booking" | "pos";
  bid?: string | null;
  status?: string | null;
  id?: string;
}

type Segment = "vip" | "loyal" | "baru" | "tidak_aktif";

interface CrmCustomer {
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
  segment: Segment;
}

const SEGMENT_META: Record<Segment, { label: string; className: string }> = {
  vip: { label: "VIP", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  loyal: { label: "Loyal", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  baru: { label: "Baru", className: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  tidak_aktif: { label: "Tidak Aktif", className: "bg-muted text-muted-foreground border-border" },
};

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const normalizePhone = (p?: string | null) => (p || "").replace(/\D/g, "").replace(/^0/, "62");

const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity;

export default function CRMDashboard({
  initialCustomerId,
  initialCustomerPhone,
  initialCustomerName,
}: { initialCustomerId?: string; initialCustomerPhone?: string; initialCustomerName?: string } = {}) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"all" | Segment>("all");
  const [sortBy, setSortBy] = useState<"spend" | "visits" | "recent" | "name">("spend");
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState<DetailCustomer | null>(null);
  const autoOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentStore?.id) return;
    let active = true;

    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      const [cRes, bRes, oRes] = await Promise.all([
        supabase.from("customers").select("id,name,phone,email,birth_date,domicile,created_at").eq("store_id", currentStore.id),
        supabase.from("bookings").select("id,customer_name,phone,date,price,status,bid").eq("store_id", currentStore.id),
        supabase.from("booking_orders").select("id,customer_name,customer_phone,date,total_amount,process_status,bid").eq("store_id", currentStore.id),
      ]);
      if (!active) return;

      const all: Txn[] = [];
      (bRes.data || []).forEach((b: any) => {
        if ((b.status || "").toUpperCase() === "BATAL") return;
        all.push({ phone: normalizePhone(b.phone), name: b.customer_name || "", date: b.date, amount: Number(b.price) || 0, source: "booking", bid: b.bid, status: b.status, id: b.id });
      });
      (oRes.data || []).forEach((o: any) => {
        if ((o.process_status || "") === "batal") return;
        all.push({ phone: normalizePhone(o.customer_phone), name: o.customer_name || "", date: o.date, amount: Number(o.total_amount) || 0, source: "pos", bid: o.bid, status: o.process_status, id: o.id });
      });

      setCustomers((cRes.data as CustomerRow[]) || []);
      setTxns(all);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`crm-${currentStore.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_orders" }, () => load(true))
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentStore?.id]);

  const crmCustomers: CrmCustomer[] = useMemo(() => {
    const byPhone = new Map<string, { visits: number; spend: number; last: string | null }>();
    txns.forEach((t) => {
      if (!t.phone) return;
      const cur = byPhone.get(t.phone) || { visits: 0, spend: 0, last: null };
      cur.visits += 1;
      cur.spend += t.amount;
      if (!cur.last || t.date > cur.last) cur.last = t.date;
      byPhone.set(t.phone, cur);
    });

    return customers.map((c) => {
      const stat = byPhone.get(normalizePhone(c.phone)) || { visits: 0, spend: 0, last: null };
      let seg: Segment;
      if (stat.visits >= 5) seg = "vip";
      else if (stat.visits >= 2) seg = "loyal";
      else seg = "baru";
      if (stat.visits > 0 && daysSince(stat.last) > 90) seg = "tidak_aktif";
      if (stat.visits === 0 && daysSince(c.created_at) > 90) seg = "tidak_aktif";

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        birth_date: c.birth_date,
        domicile: c.domicile,
        createdAt: c.created_at,
        visits: stat.visits,
        totalSpend: stat.spend,
        lastVisit: stat.last,
        segment: seg,
      };
    });
  }, [customers, txns]);

  const stats = useMemo(() => {
    const total = crmCustomers.length;
    const baru30 = crmCustomers.filter((c) => daysSince(c.createdAt) <= 30).length;
    const repeat = crmCustomers.filter((c) => c.visits >= 2).length;
    const revenue = crmCustomers.reduce((s, c) => s + c.totalSpend, 0);
    const withVisit = crmCustomers.filter((c) => c.visits > 0).length;
    return {
      total,
      baru30,
      repeat,
      repeatRate: withVisit ? Math.round((repeat / withVisit) * 100) : 0,
      revenue,
      avg: withVisit ? revenue / withVisit : 0,
    };
  }, [crmCustomers]);

  const birthdays = useMemo(() => {
    const m = new Date().getMonth();
    return crmCustomers
      .filter((c) => c.birth_date && new Date(c.birth_date).getMonth() === m)
      .sort((a, b) => new Date(a.birth_date!).getDate() - new Date(b.birth_date!).getDate());
  }, [crmCustomers]);

  const inactive = useMemo(
    () => crmCustomers.filter((c) => c.segment === "tidak_aktif" && c.visits > 0).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 8),
    [crmCustomers]
  );

  // Auto-open a customer detail when navigated here with a target customer id
  useEffect(() => {
    const key = initialCustomerId || initialCustomerPhone || initialCustomerName;
    if (!key || autoOpenedRef.current === key) return;
    if (crmCustomers.length === 0) return;
    const targetPhone = normalizePhone(initialCustomerPhone || "");
    const targetName = (initialCustomerName || "").trim().toLowerCase();
    const match =
      (initialCustomerId && crmCustomers.find((c) => c.id === initialCustomerId)) ||
      (targetPhone && crmCustomers.find((c) => normalizePhone(c.phone) === targetPhone)) ||
      (targetName && crmCustomers.find((c) => (c.name || "").trim().toLowerCase() === targetName));
    if (!match) return;
    autoOpenedRef.current = key;
    setSelected({
      ...match,
      segmentLabel: SEGMENT_META[match.segment].label,
      segmentClass: SEGMENT_META[match.segment].className,
    });
  }, [initialCustomerId, initialCustomerPhone, initialCustomerName, crmCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = crmCustomers.filter((c) => {
      if (segment !== "all" && c.segment !== segment) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.email || "").toLowerCase().includes(q);
    });
    rows = rows.sort((a, b) => {
      if (sortBy === "spend") return b.totalSpend - a.totalSpend;
      if (sortBy === "visits") return b.visits - a.visits;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.lastVisit || "").localeCompare(a.lastVisit || "");
    });
    return rows;
  }, [crmCustomers, search, segment, sortBy]);

  const waLink = (c: { phone: string; name: string }, text?: string) =>
    `https://wa.me/${normalizePhone(c.phone)}?text=${encodeURIComponent(
      text || `Halo ${c.name}, terima kasih telah menjadi pelanggan ${currentStore?.name || ""}. Ada penawaran spesial untuk Anda!`
    )}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Pelanggan", value: String(stats.total), icon: Users, sub: `${stats.baru30} baru 30 hari` },
    { label: "Pelanggan Repeat", value: String(stats.repeat), icon: Repeat, sub: `${stats.repeatRate}% repeat rate` },
    { label: "Total Nilai Pelanggan", value: formatIDR(stats.revenue), icon: Wallet, sub: "Akumulasi transaksi" },
    { label: "Rata-rata Belanja", value: formatIDR(stats.avg), icon: UserPlus, sub: "Per pelanggan aktif" },
  ];

  return (
    <Tabs defaultValue="ringkasan" className="space-y-4">
      <TabsList>
        <TabsTrigger value="ringkasan"><LayoutDashboard className="h-4 w-4 mr-1.5" /> Ringkasan CRM</TabsTrigger>
        <TabsTrigger value="loyalitas"><Award className="h-4 w-4 mr-1.5" /> Poin Loyalitas</TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="space-y-4 mt-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cake className="h-4 w-4 text-primary" /> Ulang Tahun Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {birthdays.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada ulang tahun bulan ini.</p>}
            {birthdays.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.birth_date)}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href={waLink(c, `Selamat ulang tahun ${c.name}! Ada hadiah spesial dari ${currentStore?.name || ""} untuk Anda.`)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Ucapkan
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Perlu Follow Up (&gt; 90 hari)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inactive.length === 0 && <p className="text-sm text-muted-foreground">Semua pelanggan masih aktif.</p>}
            {inactive.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Terakhir: {formatDate(c.lastVisit)} · {formatIDR(c.totalSpend)}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href={waLink(c, `Halo ${c.name}, sudah lama tidak berkunjung ke ${currentStore?.name || ""}. Kami punya penawaran khusus untuk Anda!`)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Hubungi
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Database Pelanggan</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, telepon, email..." className="pl-9" />
            </div>
            <Select value={segment} onValueChange={(v) => setSegment(v as any)}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Segmen</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="loyal">Loyal</SelectItem>
                <SelectItem value="baru">Baru</SelectItem>
                <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Belanja Tertinggi</SelectItem>
                <SelectItem value="visits">Kunjungan Terbanyak</SelectItem>
                <SelectItem value="recent">Kunjungan Terbaru</SelectItem>
                <SelectItem value="name">Nama A-Z</SelectItem>
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
                  <TableHead>Segmen</TableHead>
                  <TableHead className="text-right">Kunjungan</TableHead>
                  <TableHead className="text-right">Total Belanja</TableHead>
                  <TableHead>Terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, limit).map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setSelected({
                        ...c,
                        segmentLabel: SEGMENT_META[c.segment].label,
                        segmentClass: SEGMENT_META[c.segment].className,
                      })
                    }
                  >
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{c.phone}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SEGMENT_META[c.segment].className}>{SEGMENT_META[c.segment].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.visits}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatIDR(c.totalSpend)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.lastVisit)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={waLink(c)} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Tidak ada pelanggan.</TableCell>
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

      <TabsContent value="loyalitas" className="mt-0">
        <LoyaltyProgram />
      </TabsContent>

      <CustomerDetailDialog
        customer={selected}
        txns={txns}
        storeId={currentStore?.id}
        storeName={currentStore?.name}
        onClose={() => setSelected(null)}
      />
    </Tabs>
  );
}