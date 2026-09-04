import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Save } from "lucide-react";
import { toast } from "sonner";

const buildTimeOptions = (stepMinutes: number) => {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += stepMinutes) {
    out.push(
      `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`
    );
  }
  return out;
};

export default function ScheduleTimeSettings() {
  const { currentStore } = useStore();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("05:00");
  const [slotMinutes, setSlotMinutes] = useState("60");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    supabase
      .from("stores")
      .select("schedule_start_time, schedule_end_time, schedule_slot_minutes")
      .eq("id", currentStore.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStartTime((data as any).schedule_start_time || "09:00");
        setEndTime((data as any).schedule_end_time || "05:00");
        setSlotMinutes(String((data as any).schedule_slot_minutes || 60));
      });
  }, [currentStore?.id]);

  const handleSave = async () => {
    if (!currentStore) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          schedule_start_time: startTime,
          schedule_end_time: endTime,
          schedule_slot_minutes: parseInt(slotMinutes) || 60,
        } as any)
        .eq("id", currentStore.id);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("schedule-settings-changed"));
      toast.success("Jam operasional berhasil disimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan jam operasional");
    } finally {
      setSaving(false);
    }
  };

  const options = buildTimeOptions(parseInt(slotMinutes) || 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Jam Operasional
        </CardTitle>
        <CardDescription>
          Atur jam buka, jam tutup, dan interval slot kalender khusus outlet ini
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Jam Buka</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50 max-h-72">
                {options.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jam Tutup</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50 max-h-72">
                {options.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Interval Slot</Label>
            <Select value={slotMinutes} onValueChange={setSlotMinutes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="30">30 Menit</SelectItem>
                <SelectItem value="60">60 Menit (1 Jam)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Contoh: Buka 09:00, Tutup 05:00 berarti operasional dari jam 9 pagi sampai jam 5 pagi hari
          berikutnya. Interval 30 menit menampilkan slot 09:00 - 09:30, 09:30 - 10:00, dst.
        </p>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Menyimpan..." : "Simpan Jam Operasional"}
        </Button>
      </CardContent>
    </Card>
  );
}
