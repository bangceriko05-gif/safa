import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PaymentMethod { id: string; name: string }

export interface PaymentDialogResult {
  method: string;
  reff: string;
  amount: number;
  date: Date;
  isDP: boolean;
}

const formatThousand = (n: number) =>
  n ? new Intl.NumberFormat("id-ID").format(n) : "";

const parseThousand = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export default function PaymentDialog({
  open,
  onClose,
  remaining,
  paymentMethods,
  initialMethod,
  initialReff,
  initialAmount,
  initialDate,
  initialIsDP,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  remaining: number;
  paymentMethods: PaymentMethod[];
  initialMethod?: string;
  initialReff?: string;
  initialAmount?: number;
  initialDate?: Date;
  initialIsDP?: boolean;
  onApply: (result: PaymentDialogResult) => void;
}) {
  const [date, setDate] = useState<Date>(initialDate || new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [method, setMethod] = useState(initialMethod || "");
  const [reff, setReff] = useState(initialReff || "");
  const [amountStr, setAmountStr] = useState<string>(
    formatThousand(initialAmount ?? remaining)
  );
  const [isDP, setIsDP] = useState<boolean>(!!initialIsDP);

  useEffect(() => {
    if (open) {
      setDate(initialDate || new Date());
      setMethod(initialMethod || (paymentMethods[0]?.name ?? ""));
      setReff(initialReff || "");
      setAmountStr(formatThousand(initialAmount ?? remaining));
      setIsDP(!!initialIsDP);
    }
  }, [open]);

  const amount = parseThousand(amountStr);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tanggal Pembayaran</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "d MMMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { if (d) { setDate(d); setDateOpen(false); } }}
                  initialFocus
                  locale={idLocale}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Referensi Pembayaran</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Referensi pembayaran dari Paypal/Bank
            </p>
            <Input
              value={reff}
              onChange={(e) => setReff(e.target.value)}
              placeholder="Masukkan Referensi Pembayaran"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Metode Pembayaran</Label>
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

          <div className="space-y-1.5">
            <Label>Total Pembayaran</Label>
            <Input
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(formatThousand(parseThousand(e.target.value)))}
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dp-check"
              checked={isDP}
              onCheckedChange={(v) => setIsDP(!!v)}
            />
            <Label htmlFor="dp-check" className="font-normal cursor-pointer">
              Simpan sebagai Down Payment (DP)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button
            onClick={() => {
              if (!method || amount <= 0) return;
              onApply({ method, reff, amount, date, isDP });
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
