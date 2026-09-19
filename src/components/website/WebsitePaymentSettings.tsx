import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Landmark, Loader2, QrCode, Save, Store, Wallet, CreditCard, Clock } from "lucide-react";
import PaymentMethodSettings from "@/components/PaymentMethodSettings";

const WEBSITE_INACTIVE_MESSAGE =
  "Mohon maaf, fitur website di outlet anda tidak aktif. Lakukan pembayaran tambahan untuk mengaktifkan fitur ini. Terima kasih";

type ChannelGroup = {
  title: string;
  icon: typeof Landmark;
  channels: { code: string; label: string }[];
};

const DOKU_CHANNEL_GROUPS: ChannelGroup[] = [
  {
    title: "Transfer Bank (Virtual Account)",
    icon: Landmark,
    channels: [
      { code: "VIRTUAL_ACCOUNT_BCA", label: "BCA Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BANK_MANDIRI", label: "Mandiri Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BNI", label: "BNI Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BRI", label: "BRI Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BANK_PERMATA", label: "Permata Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BANK_CIMB", label: "CIMB Niaga Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BANK_DANAMON", label: "Danamon Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_BSI", label: "BSI Virtual Account" },
      { code: "VIRTUAL_ACCOUNT_DOKU", label: "DOKU Virtual Account" },
    ],
  },
  {
    title: "QRIS",
    icon: QrCode,
    channels: [{ code: "QRIS", label: "QRIS (semua aplikasi pembayaran)" }],
  },
  {
    title: "Retail / Gerai",
    icon: Store,
    channels: [
      { code: "ONLINE_TO_OFFLINE_ALFA", label: "Alfamart / Alfamidi / Dan+Dan" },
      { code: "ONLINE_TO_OFFLINE_INDOMARET", label: "Indomaret" },
    ],
  },
  {
    title: "E-Wallet",
    icon: Wallet,
    channels: [
      { code: "EMONEY_OVO", label: "OVO" },
      { code: "EMONEY_DANA", label: "DANA" },
      { code: "EMONEY_SHOPEE_PAY", label: "ShopeePay" },
      { code: "EMONEY_LINKAJA", label: "LinkAja" },
digit      { code: "EMONEY_DOKU", label: "DOKU e-Wallet" },
    ],
  },
  {
    title: "Kartu Kredit / Debit",
    icon: CreditCard,
    channels: [{ code: "CREDIT_CARD", label: "Kartu Kredit / Debit (Visa, Mastercard, JCB)" }],
  },
  {
    title: "Bayar Nanti (Paylater)",
    icon: Clock,
    channels: [
      { code: "PEER_TO_PEER_AKULAKU", label: "Akulaku PayLater" },
      { code: "PEER_TO_PEER_KREDIVO", label: "Kredivo" },
      { code: "PEER_TO_PEER_INDODANA", label: "Indodana PayLater" },
    ],
  },
];

