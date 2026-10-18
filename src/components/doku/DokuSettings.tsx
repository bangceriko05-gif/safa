import { useEffect, useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CreditCard, Loader2, LockKeyhole, Save } from "lucide-react";
import { toast } from "sonner";
import { userFacingError } from "@/utils/userFacingError";

const channelGroups = [
  { name: "Transfer Bank (Virtual Account)", channels: [
    ["VIRTUAL_ACCOUNT_BCA", "BCA"], ["VIRTUAL_ACCOUNT_BANK_MANDIRI", "Mandiri"],
    ["VIRTUAL_ACCOUNT_BNI", "BNI"], ["VIRTUAL_ACCOUNT_BRI", "BRI"],
    ["VIRTUAL_ACCOUNT_BANK_PERMATA", "Permata"], ["VIRTUAL_ACCOUNT_BANK_CIMB", "CIMB Niaga"],
    ["VIRTUAL_ACCOUNT_BANK_DANAMON", "Danamon"], ["VIRTUAL_ACCOUNT_BSI", "BSI"],
    ["VIRTUAL_ACCOUNT_DOKU", "DOKU Virtual Account"],
  ] },
  { name: "QRIS", channels: [["QRIS", "QRIS"]] },
  { name: "Retail / Gerai", channels: [["ONLINE_TO_OFFLINE_ALFA", "Alfamart / Alfamidi / Dan+Dan"], ["ONLINE_TO_OFFLINE_INDOMARET", "Indomaret"]] },
  { name: "E-Wallet", channels: [["EMONEY_OVO", "OVO"], ["EMONEY_DANA", "DANA"], ["EMONEY_SHOPEE_PAY", "ShopeePay"], ["EMONEY_LINKAJA", "LinkAja"], ["EMONEY_DOKU", "DOKU e-Wallet"]] },
  { name: "Kartu Kredit / Debit", channels: [["CREDIT_CARD", "Visa, Mastercard, JCB"]] },
  { name: "Paylater", channels: [["PEER_TO_PEER_AKULAKU", "Akulaku"], ["PEER_TO_PEER_KREDIVO", "Kredivo"], ["PEER_TO_PEER_INDODANA", "Indodana"]] },
];

type Settings = { enabled: boolean; environment: string; clientId: string; channels: string[] };
const initial: Settings = { enabled: false, environment: "sandbox", clientId: "", channels: [] };

