import { useEffect, useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Copy, CreditCard, ExternalLink, Info, Loader2, LockKeyhole, Save, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { functionErrorMessage, userFacingError } from "@/utils/userFacingError";

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

type Settings = { enabled: boolean; environment: string; clientId: string; channels: string[]; timeouts: Record<string, number> };
const initial: Settings = { enabled: false, environment: "sandbox", clientId: "", channels: [], timeouts: {} };
const DEFAULT_TIMEOUT_MINUTES = 60;

export default function DokuSettings() {
  const { currentStore } = useStore();
  const [draft, setDraft] = useState<Settings>(initial);
  const [saved, setSaved] = useState<Settings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [secretKey, setSecretKey] = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!currentStore?.id) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setSecretKey("");
    setConfigured(false);
    void (async () => {
      // Explicit projection: stored secrets must never be read into this page.
      const { data, error } = await supabase.from("website_payment_settings")
        .select("doku_enabled,doku_environment,doku_client_id,doku_channels,doku_channel_timeouts")
        .eq("store_id", currentStore.id).maybeSingle();
      if (!active) return;
      if (error) {
        setLoadFailed(true);
        toast.error(userFacingError(error, "Pengaturan DOKU belum dapat dimuat. Silakan coba lagi."));
      } else {
        const value: Settings = data ? {
          enabled: data.doku_enabled, environment: data.doku_environment === "live" ? "live" : "sandbox",
          clientId: data.doku_client_id || "", channels: Array.isArray(data.doku_channels) ? data.doku_channels.filter((v): v is string => typeof v === "string") : [],
          timeouts: data.doku_channel_timeouts && typeof data.doku_channel_timeouts === "object" && !Array.isArray(data.doku_channel_timeouts)
            ? Object.fromEntries(Object.entries(data.doku_channel_timeouts as Record<string, unknown>).map(([code, value]) => [code, Number(value)]).filter(([, value]) => Number.isFinite(value as number))) : {},
        } : initial;
        setDraft(value);
        setSaved(value);
        const result = await supabase.functions.invoke("doku-connection", { body: { store_id: currentStore.id } });
        if (active) setConfigured(!result.error && !!result.data?.configured);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentStore?.id, reload]);

  const save = async () => {
    if (!currentStore?.id || saving || loadFailed) return;
    const missing = draft.channels.filter((code) => !Number.isInteger(draft.timeouts[code]) || draft.timeouts[code] < 1 || draft.timeouts[code] > 1440);
    if (missing.length) {
      toast.error("Atur batas waktu pembayaran (1–1440 menit) untuk setiap metode yang diaktifkan.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("doku-connection", { body: {
        action: "save", store_id: currentStore.id, enabled: draft.enabled, environment: draft.environment,
        client_id: draft.clientId.trim(), secret_key: secretKey.trim(), channels: draft.channels,
        timeouts: Object.fromEntries(draft.channels.map((code) => [code, draft.timeouts[code]])),
      } });
      if (error || data?.error) {
        toast.error(await functionErrorMessage(error, data, "Pengaturan DOKU belum tersimpan. Periksa isian lalu coba lagi."));
        return;
      }
      setSecretKey("");
      setConfigured(!!data?.configured);
      const value = { ...draft, clientId: draft.clientId.trim() };
      setDraft(value);
      setSaved(value);
      toast.success("Pengaturan DOKU outlet disimpan");
    } catch (error) {
      toast.error(userFacingError(error, "Pengaturan DOKU belum tersimpan. Silakan coba lagi atau hubungi admin."));
    } finally { setSaving(false); }
  };

  const removeCredentials = async () => {
    if (!currentStore?.id || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("doku-connection", { body: { action: "delete", store_id: currentStore.id, environment: draft.environment } });
      if (error || data?.error) {
        toast.error(await functionErrorMessage(error, data, "Kredensial DOKU belum terhapus. Silakan coba lagi."));
        return;
      }
      setSecretKey("");
      setConfigured(false);
      const cleared = { ...initial, environment: draft.environment };
      setDraft(cleared);
      setSaved(cleared);
      toast.success("Client ID dan Secret Key DOKU dihapus");
    } catch (error) {
      toast.error(userFacingError(error, "Kredensial DOKU belum terhapus. Silakan coba lagi."));
    } finally { setSaving(false); }
  };

  const toggleChannels = (codes: string[], on: boolean) => setDraft((value) => ({ ...value,
    channels: on ? [...new Set([...value.channels, ...codes])] : value.channels.filter((code) => !codes.includes(code)),
    timeouts: on ? { ...Object.fromEntries(codes.map((code) => [code, DEFAULT_TIMEOUT_MINUTES])), ...value.timeouts } : value.timeouts,
  }));
  const setTimeoutMinutes = (code: string, raw: string) => setDraft((value) => ({ ...value,
    timeouts: { ...value.timeouts, [code]: raw === "" ? NaN : Math.round(Number(raw.replace(/\D/g, ""))) },
  }));

  // Fixed display mask only: never fetch or submit the stored secret as an input value.
  const hasSavedSecret = configured && draft.environment === saved.environment && draft.clientId.trim() === saved.clientId;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (loadFailed) return <div className="space-y-4 py-8"><p>Pengaturan DOKU belum dapat dimuat.</p><Button variant="outline" onClick={() => setReload((v) => v + 1)}>Coba lagi</Button></div>;

  return <section className="space-y-6 rounded-lg border bg-card p-4 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" />Payment Gateway (DOKU)</h2><p className="mt-1 text-sm text-muted-foreground">{currentStore?.name}</p></div>
      <Button onClick={() => void save()} disabled={saving || (!secretKey && JSON.stringify(draft) === JSON.stringify(saved))}><Save className="mr-2 h-4 w-4" />{saving ? "Menyimpan..." : "Simpan"}</Button>
    </div>
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <Label htmlFor="doku-enabled">Aktifkan DOKU</Label>
      <Switch id="doku-enabled" checked={draft.enabled} disabled={saving} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{configured ? "Kredensial DOKU tersimpan. Pembayaran otomatis masih perlu diuji dan notifikasi pembayaran diaktifkan di DOKU." : "Masukkan Client ID dan Secret Key akun DOKU, pilih mode serta metode pembayaran, lalu Simpan."}</p></div>
    <Tabs defaultValue="credentials">
      <TabsList className="h-auto max-w-full flex-wrap gap-1">
        <TabsTrigger value="credentials">Kredensial DOKU</TabsTrigger><TabsTrigger value="methods">Metode Pembayaran</TabsTrigger><TabsTrigger value="connection">Cara Menghubungkan</TabsTrigger>
      </TabsList>
      <TabsContent value="credentials" className="mt-6 space-y-5">
        <fieldset disabled={saving} className="max-w-md space-y-5">
          <div className="space-y-2"><Label htmlFor="doku-mode">Mode</Label><Select value={draft.environment} onValueChange={(environment) => setDraft({ ...draft, environment })}><SelectTrigger id="doku-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sandbox">Sandbox (uji coba)</SelectItem><SelectItem value="live">Production (uang sungguhan)</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="doku-client">Client ID</Label><Input id="doku-client" autoComplete="off" value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} placeholder="Client ID dari akun DOKU" /></div>
          <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="doku-secret">Secret Key</Label>{hasSavedSecret && !secretKey && <span className="text-xs text-muted-foreground">Sudah tersimpan</span>}</div><div className="relative"><Input id="doku-secret" type="password" autoComplete="new-password" maxLength={512} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={hasSavedSecret ? "••••••••••••••••" : "Secret Key dari akun DOKU"} aria-describedby="doku-secret-note" className={`pr-10 ${hasSavedSecret ? "placeholder:text-foreground" : ""}`} /><LockKeyhole aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /></div><p id="doku-secret-note" className="text-xs text-muted-foreground">{hasSavedSecret ? "Secret Key sudah tersimpan dan tetap disensor. Isi hanya untuk mengganti; biarkan kosong untuk mempertahankan kunci tersimpan." : "Secret Key disimpan terenkripsi dan tidak ditampilkan kembali."}</p></div>
        </fieldset>
        {hasSavedSecret && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Hapus Client ID & Secret Key</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus kredensial DOKU?</AlertDialogTitle>
                <AlertDialogDescription>Client ID dan Secret Key outlet {currentStore?.name} akan dihapus permanen dan pembayaran DOKU dinonaktifkan. Anda dapat mengisinya kembali kapan saja.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeCredentials()}>Ya, hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TabsContent>
      <TabsContent value="methods" className="mt-6 space-y-5">
        {channelGroups.map((group) => {
          const codes = group.channels.map(([code]) => code);
          const allOn = codes.every((code) => draft.channels.includes(code));
          return <section key={group.name} className="border-b pb-4 last:border-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{group.name}</h3><Button variant="outline" size="sm" disabled={saving} onClick={() => toggleChannels(codes, !allOn)}>{allOn ? "Nonaktifkan semua" : "Aktifkan semua"}</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.channels.map(([code, name]) => <div key={code} className="py-2"><div className="flex items-center justify-between gap-3"><Label htmlFor={`doku-${code}`} className="text-sm">{name}</Label><Switch id={`doku-${code}`} disabled={saving} checked={draft.channels.includes(code)} onCheckedChange={(on) => toggleChannels([code], on)} /></div>
                {draft.channels.includes(code) && <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor={`doku-timeout-${code}`} className="text-xs text-muted-foreground whitespace-nowrap">Batas waktu bayar *</Label>
                  <Input id={`doku-timeout-${code}`} inputMode="numeric" disabled={saving} className={`h-8 w-20 text-right tabular-nums ${!(draft.timeouts[code] >= 1 && draft.timeouts[code] <= 1440) ? "border-destructive" : ""}`}
                    value={Number.isFinite(draft.timeouts[code]) ? String(draft.timeouts[code]) : ""} onChange={(event) => setTimeoutMinutes(code, event.target.value)} aria-describedby={`doku-timeout-hint-${code}`} />
                  <span id={`doku-timeout-hint-${code}`} className="text-xs text-muted-foreground">menit</span>
                </div>}
              </div>)}</div></section>;
        })}
      </TabsContent>
      <TabsContent value="connection" className="mt-6">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm leading-6">
          <Info className="mt-1 h-4 w-4 shrink-0 text-foreground" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground">Langkah Menghubungkan ANKA PMS dengan DOKU</h3>
            <ol className="mt-1 list-decimal space-y-2 pl-5 text-foreground">
              <li>Daftar / login ke DOKU Dashboard: <a href="https://dashboard.doku.com" target="_blank" rel="noopener noreferrer" className="break-words text-primary underline underline-offset-2">dashboard.doku.com<ExternalLink className="ml-1 inline h-3 w-3" /></a>.</li>
              <li>Untuk uji coba, buat akun Sandbox lewat <a href="https://sandbox.doku.com" target="_blank" rel="noopener noreferrer" className="break-words text-primary underline underline-offset-2">sandbox.doku.com<ExternalLink className="ml-1 inline h-3 w-3" /></a>.</li>
              <li>Masuk ke menu <strong>Settings → API Keys</strong> di DOKU. Salin <strong>Client ID</strong> dan <strong>Active Secret Key</strong> langsung ke tab “Kredensial DOKU” ANKA, pilih mode yang sesuai, aktifkan metode pembayaran, lalu klik <strong>Simpan</strong>.</li>
              <li>Di DOKU Dashboard, masuk ke menu <strong>Integration → Notification URL</strong>. Salin alamat penerima notifikasi ANKA PMS ini persis seperti tertulis:
                <div className="mt-2 flex items-center gap-2 rounded border border-border bg-muted px-3 py-2">
                  <code className="flex-1 break-all text-xs text-foreground">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-webhook`}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-webhook`).then(() => toast.success("Alamat notifikasi disalin")); }}><Copy className="mr-1 h-3 w-3" />Salin</Button>
                </div>
              </li>
              <li>Aktifkan metode pembayaran yang ingin diterima di tab “Metode Pembayaran”, lalu klik <strong>Simpan</strong>. Pilihan tersimpan untuk outlet ini, tetapi pembayaran DOKU belum aktif.</li>
              <li>Setelah koneksi dan notifikasi pembayaran diaktifkan serta diuji, booking online atau pembayaran POS dapat membuat tagihan DOKU sesuai metode yang dipilih pelanggan. Status <strong>LUNAS</strong> otomatis hanya dapat digunakan setelah konfirmasi pembayaran berhasil diterima dari DOKU.</li>
            </ol>
            <p className="mt-3 text-xs">Dokumentasi resmi: <a href="https://developers.doku.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">developers.doku.com<ExternalLink className="ml-1 inline h-3 w-3" /></a></p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </section>;
}