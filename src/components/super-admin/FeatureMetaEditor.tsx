import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";

interface StoreFeature {
  id: string;
  store_id: string;
  feature_key: string;
  is_enabled: boolean;
  activation_price: string | null;
  activation_description: string | null;
  monthly_price: number | null;
  subscription_end_date: string | null;
}

interface FeatureMetaEditorProps {
  feature: StoreFeature;
  onSave: (feature: StoreFeature, price: number, endDate: string, description: string) => void;
  onCancel: () => void;
}

export default function FeatureMetaEditor({ feature, onSave, onCancel }: FeatureMetaEditorProps) {
  const initialPrice = (feature.monthly_price ?? Number((feature.activation_price || "").replace(/[^0-9]/g, ""))) || 0;
  const [price, setPrice] = useState(initialPrice);
  const [endDate, setEndDate] = useState(feature.subscription_end_date || "");
  const [description, setDescription] = useState(feature.activation_description || "");

  return (
    <div className="ml-6 space-y-3 rounded-md border border-dashed border-primary/20 bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Biaya Bulanan (0 = gratis)</label>
          <MoneyInput
            value={price}
            onChange={setPrice}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Aktif Sampai</label>
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="h-8 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Kosongkan agar mengikuti masa aktif PMS.</p>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Deskripsi / Fasilitas</label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Contoh: Fitur Akuntansi mencakup jurnal umum, laporan neraca..."
          className="min-h-[60px] text-sm"
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Batal</Button>
        <Button size="sm" onClick={() => onSave(feature, price, endDate, description)}>Simpan</Button>
      </div>
    </div>
  );
}