export default function DokuSettings() {
  const { currentStore } = useStore();
  const [draft, setDraft] = useState<Settings>(initial);
  const [saved, setSaved] = useState<Settings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!currentStore?.id) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void (async () => {
      // Explicit projection: stored secrets must never be read into this page.
      const { data, error } = await supabase.from("website_payment_settings")
        .select("doku_enabled,doku_environment,doku_client_id,doku_channels")
        .eq("store_id", currentStore.id).maybeSingle();
      if (!active) return;
      if (error) {
        setLoadFailed(true);
        toast.error(userFacingError(error, "Pengaturan DOKU belum dapat dimuat. Silakan coba lagi."));
      } else {
        const value: Settings = data ? {
          enabled: data.doku_enabled, environment: data.doku_environment === "live" ? "live" : "sandbox",
          clientId: data.doku_client_id || "", channels: Array.isArray(data.doku_channels) ? data.doku_channels.filter((v): v is string => typeof v === "string") : [],
        } : initial;
        setDraft(value);
        setSaved(value);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentStore?.id, reload]);

  const save = async () => {
    if (!currentStore?.id || saving || loadFailed) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("website_payment_settings").upsert({
        store_id: currentStore.id, doku_enabled: draft.enabled, doku_environment: draft.environment,
        doku_client_id: draft.clientId.trim() || null, doku_channels: draft.channels,
      }, { onConflict: "store_id" });
      if (error) throw error;
      const value = { ...draft, clientId: draft.clientId.trim() };
      setDraft(value);
      setSaved(value);
      toast.success("Pengaturan DOKU outlet disimpan");
    } catch (error) {
      toast.error(userFacingError(error, "Pengaturan DOKU belum tersimpan. Silakan coba lagi atau hubungi admin."));
    } finally { setSaving(false); }
  };

  const toggleChannels = (codes: string[], on: boolean) => setDraft((value) => ({ ...value,
    channels: on ? [...new Set([...value.channels, ...codes])] : value.channels.filter((code) => !codes.includes(code)),
  }));

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (loadFailed) return <div className="space-y-4 py-8"><p>Pengaturan DOKU belum dapat dimuat.</p><Button variant="outline" onClick={() => setReload((v) => v + 1)}>Coba lagi</Button></div>;

  return <section className="space-y-6 rounded-lg border bg-card p-4 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" />Payment Gateway (DOKU)</h2><p className="mt-1 text-sm text-muted-foreground">{currentStore?.name}</p></div>
      <Button onClick={() => void save()} disabled={saving || JSON.stringify(draft) === JSON.stringify(saved)}><Save className="mr-2 h-4 w-4" />{saving ? "Menyimpan..." : "Simpan"}</Button>
    </div>
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <Label htmlFor="doku-enabled">Aktifkan DOKU</Label>
      <Switch id="doku-enabled" checked={draft.enabled} disabled={saving} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Koneksi pembayaran DOKU belum tersedia. Pengaturan ini belum mengarahkan pembayaran booking atau POS ke DOKU; metode pembayaran saat ini tetap digunakan.</p></div>
    <Tabs defaultValue="credentials">
      <TabsList className="h-auto max-w-full flex-wrap gap-1">
        <TabsTrigger value="credentials">Kredensial DOKU</TabsTrigger><TabsTrigger value="methods">Metode Pembayaran</TabsTrigger><TabsTrigger value="connection">Cara Menghubungkan</TabsTrigger>
      </TabsList>
      <TabsContent value="credentials" className="mt-6 space-y-5">
        <fieldset disabled={saving} className="max-w-md space-y-5">
          <div className="space-y-2"><Label htmlFor="doku-mode">Mode</Label><Select value={draft.environment} onValueChange={(environment) => setDraft({ ...draft, environment })}><SelectTrigger id="doku-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sandbox">Sandbox (uji coba)</SelectItem><SelectItem value="live">Production (uang sungguhan)</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="doku-client">Client ID</Label><Input id="doku-client" autoComplete="off" value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} placeholder="Client ID dari akun DOKU" /></div>
          <div className="space-y-2"><Label htmlFor="doku-secret">Secret Key</Label><div className="relative"><Input id="doku-secret" disabled placeholder="Dikelola melalui penyimpanan rahasia" className="pr-10" /><LockKeyhole className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Secret Key tidak dibaca atau ditampilkan pada halaman ini.</p></div>
        </fieldset>
      </TabsContent>
      <TabsContent value="methods" className="mt-6 space-y-5">
        {channelGroups.map((group) => {
          const codes = group.channels.map(([code]) => code);
          const allOn = codes.every((code) => draft.channels.includes(code));
          return <section key={group.name} className="border-b pb-4 last:border-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{group.name}</h3><Button variant="outline" size="sm" disabled={saving} onClick={() => toggleChannels(codes, !allOn)}>{allOn ? "Nonaktifkan semua" : "Aktifkan semua"}</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.channels.map(([code, name]) => <div key={code} className="flex items-center justify-between gap-3 py-2"><Label htmlFor={`doku-${code}`} className="text-sm">{name}</Label><Switch id={`doku-${code}`} disabled={saving} checked={draft.channels.includes(code)} onCheckedChange={(on) => toggleChannels([code], on)} /></div>)}</div></section>;
        })}
      </TabsContent>
      <TabsContent value="connection" className="mt-6 max-w-2xl space-y-4 text-sm">
        <h3 className="font-semibold">Status koneksi: belum terhubung</h3>
        <p className="text-muted-foreground">Client ID tersedia di akun bisnis DOKU. Secret Key harus ditambahkan melalui formulir rahasia yang aman, bukan melalui percakapan atau kolom biasa.</p>
        <p className="text-muted-foreground">Penerimaan pembayaran dan sinkronisasi transaksi memerlukan sambungan DOKU beserta notifikasi pembayaran yang belum diaktifkan.</p>
      </TabsContent>
    </Tabs>
  </section>;
}