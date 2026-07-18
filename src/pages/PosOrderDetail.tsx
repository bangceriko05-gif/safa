import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Printer, Pencil, Bell, ChevronDown, Trash2, Plus, Calendar,
  StickyNote, CheckCircle2, XCircle, Search,
} from "lucide-react";
import AnkaLoader from "@/components/AnkaLoader";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import PaymentDialog, { PaymentDialogResult } from "@/components/purchase/PaymentDialog";
import DiscountDialog from "@/components/purchase/DiscountDialog";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_mode: string;
  discount_value: number;
  subtotal: number;
}

export default function PosOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [creatorName, setCreatorName] = useState<string>("-");
  const [customerName, setCustomerName] = useState<string>("-");
  const [customerPhone, setCustomerPhone] = useState<string>("-");
  const [customerEmail, setCustomerEmail] = useState<string>("-");
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"edit" | "add">("edit");
  const { methods: paymentMethods } = usePaymentMethods();

  // Editing / adding / discount
  const [editItem, setEditItem] = useState<OrderItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [orderDiscountMode, setOrderDiscountMode] = useState<"rp" | "pct">("rp");
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: o } = await supabase
      .from("booking_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!o) { setLoading(false); return; }
    setOrder(o);

    const { data: its } = await supabase
      .from("booking_order_items")
      .select("*")
      .eq("booking_order_id", id)
      .order("created_at", { ascending: true });
    setItems((its as any) || []);

    if ((o as any).created_by) {
      const { data: p } = await supabase
        .from("profiles").select("name").eq("id", (o as any).created_by).maybeSingle();
      if (p?.name) setCreatorName(p.name);
    }

    // If order references a customer through the linked booking
    if ((o as any).booking_id) {
      const { data: b } = await supabase
        .from("bookings")
        .select("customer_name, customer_phone, customer_email")
        .eq("id", (o as any).booking_id)
        .maybeSingle();
      if (b) {
        setCustomerName((b as any).customer_name || "-");
        setCustomerPhone((b as any).customer_phone || "-");
        setCustomerEmail((b as any).customer_email || "-");
      }
    } else {
      // Try to parse customer info from note (POS stores "Nama - 0812..." optionally)
      const note = (o as any).note as string | null;
      if (note) {
        const m = note.match(/Pelanggan:\s*([^|]+?)(?:\s*\|\s*([0-9+\-\s]+))?$/i);
        if (m) {
          setCustomerName((m[1] || "-").trim());
          if (m[2]) setCustomerPhone(m[2].trim());
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Load products for "Tambah Produk"
  useEffect(() => {
    if (!order?.store_id) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("store_id", order.store_id)
        .order("name", { ascending: true });
      setProducts(data || []);
    })();
  }, [order?.store_id]);

  const isLunas = order?.payment_status === "lunas";

  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.subtotal || 0), 0), [items]);
  const totalDiscount = useMemo(
    () => items.reduce((s, it) => s + Number(it.discount || 0) * Number(it.quantity || 0), 0),
    [items]
  );
  const grand = Number(order?.total_amount || 0);
  const paid = isLunas ? grand : Number(order?.amount || 0) + Number(order?.amount_2 || 0);
  const outstanding = Math.max(0, grand - paid);

  // Recompute the order total after items change and persist
  const recomputeOrderTotal = async (nextItems: OrderItem[]) => {
    const sub = nextItems.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const tax = Number(order?.tax_amount || 0);
    const svc = Number(order?.service_charge || 0);
    const total = sub + tax + svc;
    await supabase.from("booking_orders").update({ total_amount: total }).eq("id", id!);
  };

  const saveItemEdit = async (patch: { quantity: number; unit_price: number; discount: number; discount_mode: "rp" | "pct"; discount_value: number }) => {
    if (!editItem) return;
    const subtotal = Math.max(0, (Number(patch.unit_price) - Number(patch.discount)) * Number(patch.quantity));
    const { error } = await supabase
      .from("booking_order_items")
      .update({ ...patch, subtotal })
      .eq("id", editItem.id);
    if (error) { toast.error("Gagal memperbarui"); return; }
    const next = items.map((it) => it.id === editItem.id ? { ...it, ...patch, subtotal } : it);
    setItems(next);
    await recomputeOrderTotal(next);
    toast.success("Item diperbarui");
    setEditItem(null);
    load();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("booking_order_items").delete().eq("id", itemId);
    if (error) { toast.error("Gagal menghapus"); return; }
    const next = items.filter((it) => it.id !== itemId);
    setItems(next);
    await recomputeOrderTotal(next);
    toast.success("Item dihapus");
    load();
  };

  const addProduct = async (p: any) => {
    const subtotal = Number(p.price || 0);
    const { data, error } = await supabase
      .from("booking_order_items")
      .insert({
        booking_order_id: id!,
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        unit_price: Number(p.price || 0),
        discount: 0,
        discount_mode: "rp",
        discount_value: 0,
        subtotal,
      })
      .select()
      .single();
    if (error || !data) { toast.error("Gagal menambah produk"); return; }
    const next = [...items, data as any];
    setItems(next);
    await recomputeOrderTotal(next);
    toast.success(`${p.name} ditambahkan`);
    setAddOpen(false);
    setProductSearch("");
    load();
  };

  // Distribute an order-level discount across items proportionally
  const applyOrderDiscount = async (absolute: number, mode: "rp" | "pct" = "rp", value: number = absolute) => {
    setOrderDiscountMode(mode);
    setOrderDiscountValue(value);
    const sub = items.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.quantity || 0), 0);
    if (sub <= 0) { toast.error("Tidak ada item"); return; }
    const updates = items.map((it) => {
      const gross = Number(it.unit_price) * Number(it.quantity);
      const share = sub > 0 ? (gross / sub) * absolute : 0;
      const perUnit = Number(it.quantity) > 0 ? share / Number(it.quantity) : 0;
      const disc = Math.min(Number(it.unit_price), Math.round(perUnit));
      const subtotal = Math.max(0, (Number(it.unit_price) - disc) * Number(it.quantity));
      return { ...it, discount: disc, discount_mode: "rp", discount_value: disc, subtotal };
    });
    for (const u of updates) {
      await supabase.from("booking_order_items").update({
        discount: u.discount, discount_mode: u.discount_mode, discount_value: u.discount_value, subtotal: u.subtotal,
      }).eq("id", u.id);
    }
    setItems(updates as any);
    await recomputeOrderTotal(updates as any);
    toast.success("Diskon diterapkan");
    load();
  };

  const togglePayment = async () => {
    const next = isLunas ? "belum_lunas" : "lunas";
    const { error } = await supabase
      .from("booking_orders").update({ payment_status: next }).eq("id", id!);
    if (error) toast.error("Gagal mengubah status");
    else { toast.success("Status diperbarui"); load(); }
  };

  const cancelOrder = async () => {
    const { error } = await supabase
      .from("booking_order_items").delete().eq("booking_order_id", id!);
    if (error) { toast.error("Gagal membatalkan"); return; }
    const { error: e2 } = await supabase.from("booking_orders").delete().eq("id", id!);
    if (e2) { toast.error("Gagal membatalkan"); return; }
    toast.success("Order dibatalkan");
    navigate(-1);
  };

  const setStatus = async (label: "Proses" | "Selesai") => {
    const next = label === "Selesai" ? "lunas" : "belum_lunas";
    const { error } = await supabase
      .from("booking_orders").update({ payment_status: next }).eq("id", id!);
    if (error) toast.error("Gagal mengubah status");
    else { toast.success(`Status: ${label}`); load(); }
  };

  const currentStatusLabel = isLunas ? "Selesai" : "Proses";

  const applyPayment = async (r: PaymentDialogResult) => {
    const patch: any = {
      date: format(r.date, "yyyy-MM-dd"),
      payment_method: r.method,
      reference_no: r.reff || null,
    };
    if (payMode === "add") {
      const newTotal = Number(order?.amount || 0) + r.amount;
      patch.amount = newTotal;
    } else {
      patch.amount = r.amount;
    }
    if (patch.amount >= grand) patch.payment_status = "lunas";
    const { error } = await supabase.from("booking_orders").update(patch).eq("id", id!);
    if (error) toast.error("Gagal menyimpan pembayaran");
    else { toast.success("Pembayaran disimpan"); load(); }
  };

  const doPrint = () => window.open(`/receipt?order=${id}`, "_blank");

  if (loading) return <div className="min-h-screen flex items-center justify-center"><AnkaLoader /></div>;
  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Data tidak ditemukan.</p>
      <Button onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Kembali</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">

        {/* Status bar */}
        <div className="bg-card rounded-lg border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {isLunas ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-emerald-700 font-medium">Lunas</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Belum bayar</span></>
            )}
          </div>
          <Switch checked={isLunas} onCheckedChange={togglePayment} />
        </div>

        {/* Header */}
        <div className="bg-card rounded-lg border p-4 flex flex-col md:flex-row md:items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              {/* balloon-ish */}
              <span className="text-primary text-lg">🎈</span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-lg font-semibold truncate">{order.bid || order.id.slice(0, 12)}</div>
              <div className="text-xs text-muted-foreground truncate">Penjualan Oleh {creatorName}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Bell className="h-4 w-4" /> Notifikasi <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Belum tersedia")}>Kirim WhatsApp</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Belum tersedia")}>Kirim Email</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2" onClick={doPrint}>
              <Printer className="h-4 w-4" /> Cetak
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-medium">
                  {currentStatusLabel} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatus("Proses")}>Proses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("Selesai")}>Selesai</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={cancelOrder}
                  className="text-destructive focus:text-destructive"
                >
                  Pembatalan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="px-3 py-1.5 rounded-md border bg-background text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(new Date(order.date), "dd-MM-yyyy", { locale: idLocale })}
            </div>
          </div>
        </div>

        {/* Customer + Shipping destination */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Pelanggan">
            <InfoRow label="Nama" value={customerName} />
            <InfoRow label="Email" value={customerEmail} />
            <InfoRow label="Telpon" value={customerPhone} last />
          </SectionCard>
          <SectionCard title="Tujuan Pengiriman">
            <InfoRow label="Nama" value="-" />
            <InfoRow label="Alamat" value="-" />
            <InfoRow label="Telpon" value="-" last />
          </SectionCard>
        </div>

        {/* Shipping status + drop ship */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Status Pengiriman">
            <InfoRow label="Kurir Pengiriman" value="-" />
            <InfoRow label="Tipe Layanan Pengiriman" value="-" />
            <InfoRow label="Tanggal Kirim" value="-" />
            <InfoRow label="No. Tracking" value="-" last />
          </SectionCard>
          <SectionCard title="Drop Ship">
            <InfoRow label="Nama Toko" value="-" />
            <InfoRow label="Pengirim" value="-" />
            <InfoRow label="Telpon" value="-" last />
          </SectionCard>
        </div>

        {/* Produk Pesanan */}
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Produk Pesanan</div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Deskripsi</th>
                  <th className="text-left px-4 py-2 font-medium">Seri</th>
                  <th className="text-left px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">Harga (IDR)</th>
                  <th className="text-right px-4 py-2 font-medium">Diskon</th>
                  <th className="text-right px-4 py-2 font-medium">Total Harga (IDR)</th>
                  <th className="text-right px-4 py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2">
                      <span className="text-primary font-medium">{it.product_name}</span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">-</td>
                    <td className="px-4 py-2 text-primary">{it.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(it.unit_price)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(it.discount || 0) * Number(it.quantity || 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(it.subtotal)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setEditItem(it)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(it.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Tidak ada produk</td></tr>
                )}
                <tr className="bg-muted/30 border-t">
                  <td className="px-4 py-2 text-right text-primary" colSpan={2}>Total Pesanan</td>
                  <td className="px-4 py-2 text-primary">{items.reduce((s, it) => s + Number(it.quantity || 0), 0)}</td>
                  <td colSpan={4}></td>
                </tr>
                <SummaryRow label="Subtotal" value={`IDR ${fmt(subtotal)}`} />
                <SummaryRow
                  label="Diskon"
                  value={`IDR ${fmt(totalDiscount)} (${subtotal ? ((totalDiscount / subtotal) * 100).toFixed(2) : "0.00"}%)`}
                  action="Pengaturan Diskon"
                  onAction={() => setDiscountOpen(true)}
                />
                <SummaryRow label="Biaya Layanan" value={`IDR ${fmt(Number(order.service_charge || 0))}`} />
                <SummaryRow label="Pajak" value={`IDR ${fmt(Number(order.tax_amount || 0))}`} />
                <SummaryRow label="Pembulatan" value="IDR 0" />
                <SummaryRow label="Biaya admin" value="IDR 0" />
                <SummaryRow label="Biaya Pengiriman" value="IDR 0" action="Pengaturan Biaya Pengiriman" />
                <SummaryRow label="Total Ditagihkan" value={`IDR ${fmt(grand)}`} bold />
                <SummaryRow
                  label={`Pembayaran ${(order.payment_method || "").toUpperCase() || "-"}`}
                  value={`IDR ${fmt(paid)}`}
                  action="Pengaturan Pembayaran"
                  onAction={() => { setPayMode("edit"); setPayOpen(true); }}
                />
                <SummaryRow
                  label="Pembayaran yang belum lunas"
                  value={`IDR ${fmt(outstanding)}`}
                  action={outstanding > 0 ? "+ Pembayaran" : undefined}
                  onAction={outstanding > 0 ? () => { setPayMode("add"); setPayOpen(true); } : undefined}
                />
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-right space-y-1 text-muted-foreground border-t">
            <div><span className="font-medium">Pembayaran via {order.payment_method ? String(order.payment_method).toUpperCase() : "-"} :</span> -</div>
            <div><span className="font-medium">Tambahan Pembayaran :</span> 0.00</div>
            <div><span className="font-medium">Referensi Pembayaran :</span> {order.reference_no || "-"}</div>
            <div><span className="font-medium">Tanggal Pembayaran :</span> {format(new Date(order.date), "dd-MMM-yyyy", { locale: idLocale })}</div>
          </div>
        </div>

        {/* Pelayan POS + Jatuh tempo */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Pelayan POS">
            <div className="p-4 text-primary">{creatorName}</div>
          </SectionCard>
          <SectionCard title="Jatuh Tempo Pembayaran">
            <div className="p-6 text-center">
              {format(new Date(new Date(order.date).getTime() + 30 * 24 * 3600 * 1000), "dd-MMM-yyyy", { locale: idLocale })}
            </div>
          </SectionCard>
        </div>

        {/* Catatan + Invoice Footer */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Catatan" extra={
            <Badge variant="outline" className="text-primary border-primary/40 gap-1">
              <StickyNote className="h-3 w-3" /> Pembeli
            </Badge>
          }>
            <div className="p-4 bg-muted/30 min-h-[120px] text-muted-foreground text-sm">
              {order.note || "Tidak ada"}
            </div>
          </SectionCard>
          <SectionCard title="Invoice Footer">
            <div className="p-4 bg-muted/30 min-h-[120px] text-sm">
              <div className="text-muted-foreground">Tidak ada</div>
              <div className="mt-6 text-muted-foreground">Untuk info lebih lanjut, bisa hubungi Tim Support kami</div>
            </div>
          </SectionCard>
        </div>

        {/* File Lampiran */}
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">File Lampiran</div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Belum tersedia")}>
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {(order.payment_proof_urls || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada lampiran</div>
            ) : (
              (order.payment_proof_urls as string[]).map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer"
                  className="block h-20 w-20 rounded border overflow-hidden bg-muted">
                  <img src={u} alt="lampiran" className="h-full w-full object-cover" />
                </a>
              ))
            )}
          </div>
        </div>

        {/* Batalkan orderan */}
        <div className="bg-card rounded-lg border">
          <button
            onClick={cancelOrder}
            className="w-full py-4 flex items-center justify-center gap-2 text-destructive font-medium hover:bg-destructive/5"
          >
            <Trash2 className="h-4 w-4" /> Batalkan orderan
          </button>
        </div>

        {/* Log */}
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-3 border-b font-semibold">Log</div>
          <div className="p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-primary">Terakhir Diperbarui</span>
              <span>{creatorName}, {format(new Date(order.updated_at), "dd-MMM-yyyy HH:mm:ss", { locale: idLocale })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-primary">Waktu Pembuatan</span>
              <span>{creatorName}, {format(new Date(order.created_at), "dd-MMM-yyyy HH:mm:ss", { locale: idLocale })}</span>
            </div>
          </div>
        </div>

      </div>

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        remaining={payMode === "add" ? outstanding : grand}
        paymentMethods={paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
        initialMethod={payMode === "edit" ? (order?.payment_method || "") : ""}
        initialReff={payMode === "edit" ? (order?.reference_no || "") : ""}
        initialAmount={payMode === "edit" ? Number(order?.amount || 0) : outstanding}
        initialDate={order?.date ? new Date(order.date) : new Date()}
        onApply={applyPayment}
      />

      <DiscountDialog
        key={discountOpen ? "disc-open" : "disc-closed"}
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        baseAmount={items.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.quantity || 0), 0)}
        initialMode={orderDiscountMode}
        initialValue={orderDiscountValue || totalDiscount}
        onApply={(abs, mode, value) => applyOrderDiscount(abs, mode, value)}
        title="Pengaturan Diskon"
      />

      <EditItemDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={saveItemEdit}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tambah Produk</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Cari produk..."
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-auto divide-y border rounded-md">
            {products
              .filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
              .slice(0, 100)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-left"
                >
                  <span className="text-sm">{p.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">Rp {fmt(p.price)}</span>
                </button>
              ))}
            {products.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Tidak ada produk</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditItemDialog({
  item, onClose, onSave,
}: {
  item: OrderItem | null;
  onClose: () => void;
  onSave: (patch: { quantity: number; unit_price: number; discount: number; discount_mode: "rp" | "pct"; discount_value: number }) => void;
}) {
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [discMode, setDiscMode] = useState<"rp" | "pct">("rp");
  const [discValue, setDiscValue] = useState(0);

  useEffect(() => {
    if (item) {
      setQty(Number(item.quantity || 1));
      setPrice(Number(item.unit_price || 0));
      setDiscMode((item.discount_mode as "rp" | "pct") || "rp");
      setDiscValue(Number(item.discount_value || 0));
    }
  }, [item]);

  const discountAbs = discMode === "pct"
    ? Math.round((price * Math.min(100, Math.max(0, discValue))) / 100)
    : Math.max(0, discValue);
  const subtotal = Math.max(0, (price - discountAbs) * qty);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Produk</Label>
            <div className="text-sm font-medium">{item?.product_name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <Input type="number" min={1} value={qty || ""} onChange={(e) => setQty(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Harga (Rp)</Label>
              <Input
                inputMode="numeric"
                value={price ? new Intl.NumberFormat("id-ID").format(price) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setPrice(raw ? parseInt(raw, 10) : 0);
                }}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Diskon</Label>
            <div className="flex gap-2 mt-1">
              <div className="inline-flex rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => setDiscMode("rp")}
                  className={`px-3 py-1 text-sm rounded ${discMode === "rp" ? "bg-primary text-primary-foreground" : ""}`}
                >Rp</button>
                <button
                  type="button"
                  onClick={() => setDiscMode("pct")}
                  className={`px-3 py-1 text-sm rounded ${discMode === "pct" ? "bg-primary text-primary-foreground" : ""}`}
                >%</button>
              </div>
              <Input
                type="number"
                min={0}
                max={discMode === "pct" ? 100 : undefined}
                value={discValue || ""}
                onChange={(e) => setDiscValue(parseFloat(e.target.value) || 0)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold tabular-nums">Rp {new Intl.NumberFormat("id-ID").format(subtotal)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={() => onSave({
            quantity: qty,
            unit_price: price,
            discount: discountAbs,
            discount_mode: discMode,
            discount_value: discValue,
          })}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          {extra}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? "" : "border-b"}`}>
      <span className="text-primary text-sm">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, action, bold, onAction }: { label: string; value: string; action?: string; bold?: boolean; onAction?: () => void }) {
  return (
    <tr className="border-t">
      <td colSpan={4} className={`px-4 py-2 text-right text-primary ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td></td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</td>
      <td className="px-4 py-2 text-right text-primary text-xs">
        {action ? <button onClick={onAction} className="hover:underline">⚙ {action}</button> : null}
      </td>
    </tr>
  );
}