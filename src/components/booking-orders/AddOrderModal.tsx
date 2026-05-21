import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Minus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import DiscountDialog from "@/components/purchase/DiscountDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

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
      <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[95vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{order ? `Ubah Order ${order.bid || ""}` : "Tambah Order"}</DialogTitle>
        </DialogHeader>

        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden rounded border">
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="space-y-3 flex flex-col overflow-hidden h-full p-2">
            <div className="bg-muted/40 rounded p-3 text-sm space-y-1">
              <div className="font-semibold">{booking.customer_name}</div>
              <div className="text-muted-foreground text-xs">{booking.phone || "-"}</div>
              <div className="text-xs">BID Booking: <span className="font-mono">{booking.bid}</span></div>
            </div>

            <div>
              <Label className="text-xs">Cari Produk</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Nama produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded min-h-0">
              <div className="grid grid-cols-2 gap-2 p-2">
                {filtered.map((p) => {
                  const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="text-left border rounded p-2 hover:bg-accent transition text-xs flex gap-2 items-center"
                    >
                      <div className="h-12 w-12 flex-shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-muted-foreground">No img</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-muted-foreground">{fmt(Number(p.price))}</div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-2 text-center text-muted-foreground text-xs py-6">
                    Tidak ada produk
                  </div>
                )}
              </div>
            </ScrollArea>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="space-y-3 overflow-y-auto p-2 h-full">
            <div className="border rounded p-3">
              <div className="font-semibold text-sm mb-2">Nota Order Baru</div>
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Belum ada produk. Klik produk di kiri untuk menambah.
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {items.map((it, ix) => {
                    const gross = it.quantity * it.unit_price;
                    const sub = Math.max(0, gross - (it.discount || 0));
                    return (
                      <div key={ix} className="flex items-center gap-1 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{it.product_name}</div>
                          <button
                            type="button"
                            onClick={() => setDiscountFor(ix)}
                            className="mt-1 h-6 px-2 text-xs border rounded hover:bg-accent w-full text-left"
                            title="Atur diskon (Rp / %)"
                          >
                            {it.discount
                              ? `Diskon: ${it.discount_mode === "pct" ? `${it.discount_value}%` : fmt(it.discount)}`
                              : "+ Diskon"}
                          </button>
                        </div>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(ix, it.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateQty(ix, Number(e.target.value))}
                          className="h-6 w-12 text-xs text-center"
                        />
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(ix, it.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
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
                              className="w-24 text-right font-medium hover:underline leading-tight"
                              title="Klik untuk atur harga"
                            >
                              <div>{fmt(gross)}</div>
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
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(ix)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nominal Bayar</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">No. Referensi</Label>
                <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
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
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nominal 2</Label>
                  <Input type="number" value={amount2} onChange={(e) => setAmount2(Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">No. Referensi 2</Label>
                  <Input value={referenceNo2} onChange={(e) => setReferenceNo2(e.target.value)} />
                </div>
              </div>
            )}

            <PaymentProofUpload value={proofUrl} onChange={setProofUrl} required />

            <div>
              <Label className="text-xs">Catatan</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            <div className={`text-center py-1.5 rounded-md font-bold text-sm ${
              paymentStatus === "lunas"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}>
              {paymentStatus === "lunas" ? "✓ LUNAS" : "✕ BELUM LUNAS"}
            </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}