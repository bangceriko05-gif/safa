import type { ReactNode } from "react";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DOKU_METHOD_GROUPS, enabledDokuCodes } from "@/utils/dokuChannels";

interface Props {
  total: string;
  attendant: string;
  methods: { id: string; name: string }[];
  selected: string;
  onSelect: (method: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  /** Kode channel DOKU yang diaktifkan outlet pada Pengaturan DOKU. */
  dokuChannels: string[];
  children: ReactNode;
}

export default function PosPaymentPanel({ total, attendant, methods, selected, onSelect, onBack, onSave, saving, dokuChannels, children }: Props) {
  return (
    <section className="flex flex-1 min-h-0 flex-col bg-background text-foreground" aria-label="Pembayaran POS">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3 shrink-0">
        <div>
          <p className="text-[10px] font-semibold uppercase text-primary">Pembayaran</p>
          <h3 className="text-base font-bold">Pilih Metode Pembayaran</h3>
          <p className="text-xs text-muted-foreground">Total {total}</p>
          <p className="text-xs text-muted-foreground mt-1">Dilayani oleh: <span className="font-semibold text-foreground">{attendant}</span></p>
        </div>
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali ke katalog" title="Kembali ke katalog" disabled={saving}><ArrowLeft className="h-4 w-4" /></Button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 border-b p-3">
          {methods.map((method) => (
            <Button key={method.id} variant={selected === method.name ? "default" : "outline"} aria-pressed={selected === method.name} onClick={() => onSelect(method.name)} disabled={saving} className="min-h-16 h-auto flex-col gap-1 whitespace-normal px-2 text-xs">
              <CreditCard className="h-4 w-4 shrink-0" />{method.name}
            </Button>
          ))}
          {DOKU_METHOD_GROUPS.map((group) => {
            const active = enabledDokuCodes(group, dokuChannels).length > 0;
            return (
              <Button key={group.name} variant={selected === group.name ? "default" : "outline"} aria-pressed={selected === group.name} aria-disabled={!active} disabled={saving}
                onClick={() => active ? onSelect(group.name) : toast.info("Metode DOKU ini belum aktif untuk outlet ini. Aktifkan di menu DOKU → Pengaturan.")}
                className={`min-h-16 h-auto flex-col gap-1 whitespace-normal px-2 text-xs${active ? "" : " text-muted-foreground"}`}>
                <CreditCard className="h-4 w-4 shrink-0" />{group.name}
              </Button>
            );
          })}
        </div>
        <div className="p-3 space-y-3">{children}
          <Button onClick={onSave} disabled={saving || !selected} className="w-full h-11">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Transaksi</Button>
        </div>
      </div>
    </section>
  );
}
