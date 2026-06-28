import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AddOrderModal from "./AddOrderModal";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Props {
  booking: any;
  canEdit: boolean;
}

export default function BookingOrdersSection({ booking, canEdit }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data: ords } = await supabase
      .from("booking_orders")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false });
    setOrders(ords || []);

    if (ords && ords.length > 0) {
      const { data: its } = await supabase
        .from("booking_order_items")
        .select("*")
        .in("booking_order_id", ords.map((o) => o.id));
      const grouped: Record<string, any[]> = {};
      (its || []).forEach((it: any) => {
        if (!grouped[it.booking_order_id]) grouped[it.booking_order_id] = [];
        grouped[it.booking_order_id].push(it);
      });
      setItems(grouped);
    } else {
      setItems({});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`booking_orders_${booking.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_orders", filter: `booking_id=eq.${booking.id}` },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchOrders(), 500);
        }
      )
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  const handleDelete = async (orderId: string) => {
    if (!confirm("Hapus order ini?")) return;
    const { error } = await supabase.from("booking_orders").delete().eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      toast.success("Order dihapus");
      fetchOrders();
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const grandTotal = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Daftar Order</h4>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              setEditingOrder(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Tambah Order
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-2">Belum ada order</div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const its = items[o.id] || [];
            const isLunas = o.payment_status === "lunas";
            return (
              <div key={o.id} className="border rounded-lg p-2 text-xs bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-primary">{o.bid}</div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isLunas
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isLunas ? "LUNAS" : "BELUM LUNAS"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(o.date), "dd MMM yyyy", { locale: idLocale })}
                </div>
                {its.length > 0 && (
                  <div className="text-[11px]">
                    {its.map((it) => `${it.product_name} x${it.quantity}`).join(", ")}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {o.payment_method}
                    {o.reference_no ? ` (${o.reference_no})` : ""}
                  </span>
                  <span className="font-semibold">{fmt(Number(o.total_amount))}</span>
                </div>
                {o.dual_payment && (
                  <div className="text-[11px] text-muted-foreground">
                    + {o.payment_method_2}
                    {o.reference_no_2 ? ` (${o.reference_no_2})` : ""} — {fmt(Number(o.amount_2))}
                  </div>
                )}
                <div className="flex gap-1 pt-1">
                  {o.payment_proof_urls?.[0] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] flex-1"
                      onClick={() => window.open(o.payment_proof_urls[0], "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Bukti
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] flex-1"
                        onClick={() => {
                          setEditingOrder(o);
                          setModalOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" /> Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] flex-1 text-destructive"
                        onClick={() => handleDelete(o.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Hapus
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-between text-xs font-bold pt-1 border-t">
            <span>Total Semua Order</span>
            <span>{fmt(grandTotal)}</span>
          </div>
        </div>
      )}

      <AddOrderModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={booking}
        order={editingOrder}
        onSaved={fetchOrders}
      />
    </div>
  );
}