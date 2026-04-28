import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { toast } from "sonner";

export default function TaxSettings() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState<number>(11);
  const [includeAllowed, setIncludeAllowed] = useState(true);
  const [excludeAllowed, setExcludeAllowed] = useState(true);

  useEffect(() => {
    if (!currentStore) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const load = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select("tax_enabled, tax_rate, tax_modes_allowed")
      .eq("id", currentStore.id)
      .maybeSingle();
    if (!error && data) {
      setEnabled((data as any).tax_enabled ?? false);
      setRate(Number((data as any).tax_rate) || 11);
      const modes: string[] = (data as any).tax_modes_allowed || ["include", "exclude"];
      setIncludeAllowed(modes.includes("include"));
      setExcludeAllowed(modes.includes("exclude"));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentStore) return;
    if (enabled && !includeAllowed && !excludeAllowed) {
      toast.error("Pilih minimal satu mode PPN (Include atau Exclude)");
      return;
    }
    setSaving(true);
    const modes: string[] = [];
    if (includeAllowed) modes.push("include");
    if (excludeAllowed) modes.push("exclude");
    const { error } = await supabase
      .from("stores")
      .update({
        tax_enabled: enabled,
        tax_rate: Number(rate) || 0,
        tax_modes_allowed: modes.length ? modes : ["exclude"],
      })
      .eq("id", currentStore.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengaturan PPN tersimpan");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Header toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Aktifkan PPN</h3>
            <p className="text-sm text-muted-foreground">
              Hitung dan tampilkan PPN pada transaksi penjualan
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div className="border-t" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tarif PPN */}
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Tarif PPN (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </div>

              {/* Mode PPN */}
              <div className="space-y-2">
                <Label>Mode PPN</Label>
                <div className="rounded-md border p-3 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={includeAllowed}
                      onCheckedChange={(v) => setIncludeAllowed(!!v)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">Include</p>
                      <p className="text-xs text-muted-foreground">
                        PPN sudah termasuk dalam harga produk (ditampilkan sebagai informasi).
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={excludeAllowed}
                      onCheckedChange={(v) => setExcludeAllowed(!!v)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">Exclude</p>
                      <p className="text-xs text-muted-foreground">
                        PPN dihitung dari subtotal dan ditambahkan ke total pembayaran.
                      </p>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mode yang dicentang akan tersedia untuk dipilih per produk. Jika produk tidak diatur
                  secara spesifik, mode <span className="font-semibold">Exclude</span> menjadi default selama aktif.
                </p>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}