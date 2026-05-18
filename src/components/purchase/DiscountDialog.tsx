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

  useEffect(() => {
    if (mode === "pct" && value > 100) setValue(100);
    if (value < 0) setValue(0);
  }, [mode, value]);

  const clampedPct = Math.max(0, Math.min(100, value));
  const absolute =
    mode === "rp"
      ? Math.max(0, value)
      : Math.max(0, Math.round((baseAmount * clampedPct) / 100));

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
            {mode === "rp" ? (
              <Input
                inputMode="numeric"
                value={value ? new Intl.NumberFormat("id-ID").format(value) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setValue(raw ? parseInt(raw, 10) : 0);
                }}
                placeholder="0"
                autoFocus
              />
            ) : (
              <Input
                type="number"
                min={0}
                max={100}
                value={value || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setValue(v > 100 ? 100 : v < 0 ? 0 : v);
                }}
                placeholder="0"
                autoFocus
              />
            )}
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
              onApply(absolute, mode, mode === "pct" ? clampedPct : value);
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
