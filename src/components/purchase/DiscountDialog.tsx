import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function DiscountDialog({
  open,
  onClose,
  baseAmount,
  initialMode = "rp",
  initialValue = 0,
  onApply,
  title = "Diskon",
}: {
  open: boolean;
  onClose: () => void;
  baseAmount: number;
  initialMode?: "rp" | "pct";
  initialValue?: number;
  onApply: (absolute: number, mode: "rp" | "pct", value: number) => void;
  title?: string;
}) {
  const [mode, setMode] = useState<"rp" | "pct">(initialMode);
  const [value, setValue] = useState<number>(initialValue);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setValue(initialValue);
    }
  }, [open, initialMode, initialValue]);

  const absolute =
    mode === "rp"
      ? Math.max(0, value)
      : Math.max(0, Math.min(baseAmount, Math.round((baseAmount * value) / 100)));

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tipe Diskon</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as "rp" | "pct")}
              className="justify-start mt-1"
            >
              <ToggleGroupItem value="rp" className="flex-1">Rp</ToggleGroupItem>
              <ToggleGroupItem value="pct" className="flex-1">%</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Nilai Diskon {mode === "pct" ? "(%)" : "(Rp)"}
            </Label>
            <Input
              type="number"
              min={0}
              max={mode === "pct" ? 100 : undefined}
              value={value || ""}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Diskon</span>
            <span className="font-semibold">{fmt(absolute)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button
            onClick={() => {
              onApply(absolute, mode, value);
              onClose();
            }}
          >
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
