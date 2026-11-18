import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPosCustomItem } from "@/utils/posCustomItem";

type CustomItem = NonNullable<ReturnType<typeof createPosCustomItem>>;

export default function PosCustomItemPanel({ onAdd, onCancel, disabled }: {
  onAdd: (item: CustomItem) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const item = createPosCustomItem(name, Number(amount || 0));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="bg-primary text-primary-foreground px-4 py-3 shrink-0">
        <h3 className="text-lg font-bold">Item Custom</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <form className="mx-auto w-full max-w-md space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (item && !disabled) onAdd(item);
        }}>
          <div className="space-y-2">
            <Label htmlFor="pos-custom-name">Nama Item</Label>
            <Input id="pos-custom-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama barang" disabled={disabled} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-custom-amount">Jumlah Uang</Label>
            <Input id="pos-custom-amount" inputMode="numeric" value={amount ? Number(amount).toLocaleString("id-ID") : ""} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="0" disabled={disabled} className="h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled} className="h-11"><X className="h-4 w-4 mr-2 shrink-0" />Batal</Button>
            <Button type="submit" disabled={!item || disabled} className="h-auto min-h-11 py-2 whitespace-normal"><Check className="h-4 w-4 mr-2 shrink-0" /><span className="min-w-0">Tambah Item Custom</span></Button>
          </div>
        </form>
      </div>
    </div>
  );
}