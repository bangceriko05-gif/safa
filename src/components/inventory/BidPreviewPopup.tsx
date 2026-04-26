import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export type BidType = "stock_in" | "stock_out" | "stock_opname" | "bookings";

interface Props {
  open: boolean;
  onClose: () => void;
  type: BidType;
  refId: string;
  bid: string;
  onEdit: () => void;
}

interface Header {
  date?: string;
  status?: string;
  notes?: string | null;
  total_amount?: number | null;
  total_difference?: number | null;
  total_value_difference?: number | null;
  supplier_name?: string | null;
  recipient?: string | null;
  reason?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  room_name?: string | null;
  price?: number | null;
}

interface Item {
  product_name: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  difference?: number;
  system_qty?: number;
  actual_qty?: number;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";

const TYPE_LABEL: Record<BidType, string> = {
  stock_in: "Stok Masuk",
  stock_out: "Stok Keluar",
  stock_opname: "Stok Opname",
  bookings: "Penjualan",
};

export default function BidPreviewPopup({ open, onClose, type, refId, bid, onEdit }: Props) {
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!open || !refId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refId, type]);

  const fetchData = async () => {
    setLoading(true);
    setHeader(null);
    setItems([]);
    try {
      if (type === "stock_in") {
        const { data: h } = await supabase
          .from("stock_in" as any)
          .select("date, status, notes, total_amount, supplier_name")
          .eq("id", refId)
          .maybeSingle();
        setHeader((h as any) || {});
        const { data: it } = await supabase
          .from("stock_in_items" as any)
          .select("quantity, unit_price, subtotal, products:product_id(name)")
          .eq("stock_in_id", refId);
        setItems(((it as any[]) || []).map((r) => ({
          product_name: r.products?.name || "-",
          quantity: Number(r.quantity || 0),
          unit_price: Number(r.unit_price || 0),
          subtotal: Number(r.subtotal || 0),
        })));
      } else if (type === "stock_out") {
        const { data: h } = await supabase
          .from("stock_out" as any)
          .select("date, status, notes, total_amount, recipient, reason")
          .eq("id", refId)
          .maybeSingle();
        setHeader((h as any) || {});
        const { data: it } = await supabase
          .from("stock_out_items" as any)
          .select("quantity, unit_price, subtotal, products:product_id(name)")
          .eq("stock_out_id", refId);
        setItems(((it as any[]) || []).map((r) => ({
          product_name: r.products?.name || "-",
          quantity: Number(r.quantity || 0),
          unit_price: Number(r.unit_price || 0),
          subtotal: Number(r.subtotal || 0),
        })));
      } else if (type === "stock_opname") {
        const { data: h } = await supabase
          .from("stock_opname" as any)
          .select("date, status, notes, total_difference, total_value_difference")
          .eq("id", refId)
          .maybeSingle();
        setHeader((h as any) || {});
        const { data: it } = await supabase
          .from("stock_opname_items" as any)
          .select("system_qty, actual_qty, difference, products:product_id(name)")
          .eq("stock_opname_id", refId);
        setItems(((it as any[]) || []).map((r) => ({
          product_name: r.products?.name || "-",
          quantity: Number(r.actual_qty || 0),
          system_qty: Number(r.system_qty || 0),
          actual_qty: Number(r.actual_qty || 0),
          difference: Number(r.difference || 0),
        })));
      } else if (type === "bookings") {
        const { data: h } = await supabase
          .from("bookings")
          .select("date, status, customer_name, phone, price, rooms(name)")
          .eq("id", refId)
          .maybeSingle();
        const hh = h as any;
        setHeader({
          date: hh?.date,
          status: hh?.status,
          customer_name: hh?.customer_name,
          phone: hh?.phone,
          price: hh?.price,
          room_name: hh?.rooms?.name,
        });
        const { data: it } = await supabase
          .from("booking_products")
          .select("product_name, quantity, unit_price, subtotal")
          .eq("booking_id", refId);
        setItems(((it as any[]) || []).map((r) => ({
          product_name: r.product_name || "-",
          quantity: Number(r.quantity || 0),
          unit_price: Number(r.unit_price || 0),
          subtotal: Number(r.subtotal || 0),
        })));
      }
    } catch (err) {
      console.error("[BidPreview] fetch error:", err);
      toast.error("Gagal memuat preview");
    } finally {
      setLoading(false);
    }
  };

  const isOpname = type === "stock_opname";
  const totalQty = items.reduce((s, r) => s + (r.quantity || 0), 0);
  const totalSub = items.reduce((s, r) => s + (r.subtotal || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-normal">{TYPE_LABEL[type]}</span>
            <span className="font-mono text-base">{bid}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1 -mx-6 px-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline" /> Memuat...
            </div>
          ) : (
            <>
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Tanggal</div>
                  <div className="font-medium">{fmtDate(header?.date)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div>
                    <Badge variant={header?.status === "posted" || header?.status === "CO" ? "default" : "secondary"}>
                      {header?.status || "-"}
                    </Badge>
                  </div>
                </div>
                {type === "stock_in" && header?.supplier_name && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Supplier</div>
                    <div className="font-medium">{header.supplier_name}</div>
                  </div>
                )}
                {type === "stock_out" && (
                  <>
                    {header?.recipient && (
                      <div>
                        <div className="text-xs text-muted-foreground">Penerima</div>
                        <div className="font-medium">{header.recipient}</div>
                      </div>
                    )}
                    {header?.reason && (
                      <div>
                        <div className="text-xs text-muted-foreground">Alasan</div>
                        <div className="font-medium">{header.reason}</div>
                      </div>
                    )}
                  </>
                )}
                {type === "bookings" && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Pelanggan</div>
                      <div className="font-medium">{header?.customer_name || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Kamar</div>
                      <div className="font-medium">{header?.room_name || "-"}</div>
                    </div>
                  </>
                )}
                {header?.notes && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Catatan</div>
                    <div className="text-sm">{header.notes}</div>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Produk</th>
                      {isOpname ? (
                        <>
                          <th className="text-right px-3 py-2 font-medium">Sistem</th>
                          <th className="text-right px-3 py-2 font-medium">Aktual</th>
                          <th className="text-right px-3 py-2 font-medium">Selisih</th>
                        </>
                      ) : (
                        <>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Harga</th>
                          <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground">
                          Tidak ada item
                        </td>
                      </tr>
                    ) : (
                      items.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{r.product_name}</td>
                          {isOpname ? (
                            <>
                              <td className="px-3 py-2 text-right">{r.system_qty}</td>
                              <td className="px-3 py-2 text-right">{r.actual_qty}</td>
                              <td
                                className={`px-3 py-2 text-right font-semibold ${
                                  (r.difference || 0) > 0
                                    ? "text-green-600"
                                    : (r.difference || 0) < 0
                                      ? "text-destructive"
                                      : ""
                                }`}
                              >
                                {(r.difference || 0) > 0 ? "+" : ""}
                                {r.difference}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-right">{r.quantity}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(r.unit_price || 0)}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmtMoney(r.subtotal || 0)}</td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="bg-muted/30">
                      <tr className="border-t font-semibold">
                        <td className="px-3 py-2">Total</td>
                        {isOpname ? (
                          <>
                            <td></td>
                            <td></td>
                            <td className="px-3 py-2 text-right">
                              {(header?.total_difference ?? 0) > 0 ? "+" : ""}
                              {header?.total_difference ?? 0}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-right">{totalQty}</td>
                            <td></td>
                            <td className="px-3 py-2 text-right">
                              {fmtMoney(
                                type === "bookings"
                                  ? Number(header?.price || 0) || totalSub
                                  : Number(header?.total_amount || 0) || totalSub,
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
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