import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaymentMethod { id: string; name: string }

export default function PaymentDialog({
  open,
  onClose,
  remaining,
  paymentMethods,
  initialMethod,
  initialReff,
  initialAmount,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  remaining: number;
  paymentMethods: PaymentMethod[];
  initialMethod?: string;
  initialReff?: string;
  initialAmount?: number;
  onApply: (method: string, reff: string, amount: number) => void;
}) {
  const [method, setMethod] = useState(initialMethod || "");
  const [reff, setReff] = useState(initialReff || "");
  const [amount, setAmount] = useState<number>(initialAmount ?? remaining);

  useEffect(() => {
    if (open) {
      setMethod(initialMethod || (paymentMethods[0]?.name ?? ""));
      setReff(initialReff || "");
      setAmount(initialAmount ?? remaining);
    }
  }, [open]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Sisa Tagihan</span>
            <span className="font-semibold">{fmt(remaining)}</span>
          </div>
          <div>
            <Label>Metode Bayar</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
                    <SelectItem value="Hutang">Hutang</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>No. Reff</Label>
            <Input
              value={reff}
              onChange={(e) => setReff(e.target.value)}
              placeholder="No. referensi (opsional)"
            />
          </div>
          <div>
            <Label>Total Bayar</Label>
            <Input
              type="number"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <div className="mt-1 flex gap-2 text-xs">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setAmount(remaining)}
              >
                Bayar Penuh
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button
            onClick={() => {
              if (!method) return;
              onApply(method, reff, amount);
              onClose();
            }}
            disabled={!method || amount <= 0}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
