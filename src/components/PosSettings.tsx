import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";
import AnkaLoader from "./AnkaLoader";

interface PosSettingsRow {
  id?: string;
  store_id: string;
  require_payment_proof: boolean;
  require_customer: boolean;
  enable_print: boolean;
  service_charge_enabled: boolean;
  service_charge_type: "percent" | "nominal";
  service_charge_value: number;
}

const DEFAULTS = (storeId: string): PosSettingsRow => ({
  store_id: storeId,
  require_payment_proof: true,
  require_customer: false,
  enable_print: true,
  service_charge_enabled: false,
  service_charge_type: "percent",
  service_charge_value: 0,
});

export default function PosSettings() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<PosSettingsRow | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pos_settings")
        .select("*")
        .eq("store_id", currentStore.id)
        .maybeSingle();
      if (data) {
        setRow({
          id: (data as any).id,
          store_id: (data as any).store_id,
          require_payment_proof: !!(data as any).require_payment_proof,
          require_customer: !!(data as any).require_customer,
          enable_print: !!(data as any).enable_print,
          service_charge_enabled: !!(data as any).service_charge_enabled,
          service_charge_type: ((data as any).service_charge_type as "percent" | "nominal") || "percent",
          service_charge_value: Number((data as any).service_charge_value) || 0,
        });
      } else {
        setRow(DEFAULTS(currentStore.id));
      }
      setLoading(false);
    })();
  }, [currentStore?.id]);

  const save = async () => {
    if (!row || !currentStore) return;
    setSaving(true);
    try {
      const payload = {
        store_id: currentStore.id,
        require_payment_proof: row.require_payment_proof,
        require_customer: row.require_customer,
        enable_print: row.enable_print,
        service_charge_enabled: row.service_charge_enabled,
        service_charge_type: row.service_charge_type,
        service_charge_value: row.service_charge_value,
      };
      const { error } = await supabase
        .from("pos_settings")
        .upsert(payload, { onConflict: "store_id" });
      if (error) throw error;
      toast.success("Pengaturan POS tersimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !row) return <AnkaLoader />;

  const update = <K extends keyof PosSettingsRow>(k: K, v: PosSettingsRow[K]) =>
    setRow((r) => (r ? { ...r, [k]: v } : r));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Pengaturan POS
        </CardTitle>
        <CardDescription>
          Atur alur kasir POS: bukti bayar, pilih pelanggan, cetak nota, dan service charge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Wajib Bukti Bayar</Label>
              <p className="text-xs text-muted-foreground">Pengguna harus mengunggah bukti pembayaran sebelum menyimpan order POS.</p>
            </div>
            <Switch checked={row.require_payment_proof} onCheckedChange={(v) => update("require_payment_proof", !!v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Wajib Pilih Pelanggan</Label>
              <p className="text-xs text-muted-foreground">Pengguna harus memilih pelanggan sebelum menyimpan order POS.</p>
            </div>
            <Switch checked={row.require_customer} onCheckedChange={(v) => update("require_customer", !!v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Tombol Cetak Printer</Label>
              <p className="text-xs text-muted-foreground">Tampilkan tombol cetak nota pada form POS.</p>
            </div>
            <Switch checked={row.enable_print} onCheckedChange={(v) => update("enable_print", !!v)} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label>Service Charge</Label>
              <p className="text-xs text-muted-foreground">Aktifkan untuk menambah biaya layanan pada total pembayaran POS.</p>
            </div>
            <Switch
              checked={row.service_charge_enabled}
              onCheckedChange={(v) => update("service_charge_enabled", !!v)}
            />
          </div>
          {row.service_charge_enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipe</Label>
                <Select
                  value={row.service_charge_type}
                  onValueChange={(v) => update("service_charge_type", v as "percent" | "nominal")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Persen (%)</SelectItem>
                    <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  Nilai {row.service_charge_type === "percent" ? "(%)" : "(Rp)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={row.service_charge_value}
                  onChange={(e) => {
                    let v = Number(e.target.value) || 0;
                    if (row.service_charge_type === "percent") v = Math.min(100, Math.max(0, v));
                    else v = Math.max(0, v);
                    update("service_charge_value", v);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}