export default function WebsitePaymentSettings() {
  const { currentStore } = useStore();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const websiteEnabled = isFeatureEnabled("website") && isFeatureEnabled("website.storefront");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dokuEnabled, setDokuEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [clientId, setClientId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!currentStore?.id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("website_payment_settings")
        .select("*")
        .eq("store_id", currentStore.id)
        .maybeSingle();
      if (!active) return;
      if (error) toast.error("Gagal memuat pengaturan pembayaran website");
      if (data) {
        setDokuEnabled(!!data.doku_enabled);
        setEnvironment(data.doku_environment === "live" ? "live" : "sandbox");
        setClientId(data.doku_client_id || "");
        setSecretKey(data.doku_secret_key || "");
        setChannels(Array.isArray(data.doku_channels) ? (data.doku_channels as string[]) : []);
        setNote(data.manual_transfer_note || "");
      } else {
        setDokuEnabled(false);
        setEnvironment("sandbox");
        setClientId("");
        setSecretKey("");
        setChannels([]);
        setNote("");
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [currentStore?.id]);

  const toggleChannel = (code: string, checked: boolean) => {
    if (checked && !websiteEnabled) {
      toast.error(WEBSITE_INACTIVE_MESSAGE);
      return;
    }
    setChannels((prev) => (checked ? [...new Set([...prev, code])] : prev.filter((c) => c !== code)));
  };

  const toggleGroup = (group: ChannelGroup) => {
    const codes = group.channels.map((c) => c.code);
    const allOn = codes.every((c) => channels.includes(c));
    if (!allOn && !websiteEnabled) {
      toast.error(WEBSITE_INACTIVE_MESSAGE);
      return;
    }
    setChannels((prev) => (allOn ? prev.filter((c) => !codes.includes(c)) : [...new Set([...prev, ...codes])]));
  };

  const handleSave = async () => {
    if (!currentStore?.id) return;
    if (dokuEnabled && !websiteEnabled) {
      toast.error(WEBSITE_INACTIVE_MESSAGE);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("website_payment_settings").upsert(
      {
        store_id: currentStore.id,
        doku_enabled: dokuEnabled,
        doku_environment: environment,
        doku_client_id: clientId.trim() || null,
        doku_secret_key: secretKey.trim() || null,
        doku_channels: channels,
        manual_transfer_note: note.trim() || null,
      },
      { onConflict: "store_id" }
    );
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Gagal menyimpan pengaturan pembayaran");
      return;
    }
    toast.success("Pengaturan pembayaran website disimpan");
  };

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!websiteEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">{WEBSITE_INACTIVE_MESSAGE}</p>
        </div>
      )}

      <PaymentMethodSettings />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Pengaturan DOKU
              </CardTitle>
              <CardDescription>
                Aktifkan DOKU agar pelanggan bisa membayar otomatis dari website. Pilih saluran pembayaran yang ingin
                ditampilkan saat checkout.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={dokuEnabled ? "default" : "secondary"}>{dokuEnabled ? "Aktif" : "Nonaktif"}</Badge>
              <Switch
                checked={dokuEnabled}
                onCheckedChange={(checked) => {
                  if (checked && !websiteEnabled) {
                    toast.error(WEBSITE_INACTIVE_MESSAGE);
                    return;
                  }
                  setDokuEnabled(checked);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex gap-2">
                {(["sandbox", "live"] as const).map((env) => (
                  <Button
                    key={env}
                    type="button"
                    variant={environment === env ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEnvironment(env)}
                  >
                    {env === "sandbox" ? "Uji Coba" : "Live"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doku-client-id">Client ID DOKU</Label>
              <Input
                id="doku-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="BRN-xxxx-xxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="doku-secret-key">Secret Key DOKU</Label>
              <Input
                id="doku-secret-key"
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="SK-xxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Pilihan Pembayaran DOKU</p>
            {DOKU_CHANNEL_GROUPS.map((group) => {
              const codes = group.channels.map((c) => c.code);
              const allOn = codes.every((c) => channels.includes(c));
              const GroupIcon = group.icon;
              return (
                <div key={group.title} className="rounded-xl border overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <GroupIcon className="h-3.5 w-3.5" /> {group.title}
                    </span>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => toggleGroup(group)}>
                      {allOn ? "Non-aktifkan semua" : "Aktifkan semua"}
                    </Button>
                  </div>
                  <div className="divide-y">
                    {group.channels.map((ch) => (
                      <div key={ch.code} className="flex items-center justify-between gap-3 bg-card px-3 py-2.5">
                        <span className="truncate text-sm font-medium">{ch.label}</span>
                        <Switch
                          checked={channels.includes(ch.code)}
                          onCheckedChange={(checked) => toggleChannel(ch.code, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-note">Catatan Pembayaran di Website (opsional)</Label>
            <Textarea
              id="manual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Transfer manual ke BCA 1234567890 a/n OAK LAWANG, kirim bukti bayar via WhatsApp."
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
