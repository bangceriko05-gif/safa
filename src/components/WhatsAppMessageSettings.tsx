import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { WhatsAppMessages, defaultWhatsAppMessages, whatsappVariables } from "@/utils/bookingWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fields: { key: keyof WhatsAppMessages; label: string }[] = [
  { key: "booking_message", label: "Booking · Pengingat Kedatangan" },
  { key: "check_in_message", label: "Check In · Pengingat Check Out" },
  { key: "check_out_message", label: "Check Out · Pengalaman Menginap" },
];
export default function WhatsAppMessageSettings() {
  const { currentStore } = useStore();
  const { data, isLoading, isError, refetch } = useWhatsAppMessages(currentStore?.id);
  const client = useQueryClient();
  const [draft, setDraft] = useState(defaultWhatsAppMessages);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(data || defaultWhatsAppMessages); }, [data, currentStore?.id]);
  const changed = JSON.stringify(draft) !== JSON.stringify(data);
  const valid = Object.values(draft).every(value => value.trim().length > 0 && value.length <= 4000);
  const save = async () => {
    if (!currentStore || !valid) return;
    setSaving(true);
    const storeId = currentStore.id;
    try {
      const { error } = await supabase.from("whatsapp_message_settings").upsert({ store_id: storeId, ...draft });
      if (error) throw error;
      client.setQueryData(["whatsapp-messages", storeId], { ...draft });
      toast.success("Pesan WhatsApp berhasil disimpan");
    } catch { toast.error("Gagal menyimpan pesan WhatsApp"); }
    finally { setSaving(false); }
  };
  if (!currentStore) return <p>Pilih outlet terlebih dahulu.</p>;
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (isError) return <Button variant="outline" onClick={() => refetch()}>Muat ulang pesan</Button>;
  return <section className="max-w-3xl space-y-6 py-2">
    <header><h2 className="text-lg font-bold">Pesan WhatsApp</h2><p className="text-sm text-muted-foreground">{currentStore.name}</p></header>
    {fields.map(({ key, label }) => <div key={key} className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Textarea id={key} value={draft[key]} maxLength={4000} rows={4} className="resize-y" disabled={saving} onChange={event => setDraft(prev => ({ ...prev, [key]: event.target.value }))} />
      <div className="flex flex-wrap gap-1">{whatsappVariables.map(variable => <Button key={variable} variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={saving} onClick={() => setDraft(prev => ({ ...prev, [key]: `${prev[key]} {${variable}}`.slice(0, 4000) }))}>{`{${variable}}`}</Button>)}</div>
    </div>)}
    <Button onClick={save} disabled={!changed || !valid || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan Pesan</Button>
  </section>;
}