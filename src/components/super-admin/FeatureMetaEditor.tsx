import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="ml-6 p-3 rounded-md border border-dashed border-primary/20 bg-muted/30 space-y-2">
      <div>
        <label className="text-xs text-muted-foreground">Harga Aktivasi</label>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Contoh: Biaya aktivasi: Rp 250.000 / bulan"
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
