import { useState } from "react";
import { CalendarClock, CalendarDays, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extendFeatureSubscription, parseMonthlyPrice } from "@/utils/subscription";

interface StoreFeature {
  id: string;
  store_id: string;
  feature_key: string;
  is_enabled: boolean;
  activation_price: string | null;
  activation_description: string | null;
  monthly_price: number | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
}

interface FeatureMetaEditorProps {
  feature: StoreFeature;
  name: string;
  storeName: string;
  fallbackStart: string;
  fallbackEnd: string;
  onSave: (feature: StoreFeature, price: number, startDate: string, endDate: string, description: string) => Promise<void>;
  onCancel: () => void;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={label} className="h-11 w-full justify-start text-left font-normal">
            <CalendarDays className="mr-2 h-4 w-4 text-primary" />
            {value ? format(parseISO(value), "d MMMM yyyy", { locale: id }) : "Mengikuti langganan PMS"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" locale={id} selected={value ? parseISO(value) : undefined} defaultMonth={value ? parseISO(value) : undefined}
            onSelect={(date) => { if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); } }} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function FeatureMetaEditor({ feature, name, storeName, fallbackStart, fallbackEnd, onSave, onCancel }: FeatureMetaEditorProps) {
  const [price, setPrice] = useState(parseMonthlyPrice(feature.monthly_price ?? feature.activation_price));
  const [startDate, setStartDate] = useState(feature.subscription_start_date || fallbackStart);
  const [endDate, setEndDate] = useState(feature.subscription_end_date || fallbackEnd);
  const [description, setDescription] = useState(feature.activation_description || "");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-24px)] max-w-md overflow-y-auto p-0" aria-describedby="feature-subscription-outlet">
        <DialogHeader className="border-b bg-primary/5 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><CalendarClock className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-xs font-normal text-muted-foreground">Edit Langganan</span><span className="block text-base font-semibold">{name}</span></span>
          </DialogTitle>
          <DialogDescription id="feature-subscription-outlet">{storeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-6">
          <DateField label="Mulai Langganan" value={startDate} onChange={setStartDate} />
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perpanjang Dari Akhir Langganan</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((months) => <Button key={months} variant="outline" className="h-11 font-semibold" disabled={!startDate && !endDate} onClick={() => setEndDate(extendFeatureSubscription(startDate, endDate, months))}>+{months} Bulan</Button>)}
            </div>
          </div>
          <DateField label="Akhir Langganan" value={endDate} onChange={setEndDate} />
          <div className="space-y-2">
            <Label htmlFor="feature-subscription-price" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nominal Langganan</Label>
            <MoneyInput id="feature-subscription-price" value={price} onChange={setPrice} placeholder="0" className="h-11" />
            <p className="text-[11px] text-muted-foreground">Biaya bulanan fitur ini. Nominal 0 untuk fitur gratis.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feature-subscription-description" className="text-xs text-muted-foreground">Deskripsi / Fasilitas</Label>
            <Textarea id="feature-subscription-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={saving} onClick={onCancel}>Batal</Button>
            <Button disabled={saving} onClick={async () => { setSaving(true); try { await onSave(feature, price, startDate, endDate, description); } finally { setSaving(false); } }}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}