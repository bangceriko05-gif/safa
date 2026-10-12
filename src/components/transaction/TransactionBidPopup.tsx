import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, X } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useEffect, useState } from "react";
import { fetchGroupBilling } from "@/utils/groupBookingBilling";
import { supabase } from "@/integrations/supabase/client";

export type TxType = "purchase" | "expense" | "income" | "booking";

const TYPE_LABEL: Record<TxType, string> = {
  purchase: "Pembelian",
  expense: "Pengeluaran",
  income: "Pemasukan",
  booking: "Penjualan",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (s?: string) => {
  if (!s) return "-";
  try {
    return format(new Date(s), "d MMMM yyyy", { locale: localeId });
  } catch {
    return s;
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  type: TxType;
  data: Record<string, any> | null;
}

/**
 * Generic preview popup for a transaction BID. Shows summary fields and
 * provides an Edit action that opens the full edit page in the parent.
 */
export default function TransactionBidPopup({ open, onClose, onEdit, type, data }: Props) {
  const [shared, setShared] = useState<Awaited<ReturnType<typeof fetchGroupBilling>> | null>(null);
  useEffect(() => {
    let active = true;
    setShared(null);
    if (open && type === "booking" && data?.id) {
      void (async () => {
        const { data: booking, error } = await supabase.from("bookings").select("id, store_id, booking_group_id").eq("id", data.id).single();
        if (error) throw error;
        if (booking.booking_group_id) {
          const billing = await fetchGroupBilling(booking);
          if (active && billing.rooms.length > 1) setShared(billing);
        }
      })().catch(error => console.error("Unable to load shared billing", error));
    }
    return () => { active = false; };
  }, [open, type, data?.id]);
  if (!data) return null;

  const rows: Array<[string, string]> = [];
  rows.push(["Tanggal", fmtDate(data.date)]);

  if (type === "purchase") {
    rows.push(["Supplier", data.supplier_name || "-"]);
    rows.push(["Pembayaran", data.payment_method || "-"]);
    rows.push(["Penerimaan", data.receipt_status || "-"]);
    rows.push(["Verifikasi", data.verification_status || "-"]);
    rows.push(["Status", data.status || "-"]);
    rows.push(["Total", fmtMoney(Number(data.amount) || 0)]);
  } else if (type === "expense") {
    rows.push(["Kategori", data.category || "-"]);
    rows.push(["Pembayaran", data.payment_method || "-"]);
    rows.push(["Verifikasi", data.verification_status || "-"]);
    rows.push(["Status", data.status || "-"]);
    rows.push(["Deskripsi", data.description || "-"]);
    rows.push(["Total", fmtMoney(Number(data.amount) || 0)]);
  } else if (type === "income") {
    rows.push(["Kategori", data.category || "-"]);
    rows.push(["Pembayaran", data.payment_method || "-"]);
    rows.push(["Verifikasi", data.verification_status || "-"]);
    rows.push(["Status", data.status || "-"]);
    rows.push(["Deskripsi", data.description || "-"]);
    rows.push(["Total", fmtMoney(Number(data.amount) || 0)]);
  } else if (type === "booking") {
    rows.push(["Pelanggan", data.customer_name || "-"]);
    rows.push(["Kamar", data.room_name || data.rooms?.name || "-"]);
    rows.push(["Status", data.status || "-"]);
    rows.push(["Pembayaran", (shared ? shared.totals.paid >= shared.totals.total && shared.totals.total > 0 : data.payment_status === "lunas") ? "LUNAS" : "BELUM LUNAS"]);
    if (shared) rows.push(["Total Tagihan", fmtMoney(shared.totals.total)]);
    rows.push([shared ? "Jumlah Bayar" : "Total", fmtMoney(shared?.totals.paid ?? (Number(data.price) || 0))]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-normal">{TYPE_LABEL[type]}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-sm bg-blue-50 text-blue-700 border-blue-200">
                {data.bid || "-"}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" /> Tutup
          </Button>
          <Button onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}