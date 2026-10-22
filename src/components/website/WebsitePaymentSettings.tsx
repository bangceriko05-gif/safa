import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Save } from "lucide-react";
import PaymentMethodSettings from "@/components/PaymentMethodSettings";
import DokuSettings from "@/components/doku/DokuSettings";

const WEBSITE_INACTIVE_MESSAGE =
  "Mohon maaf, fitur website di outlet anda tidak aktif. Lakukan pembayaran tambahan untuk mengaktifkan fitur ini. Terima kasih";

export default function WebsitePaymentSettings() {
  const { currentStore } = useStore();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const websiteEnabled = isFeatureEnabled("website") && isFeatureEnabled("website.storefront");
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!currentStore?.id) return;
    let active = true;
    void supabase.from("website_payment_settings").select("manual_transfer_note").eq("store_id", currentStore.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error("Catatan pembayaran belum dapat dimuat. Silakan coba lagi.");
      setNote(data?.manual_transfer_note || ""); setSavedNote(data?.manual_transfer_note || "");
    });
    return () => { active = false; };
  }, [currentStore?.id]);
  const saveNote = async () => {
    if (!currentStore?.id) return;
    setSaving(true);
    const { error } = await supabase.from("website_payment_settings").upsert({ store_id: currentStore.id, manual_transfer_note: note.trim() || null }, { onConflict: "store_id" });
    setSaving(false);
    if (error) toast.error("Catatan pembayaran belum tersimpan. Silakan coba lagi.");
    else { setSavedNote(note); toast.success("Catatan pembayaran disimpan."); }
  };
  return <div className="space-y-4">
    {!websiteEnabled && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p className="text-sm font-medium text-destructive">{WEBSITE_INACTIVE_MESSAGE}</p></div>}
    <PaymentMethodSettings />
    <DokuSettings />
    <section className="space-y-3 border-t pt-4">
      <Label htmlFor="manual-note">Catatan Pembayaran di Website (opsional)</Label>
      <Textarea id="manual-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={3} />
      <Button onClick={() => void saveNote()} disabled={saving || note === savedNote}><Save className="mr-2 h-4 w-4" />Simpan Catatan</Button>
    </section>
  </div>;
}
