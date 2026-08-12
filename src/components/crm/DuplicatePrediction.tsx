import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  GitMerge, Search, Users, Phone, CalendarDays, Repeat, ArrowRight, AlertTriangle, ShieldCheck, Sparkles,
} from "lucide-react";

export interface DupCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  birth_date: string | null;
  domicile: string | null;
  identity_type: string | null;
  identity_number: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customers: DupCustomer[];
  storeId?: string;
  onMerged: () => void;
}

const normPhone = (p?: string | null) => (p || "").replace(/\D/g, "").replace(/^0/, "62");
const normName = (n?: string | null) =>
  (n || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[la][lb] / Math.max(la, lb);
}

function isSimilar(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  const setA = new Set(ta), setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t) && t.length > 2).length;
  if (shared > 0 && (shared === setA.size || shared === setB.size)) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return similarity(a, b) >= 0.86;
}

type Stat = { txns: number; spend: number; last: string | null };

export default function DuplicatePrediction({ open, onOpenChange, customers, storeId, onMerged }: Props) {
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [nameStats, setNameStats] = useState<Record<string, Stat>>({});
  const [query, setQuery] = useState("");
  const [merge, setMerge] = useState<{ from: DupCustomer; to: DupCustomer } | null>(null);
  const [mergeHistory, setMergeHistory] = useState(true);
  const [deleteSource, setDeleteSource] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !storeId) return;
    (async () => {
      const [b, o] = await Promise.all([
        supabase.from("bookings").select("customer_name,phone,date,price,status").eq("store_id", storeId),
        supabase.from("booking_orders").select("customer_name,customer_phone,date,total_amount,process_status").eq("store_id", storeId),
      ]);
      const byPhone: Record<string, Stat> = {};
      const byName: Record<string, Stat> = {};
      const push = (map: Record<string, Stat>, key: string, amount: number, date: string) => {
        if (!key) return;
        const s = map[key] || { txns: 0, spend: 0, last: null };
        s.txns += 1; s.spend += amount;
        if (!s.last || (date && date > s.last)) s.last = date;
        map[key] = s;
      };
      (b.data || []).forEach((r: any) => {
        if ((r.status || "").toUpperCase() === "BATAL") return;
        push(byPhone, normPhone(r.phone), Number(r.price) || 0, r.date);
        push(byName, normName(r.customer_name), Number(r.price) || 0, r.date);
      });
      (o.data || []).forEach((r: any) => {
        if ((r.process_status || "") === "batal") return;
        push(byPhone, normPhone(r.customer_phone), Number(r.total_amount) || 0, r.date);
        push(byName, normName(r.customer_name), Number(r.total_amount) || 0, r.date);
      });
      setStats(byPhone);
      setNameStats(byName);
    })();
  }, [open, storeId]);

  const statOf = (c: DupCustomer): Stat => {
    const p = normPhone(c.phone);
    return (p && stats[p]) || nameStats[normName(c.name)] || { txns: 0, spend: 0, last: null };
  };

  const groups = useMemo(() => {
    const out: { key: string; type: "phone" | "name"; members: DupCustomer[] }[] = [];
    const used = new Set<string>();

    const byPhone: Record<string, DupCustomer[]> = {};
    customers.forEach((c) => {
      const p = normPhone(c.phone);
      if (p.length >= 8) (byPhone[p] ||= []).push(c);
    });
    Object.entries(byPhone).forEach(([p, list]) => {
      if (list.length > 1) {
        out.push({ key: `p-${p}`, type: "phone", members: list });
        list.forEach((c) => used.add(c.id));
      }
    });

    const rest = customers.filter((c) => !used.has(c.id));
    const buckets: Record<string, DupCustomer[]> = {};
    rest.forEach((c) => {
      const n = normName(c.name);
      if (!n) return;
      (buckets[n[0]] ||= []).push(c);
    });
    Object.values(buckets).forEach((list) => {
      const seen = new Set<string>();
      list.forEach((c) => {
        if (seen.has(c.id)) return;
        const n = normName(c.name);
        const members = list.filter((o) => !seen.has(o.id) && (o.id === c.id || isSimilar(n, normName(o.name))));
        if (members.length > 1) {
          members.forEach((m) => seen.add(m.id));
          out.push({ key: `n-${c.id}`, type: "name", members });
        }
      });
    });

    return out.sort((a, b) => b.members.length - a.members.length);
  }, [customers]);

  const visibleGroups = useMemo(() => {
    const q = normName(query);
    return groups
      .filter((g) => !skipped.has(g.key))
      .filter((g) => !q || g.members.some((m) => normName(m.name).includes(q) || normPhone(m.phone).includes(query.replace(/\D/g, ""))));
  }, [groups, query, skipped]);

  const totalDup = groups.reduce((s, g) => s + g.members.length - 1, 0);

  const runMerge = async () => {
    if (!merge) return;
    setSaving(true);
    try {
      const { from, to } = merge;
      if (mergeHistory) {
        const fromPhone = from.phone;
        await Promise.all([
          supabase.from("bookings").update({ customer_name: to.name, phone: to.phone })
            .eq("store_id", storeId || "").eq("customer_name", from.name),
          supabase.from("booking_orders").update({ customer_name: to.name, customer_phone: to.phone })
            .eq("store_id", storeId || "").eq("customer_name", from.name),
          fromPhone
            ? supabase.from("bookings").update({ customer_name: to.name, phone: to.phone })
                .eq("store_id", storeId || "").eq("phone", fromPhone)
            : Promise.resolve({} as any),
          fromPhone
            ? supabase.from("booking_orders").update({ customer_name: to.name, customer_phone: to.phone })
                .eq("store_id", storeId || "").eq("customer_phone", fromPhone)
            : Promise.resolve({} as any),
        ]);
      }

      const patch: Record<string, any> = {};
      if (!to.email && from.email) patch.email = from.email;
      if (!to.birth_date && from.birth_date) patch.birth_date = from.birth_date;
      if (!to.domicile && from.domicile) patch.domicile = from.domicile;
      if (!to.identity_number && from.identity_number) {
        patch.identity_number = from.identity_number;
        patch.identity_type = from.identity_type;
      }
      if (!to.phone && from.phone) patch.phone = from.phone;
      if (from.notes) patch.notes = [to.notes, from.notes].filter(Boolean).join(" | ");
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("customers").update(patch).eq("id", to.id);
        if (error) throw error;
      }

      if (deleteSource) {
        const { error } = await supabase.from("customers").delete().eq("id", from.id);
        if (error) throw error;
      }

      toast.success(`Data "${from.name}" digabungkan ke "${to.name}"`);
      setMerge(null);
      onMerged();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menggabungkan data");
    } finally {
      setSaving(false);
    }
  };

  const fieldsToCopy = (from: DupCustomer, to: DupCustomer) => {
    const f: string[] = [];
    if (!to.phone && from.phone) f.push("Nomor HP");
    if (!to.email && from.email) f.push("Email");
    if (!to.birth_date && from.birth_date) f.push("Tanggal Lahir");
    if (!to.domicile && from.domicile) f.push("Domisili");
    if (!to.identity_number && from.identity_number) f.push("Identitas");
    if (from.notes) f.push("Catatan digabungkan");
    return f;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Prediksi Ganda
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Deteksi otomatis pelanggan dengan nama mirip atau nomor HP sama agar database tetap ringkas.
            </p>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Pelanggan", value: customers.length, icon: Users, tone: "text-foreground" },
                { label: "Grup Terdeteksi", value: groups.length, icon: AlertTriangle, tone: "text-amber-600" },
                { label: "Potensi Duplikat", value: totalDup, icon: GitMerge, tone: "text-destructive" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
                    </div>
                    <s.icon className={`h-5 w-5 ${s.tone}`} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari nama atau nomor HP dalam hasil prediksi..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {visibleGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-600 mb-3" />
                <p className="font-medium">Tidak ada indikasi data ganda</p>
                <p className="text-sm text-muted-foreground">Database pelanggan terlihat bersih.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleGroups.map((g) => {
                  const sorted = [...g.members].sort((a, b) => statOf(b).txns - statOf(a).txns);
                  const primary = sorted[0];
                  return (
                    <div key={g.key} className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={g.type === "phone"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
                            {g.type === "phone" ? "NOMOR HP SAMA" : "NAMA MIRIP"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{g.members.length} data</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setSkipped((p) => new Set(p).add(g.key))}>
                          Lewati
                        </Button>
                      </div>
                      <div className="divide-y">
                        {sorted.map((m) => {
                          const st = statOf(m);
                          return (
                            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-[220px]">
                                <button
                                  type="button"
                                  className="text-sm font-medium text-primary hover:underline text-left"
                                  onClick={() => {
                                    const target = m.id === primary.id ? (sorted[1] || primary) : primary;
                                    setMergeHistory(true);
                                    setDeleteSource(true);
                                    setMerge({ from: m, to: target });
                                  }}
                                >
                                  {m.name}
                                </button>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{m.phone || "-"}</span>
                                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(st.last)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 tabular-nums"><Repeat className="h-3 w-3" />{st.txns} transaksi</span>
                                <span className="tabular-nums font-medium text-foreground">{formatIDR(st.spend)}</span>
                                {m.id === primary.id && (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Utama</Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant={m.id === primary.id ? "outline" : "default"}
                                  onClick={() => {
                                    const target = m.id === primary.id ? (sorted[1] || primary) : primary;
                                    setMergeHistory(true);
                                    setDeleteSource(true);
                                    setMerge({ from: m, to: target });
                                  }}
                                >
                                  <GitMerge className="h-3.5 w-3.5 mr-1" /> Merge
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!merge} onOpenChange={(o) => !o && setMerge(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitMerge className="h-4 w-4 text-primary" /> Gabungkan Data Pelanggan
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Semua histori transaksi akan dihitung sebagai satu pelanggan.</p>
          </DialogHeader>

          {merge && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                  <p className="text-[11px] font-semibold text-destructive">DARI</p>
                  <p className="text-sm font-medium">{merge.from.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{merge.from.phone || "-"}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[11px] font-semibold text-primary">KE</p>
                  <p className="text-sm font-medium">{merge.to.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{merge.to.phone || "-"}</p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setMerge({ from: merge.to, to: merge.from })}
              >
                Tukar arah penggabungan
              </Button>

              {fieldsToCopy(merge.from, merge.to).length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">FIELD YANG AKAN DIISI KE TARGET</p>
                  <ul className="text-xs text-emerald-800 space-y-0.5">
                    {fieldsToCopy(merge.from, merge.to).map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">OPSI MERGE</p>
                <label className="flex gap-3 rounded-lg border p-3 cursor-pointer">
                  <Checkbox checked={mergeHistory} onCheckedChange={(v) => setMergeHistory(!!v)} className="mt-0.5" />
                  <span>
                    <span className="text-sm font-medium block">Gabungkan histori transaksi</span>
                    <span className="text-xs text-muted-foreground">
                      Semua transaksi atas nama "{merge.from.name}" diubah menjadi "{merge.to.name}".
                    </span>
                  </span>
                </label>
                <label className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 cursor-pointer">
                  <Checkbox checked={deleteSource} onCheckedChange={(v) => setDeleteSource(!!v)} className="mt-0.5" />
                  <span>
                    <span className="text-sm font-medium block">Hapus data duplikat</span>
                    <span className="text-xs text-muted-foreground">
                      Hapus "{merge.from.name}" dari daftar pelanggan setelah merge.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setMerge(null)} disabled={saving}>Batal</Button>
                <Button onClick={runMerge} disabled={saving || merge.from.id === merge.to.id}>
                  <GitMerge className="h-4 w-4 mr-1" /> {saving ? "Menggabungkan..." : "Ya, Gabungkan"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
