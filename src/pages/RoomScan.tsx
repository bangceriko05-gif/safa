import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bed, ShoppingCart, ArrowLeft, Plus } from "lucide-react";
import AddOrderModal from "@/components/booking-orders/AddOrderModal";

interface OrderItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  bid: string | null;
  date: string;
  total_amount: number;
  payment_status: string;
  process_status: string;
  customer_name: string | null;
  booking_order_items?: OrderItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

export default function RoomScan() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get("code") || "";
  const [manualCode, setManualCode] = useState(code);
  const [room, setRoom] = useState<{ id: string; name: string } | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(!!code);
  const [notFound, setNotFound] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!code) return;
    setLoading(true);
    setNotFound(false);
    const { data: roomData } = await (supabase as any)
      .from("rooms")
      .select("id, name")
      .eq("barcode_code", code.trim().toUpperCase())
      .maybeSingle();

    if (!roomData) {
      setRoom(null);
      setOrders([]);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRoom(roomData as any);

    const { data: orderData } = await (supabase as any)
      .from("booking_orders")
      .select("id, bid, date, total_amount, payment_status, process_status, customer_name, booking_order_items(product_name, quantity, subtotal)")
      .eq("room_id", (roomData as any).id)
      .order("created_at", { ascending: false })
      .limit(50);

    setOrders((orderData as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const openOrders = orders.filter((o) => (o.process_status || "").toLowerCase() !== "selesai");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke dashboard
        </Button>

        {!code && (
          <Card>
            <CardHeader>
              <CardTitle>Scan Barcode Kamar</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Masukkan kode barcode kamar"
                onKeyDown={(e) => e.key === "Enter" && setParams({ code: manualCode })}
              />
              <Button onClick={() => setParams({ code: manualCode })}>Cari</Button>
            </CardContent>
          </Card>
        )}

        {loading && <p className="text-center text-muted-foreground py-10">Memuat data kamar...</p>}

        {notFound && !loading && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">Barcode "{code}" tidak dikenali.</p>
              <Button variant="outline" onClick={() => setParams({})}>Coba kode lain</Button>
            </CardContent>
          </Card>
        )}

        {room && !loading && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bed className="h-5 w-5" />
                  {room.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {orders.length === 0
                    ? "Belum ada pesanan produk POS dari kamar ini."
                    : `${orders.length} pesanan POS · ${openOrders.length} masih diproses`}
                </p>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Pesanan POS untuk kamar ini
                </Button>
              </CardContent>
            </Card>

            {orders.map((o) => (
              <Card
                key={o.id}
                className="cursor-pointer hover:border-primary/50 transition"
                onClick={() => navigate(`/pos-order/${o.id}`)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <ShoppingCart className="h-4 w-4" />
                      {o.bid || "-"}
                    </div>
                    <Badge variant={(o.process_status || "").toLowerCase() === "selesai" ? "secondary" : "default"}>
                      {o.process_status || "-"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {o.date} · {o.customer_name || "Tanpa nama"} · {o.payment_status}
                  </div>
                  <ul className="text-sm space-y-1">
                    {(o.booking_order_items || []).map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {it.quantity}× {it.product_name}
                        </span>
                        <span>{fmt(it.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{fmt(o.total_amount)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      <AddOrderModal
        open={addOpen}
        onOpenChange={setAddOpen}
        booking={null}
        posMode
        presetRoomId={room?.id || null}
        onSaved={() => {
          setAddOpen(false);
          void load();
        }}
      />
    </div>
  );
}
