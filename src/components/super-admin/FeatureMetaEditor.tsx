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
}

interface FeatureMetaEditorProps {
  feature: StoreFeature;
  onSave: (feature: StoreFeature, price: string, description: string) => void;
  onCancel: () => void;
}

export default function FeatureMetaEditor({ feature, onSave, onCancel }: FeatureMetaEditorProps) {
  const [price, setPrice] = useState(feature.activation_price || "");
  const [description, setDescription] = useState(feature.activation_description || "");

  // Parse initial price to a number if it's a plain digit string; otherwise keep raw.
  const isNumericPrice = /^\d+$/.test((price || "").replace(/[.\s]/g, ""));
  const numericValue = isNumericPrice ? Number((price || "").replace(/[^\d]/g, "")) : 0;

  return (
    <div className="ml-6 p-3 rounded-md border border-dashed border-primary/20 bg-muted/30 space-y-2">
      <div>
        <label className="text-xs text-muted-foreground">Harga Aktivasi</label>
        <MoneyInput
          value={numericValue}
          onChange={(n) => setPrice(n ? String(n) : "")}
          placeholder="0"
          className="h-8 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Deskripsi / Fasilitas</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contoh: Fitur Akuntansi mencakup jurnal umum, laporan neraca..."
          className="text-sm min-h-[60px]"
          rows={2}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Batal</Button>
        <Button size="sm" onClick={() => onSave(feature, price, description)}>Simpan</Button>
      </div>
    </div>
  );
}
