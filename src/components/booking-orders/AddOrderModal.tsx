import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Minus, Trash2, Search, User, X } from "lucide-react";
import { toast } from "sonner";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import DiscountDialog from "@/components/purchase/DiscountDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Product {
  id: string;
  name: string;
  price: number;
  images?: any;
}

interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price: number;
  is_active: boolean;
}

interface OrderItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  discount_mode?: "rp" | "pct";
  discount_value?: number;
}

interface AddOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  order?: any | null;
  onSaved: () => void;
}

export default function AddOrderModal({ open, onOpenChange, booking, order, onSaved }: AddOrderModalProps) {
  const { currentStore } = useStore();
  const { methods } = usePaymentMethods();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantPickerFor, setVariantPickerFor] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [dualPayment, setDualPayment] = useState(false);
  const [paymentMethod2, setPaymentMethod2] = useState("");
  const [referenceNo2, setReferenceNo2] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [amount2, setAmount2] = useState<number>(0);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [discountFor, setDiscountFor] = useState<number | null>(null);
  const [priceEditFor, setPriceEditFor] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState<number>(0);

  useEffect(() => {
    if (!open || !currentStore) return;
    (async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, images")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setProducts(prods || []);
      const ids = (prods || []).map((p) => p.id);
      if (ids.length) {
        const { data: vars } = await supabase
          .from("product_variants")
          .select("id, product_id, variant_name, price, is_active")
          .in("product_id", ids)
          .eq("is_active", true);
        setVariants(vars || []);
      } else {
        setVariants([]);
      }
    })();
  }, [open, currentStore]);

  useEffect(() => {
    if (!open) return;
    if (order) {
      setDate(order.date);
      setPaymentMethod(order.payment_method || "Cash");
      setReferenceNo(order.reference_no || "");
      setDualPayment(!!order.dual_payment);
      setPaymentMethod2(order.payment_method_2 || "");
      setReferenceNo2(order.reference_no_2 || "");
      setAmount(Number(order.amount) || 0);
      setAmount2(Number(order.amount_2) || 0);
      setProofUrl(order.payment_proof_urls?.[0] || null);
      setNote(order.note || "");
      supabase
        .from("booking_order_items")
        .select("*")
        .eq("booking_order_id", order.id)
        .then(({ data }) => {
          setItems(
            (data || []).map((d: any) => ({
              product_id: d.product_id,
              product_name: d.product_name,
              quantity: Number(d.quantity),
              unit_price: Number(d.unit_price),
              discount: Number(d.discount) || 0,
              discount_mode: (d.discount_mode as "rp" | "pct") || "rp",
              discount_value: Number(d.discount_value) || 0,
            }))
          );
        });
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("Cash");
      setReferenceNo("");
      setDualPayment(false);
      setPaymentMethod2("");
      setReferenceNo2("");
      setAmount(0);
      setAmount2(0);
      setProofUrl(null);
      setNote("");
      setItems([]);
    }
  }, [open, order]);

  const total = useMemo(
    () => items.reduce((s, it) => s + Math.max(0, it.quantity * it.unit_price - (it.discount || 0)), 0),
    [items]
  );
  const totalPaid = amount + (dualPayment ? amount2 : 0);
  const paymentStatus = totalPaid >= total && total > 0 ? "lunas" : "belum_lunas";

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = (p: Product) => {
    const productVariants = variants.filter((v) => v.product_id === p.id);
    if (productVariants.length > 0) {
      setVariantPickerFor(p);
      return;
    }
    setItems((prev) => {
      const ix = prev.findIndex((i) => i.product_id === p.id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], quantity: next[ix].quantity + 1 };
        return next;
      }
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.price) }];
    });
  };

  const addVariant = (p: Product, v: ProductVariant) => {
    const composedName = `${p.name} - ${v.variant_name}`;
    setItems((prev) => {
      const ix = prev.findIndex((i) => i.product_id === v.id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], quantity: next[ix].quantity + 1 };
        return next;
      }
      return [...prev, { product_id: v.id, product_name: composedName, quantity: 1, unit_price: Number(v.price) }];
    });
    setVariantPickerFor(null);
  };

  const updateQty = (ix: number, qty: number) => {
    setItems((prev) => prev.map((it, i) => (i === ix ? { ...it, quantity: Math.max(0, qty) } : it)));
  };
  const updatePrice = (ix: number, price: number) => {
    setItems((prev) => prev.map((it, i) => (i === ix ? { ...it, unit_price: Math.max(0, price) } : it)));
  };
  const updateDiscount = (ix: number, absolute: number, mode: "rp" | "pct", value: number) => {
    setItems((prev) => prev.map((it, i) => (i === ix ? { ...it, discount: absolute, discount_mode: mode, discount_value: value } : it)));
  };
  const removeItem = (ix: number) => setItems((prev) => prev.filter((_, i) => i !== ix));

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const fmtNum = (n: number) => (n ? new Intl.NumberFormat("id-ID").format(n) : "");
  const parseNum = (s: string) => {
    const d = s.replace(/\D/g, "");
    return d ? parseInt(d, 10) : 0;
  };

  const handleSave = async () => {
    if (!currentStore) return;
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu produk");
      return;
    }
    if (!proofUrl) {
      toast.error("Bukti pembayaran wajib diunggah");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        booking_id: booking.id,
        store_id: currentStore.id,
        date,
        payment_method: paymentMethod,
        reference_no: referenceNo || null,
        dual_payment: dualPayment,
        payment_method_2: dualPayment ? paymentMethod2 : null,
        reference_no_2: dualPayment ? referenceNo2 || null : null,
        amount,
        amount_2: dualPayment ? amount2 : 0,
        total_amount: total,
        payment_status: paymentStatus,
        payment_proof_urls: proofUrl ? [proofUrl] : [],
        note: note || null,
      };

      let orderId = order?.id;
      if (order) {
        const { error } = await supabase.from("booking_orders").update(payload).eq("id", order.id);
        if (error) throw error;
        await supabase.from("booking_order_items").delete().eq("booking_order_id", order.id);
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase
          .from("booking_orders")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        orderId = data.id;
      }

      const itemsPayload = items.map((it) => ({
        booking_order_id: orderId,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount || 0,
        discount_mode: it.discount_mode || "rp",
        discount_value: it.discount_value || 0,
        subtotal: Math.max(0, it.quantity * it.unit_price - (it.discount || 0)),
      }));
      const { error: itemErr } = await supabase.from("booking_order_items").insert(itemsPayload);
      if (itemErr) throw itemErr;

      toast.success(order ? "Order diperbarui" : "Order ditambahkan");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen sm:max-w-none sm:rounded-none p-0 top-0 left-0 translate-x-0 translate-y-0 overflow-hidden flex flex-col border-0 gap-0">
        {/* Top blue header bar */}
        <div className="h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 shrink-0">
          <div className="font-semibold text-lg truncate">
            {order ? `Ubah Order ${order.bid || ""}` : "Tambah Order"} — {booking.customer_name}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-white/10 rounded"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden bg-primary/95">
          {/* LEFT — Nota / Pesanan Baru */}
          <div className="w-[360px] shrink-0 bg-background flex flex-col border-r">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="font-semibold text-sm">Pesanan Baru</div>
              <button
                type="button"
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                title="Tambah catatan"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_50px_90px] gap-2 px-3 py-1.5 text-xs font-semibold bg-muted/60 border-b">
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Jumlah</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6 px-3">
                  Belum ada produk. Klik produk di kanan untuk menambah.
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((it, ix) => {
                    const gross = it.quantity * it.unit_price;
                    const sub = Math.max(0, gross - (it.discount || 0));
                    return (
                      <div key={ix} className="grid grid-cols-[1fr_50px_90px] gap-2 px-3 py-2 text-xs items-start">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.product_name}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => updateQty(ix, it.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => updateQty(ix, it.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <button
                              type="button"
                              onClick={() => setDiscountFor(ix)}
                              className="h-5 px-1.5 text-[10px] border rounded hover:bg-accent"
                              title="Diskon"
                            >
                              {it.discount
                                ? (it.discount_mode === "pct" ? `${it.discount_value}%` : "Disc")
                                : "+Disc"}
                            </button>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive ml-auto" onClick={() => removeItem(ix)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-center pt-1">
                          <Input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateQty(ix, Number(e.target.value))}
                            className="h-6 w-full text-xs text-center px-1"
                          />
                          <div className="text-[10px] text-muted-foreground mt-0.5">x</div>
                        </div>
                        <Popover
                          open={priceEditFor === ix}
                          onOpenChange={(o) => {
                            if (o) { setPriceDraft(it.unit_price); setPriceEditFor(ix); }
                            else setPriceEditFor(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="text-right font-medium hover:underline leading-tight"
                              title="Klik untuk atur harga"
                            >
                              <div>{fmt(sub)}</div>
                              {it.discount ? (
                                <div className="text-[10px] text-destructive">-{fmt(it.discount)}</div>
                              ) : null}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="end">
                            <Label className="text-xs">Harga Satuan</Label>
                            <Input
                              type="number"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(Number(e.target.value))}
                              className="h-8 mt-1"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button size="sm" variant="outline" onClick={() => setPriceEditFor(null)}>Batal</Button>
                              <Button size="sm" onClick={() => { updatePrice(ix, priceDraft); setPriceEditFor(null); }}>OK</Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer + payment fields */}
            <div className="border-t px-3 py-2 text-xs space-y-1 bg-muted/30">
              <div>Jumlah Item: <span className="font-semibold">{items.reduce((s, i) => s + i.quantity, 0)}</span></div>
              <div className="text-muted-foreground">
                Pelanggan: <span className="font-medium text-foreground">{booking.customer_name}</span>
              </div>
              <div className="text-muted-foreground">
                BID Booking: <span className="font-mono text-foreground">{booking.bid}</span>
              </div>
            </div>

            <div className="border-t px-3 py-2 space-y-2 overflow-y-auto max-h-[40%]">
              <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Metode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nominal Bayar</Label>
                <Input
                  inputMode="numeric"
                  value={fmtNum(amount)}
                  onChange={(e) => setAmount(parseNum(e.target.value))}
                  className="h-8"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">No. Referensi</Label>
                <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="h-8" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="dual" checked={dualPayment} onCheckedChange={(v) => setDualPayment(!!v)} />
              <Label htmlFor="dual" className="text-xs cursor-pointer">Pembayaran Ganda</Label>
            </div>

            {dualPayment && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Metode 2</Label>
                  <Select value={paymentMethod2} onValueChange={setPaymentMethod2}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nominal 2</Label>
                  <Input
                    inputMode="numeric"
                    value={fmtNum(amount2)}
                    onChange={(e) => setAmount2(parseNum(e.target.value))}
                    className="h-8"
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">No. Referensi 2</Label>
                  <Input value={referenceNo2} onChange={(e) => setReferenceNo2(e.target.value)} className="h-8" />
                </div>
              </div>
            )}

            <PaymentProofUpload value={proofUrl} onChange={setProofUrl} required compact />

            <div>
              <Label className="text-xs">Catatan</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
            </div>

            <div className={`text-center py-1 rounded-md font-bold text-xs ${
              paymentStatus === "lunas"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}>
              {paymentStatus === "lunas" ? "✓ LUNAS" : "✕ BELUM LUNAS"}
            </div>
            </div>

            {/* Big green total / save bar */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-auto h-16 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-2xl font-bold flex items-center justify-center gap-3 shrink-0"
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {fmt(total)}
            </button>
          </div>

          {/* RIGHT — Product grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 shrink-0">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-10 bg-background"
                  placeholder="Cari produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-3 pb-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {filtered.map((p) => {
                  const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                  const hasVariant = variants.some((v) => v.product_id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="relative bg-background border rounded overflow-hidden text-left hover:ring-2 hover:ring-primary transition flex flex-col"
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                        {img ? (
                          <img src={img} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No img</span>
                        )}
                      </div>
                      {hasVariant && (
                        <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-bl">
                          VAR
                        </span>
                      )}
                      <div className="px-1.5 py-1 text-[11px]">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-right text-muted-foreground font-medium">
                          {new Intl.NumberFormat("id-ID").format(Number(p.price) || 0)}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-full text-center text-white/80 text-sm py-12">
                    Tidak ada produk
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
        {discountFor !== null && items[discountFor] && (
          <DiscountDialog
            open={discountFor !== null}
            onClose={() => setDiscountFor(null)}
            baseAmount={items[discountFor].quantity * items[discountFor].unit_price}
            initialMode={items[discountFor].discount_mode || "rp"}
            initialValue={items[discountFor].discount_value || 0}
            onApply={(abs, mode, val) => updateDiscount(discountFor, abs, mode, val)}
            title="Diskon Item"
          />
        )}
        {variantPickerFor && (
          <Dialog open={!!variantPickerFor} onOpenChange={(o) => !o && setVariantPickerFor(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pilih Varian — {variantPickerFor.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {variants
                  .filter((v) => v.product_id === variantPickerFor.id)
                  .map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVariant(variantPickerFor, v)}
                      className="w-full text-left border rounded p-3 hover:bg-accent flex justify-between items-center"
                    >
                      <span className="font-medium">{v.variant_name}</span>
                      <span className="text-sm text-muted-foreground">{fmt(Number(v.price))}</span>
                    </button>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}