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
import { Loader2, Plus, Minus, Trash2, Search, User, Printer, MessageCircle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import DiscountDialog from "@/components/purchase/DiscountDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Product {
  id: string;
  name: string;
  price: number;
  images?: any;
  category_id?: string | null;
  dynamic_price?: boolean;
  tax_enabled?: boolean;
  tax_mode?: string | null;
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
  booking: any | null;
  order?: any | null;
  onSaved: () => void;
  posMode?: boolean;
}

export default function AddOrderModal({ open, onOpenChange, booking, order, onSaved, posMode = false }: AddOrderModalProps) {
  const { currentStore } = useStore();
  const { methods } = usePaymentMethods();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
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

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 360;
    const saved = Number(localStorage.getItem("pos_left_width") || 0);
    return saved >= 280 && saved <= 720 ? saved : 360;
  });
  const [resizing, setResizing] = useState(false);

  // Finish action popup (Print / WhatsApp)
  const [finishOpen, setFinishOpen] = useState(false);
  const [waPhone, setWaPhone] = useState("");

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(720, Math.max(280, e.clientX));
      setLeftWidth(w);
    };
    const onUp = () => {
      setResizing(false);
      try { localStorage.setItem("pos_left_width", String(leftWidth)); } catch {}
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, leftWidth]);

  // POS-mode customer matching
  const [posCustomerName, setPosCustomerName] = useState("");
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [matchedBooking, setMatchedBooking] = useState<any | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");

  // Transaction-wide discount
  const [txDiscountMode, setTxDiscountMode] = useState<"rp" | "pct">("rp");
  const [txDiscountValue, setTxDiscountValue] = useState<number>(0);
  // Per-transaction toggle: cashier can opt out of the configured service charge
  const [applyServiceCharge, setApplyServiceCharge] = useState<boolean>(true);
  const effectiveBooking = booking || matchedBooking;

  // POS settings (per store)
  const [posSettings, setPosSettings] = useState<{
    require_payment_proof: boolean;
    require_customer: boolean;
    enable_print: boolean;
    service_charge_enabled: boolean;
    service_charge_type: "percent" | "nominal";
    service_charge_value: number;
  }>({
    require_payment_proof: true,
    require_customer: false,
    enable_print: true,
    service_charge_enabled: false,
    service_charge_type: "percent",
    service_charge_value: 0,
  });

  // Store-wide PPN settings
  const [storeTax, setStoreTax] = useState<{
    enabled: boolean;
    rate: number;
    modesAllowed: string[];
  }>({ enabled: false, rate: 0, modesAllowed: ["include", "exclude"] });

  useEffect(() => {
    if (!open || !currentStore) return;
    (async () => {
      const { data } = await supabase
        .from("pos_settings")
        .select("*")
        .eq("store_id", currentStore.id)
        .maybeSingle();
      if (data) {
        setPosSettings({
          require_payment_proof: !!(data as any).require_payment_proof,
          require_customer: !!(data as any).require_customer,
          enable_print: !!(data as any).enable_print,
          service_charge_enabled: !!(data as any).service_charge_enabled,
          service_charge_type: ((data as any).service_charge_type as "percent" | "nominal") || "percent",
          service_charge_value: Number((data as any).service_charge_value) || 0,
        });
      }
      const { data: s } = await supabase
        .from("stores")
        .select("tax_enabled, tax_rate, tax_modes_allowed")
        .eq("id", currentStore.id)
        .maybeSingle();
      if (s) {
        setStoreTax({
          enabled: !!(s as any).tax_enabled,
          rate: Number((s as any).tax_rate) || 0,
          modesAllowed: ((s as any).tax_modes_allowed as string[]) || ["include", "exclude"],
        });
      }
    })();
  }, [open, currentStore]);

  useEffect(() => {
    if (!open || !currentStore) return;
    (async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, images, category_id, dynamic_price, tax_enabled, tax_mode")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setProducts(prods || []);
      const { data: cats } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .order("name");
      setCategories(cats || []);
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
    if (!open || !posMode || !currentStore) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, bid, customer_name, phone, status, room_id, rooms(name)")
        .eq("store_id", currentStore.id)
        .in("status", ["checked_in", "confirmed", "in", "CI"])
        .order("customer_name");
      setActiveBookings(data || []);
      const { fetchCustomersCached } = await import("@/utils/customerCache");
      const cust = await fetchCustomersCached(currentStore.id);
      setDbCustomers(cust as any);
    })();
  }, [open, posMode, currentStore]);

  useEffect(() => {
    if (!open) {
      setPosCustomerName("");
      setMatchedBooking(null);
      setShowSuggest(false);
      setManualCustomerName("");
      setTxDiscountMode("rp");
      setTxDiscountValue(0);
    }
  }, [open]);

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

  const itemsSubtotal = useMemo(
    () => items.reduce((s, it) => s + Math.max(0, it.quantity * it.unit_price - (it.discount || 0)), 0),
    [items]
  );
  const txDiscountAmount = useMemo(() => {
    if (!txDiscountValue) return 0;
    if (txDiscountMode === "pct") return Math.round((itemsSubtotal * txDiscountValue) / 100);
    return Math.min(itemsSubtotal, txDiscountValue);
  }, [itemsSubtotal, txDiscountMode, txDiscountValue]);
  const netAfterDiscount = Math.max(0, itemsSubtotal - txDiscountAmount);

  // PPN computation — per-item, respects store tax setting + product tax_enabled
  const taxSummary = useMemo(() => {
    if (!storeTax.enabled || !storeTax.rate) {
      return { excludeTax: 0, includeTax: 0, hasExclude: false, hasInclude: false };
    }
    const r = storeTax.rate / 100;
    let excludeTax = 0;
    let includeTax = 0;
    const subtotalBase = items.reduce(
      (s, it) => s + Math.max(0, it.quantity * it.unit_price - (it.discount || 0)),
      0,
    );
    for (const it of items) {
      const lineNet = Math.max(0, it.quantity * it.unit_price - (it.discount || 0));
      if (!lineNet) continue;
      // Resolve product (direct or via variant parent)
      let prod = products.find((p) => p.id === it.product_id);
      if (!prod) {
        const v = variants.find((x) => x.id === it.product_id);
        if (v) prod = products.find((p) => p.id === v.product_id);
      }
      if (!prod?.tax_enabled) continue;
      // Apply proportional share of transaction-level discount to base
      const share =
        subtotalBase > 0 ? (lineNet / subtotalBase) * txDiscountAmount : 0;
      const base = Math.max(0, lineNet - share);
      const mode = (prod.tax_mode as "include" | "exclude") || "exclude";
      if (mode === "include") {
        const dpp = base / (1 + r);
        includeTax += base - dpp;
      } else {
        excludeTax += base * r;
      }
    }
    return {
      excludeTax: Math.round(excludeTax),
      includeTax: Math.round(includeTax),
      hasExclude: excludeTax > 0,
      hasInclude: includeTax > 0,
    };
  }, [items, products, variants, storeTax, txDiscountAmount]);

  const serviceChargeAmount = useMemo(() => {
    if (!posSettings.service_charge_enabled || !applyServiceCharge) return 0;
    if (posSettings.service_charge_type === "percent") {
      const base = netAfterDiscount + taxSummary.excludeTax;
      return Math.round((base * posSettings.service_charge_value) / 100);
    }
    return Math.max(0, posSettings.service_charge_value);
  }, [posSettings, netAfterDiscount, applyServiceCharge, taxSummary.excludeTax]);
  const total = netAfterDiscount + taxSummary.excludeTax + serviceChargeAmount;
  const totalPaid = amount + (dualPayment ? amount2 : 0);
  const paymentStatus = totalPaid >= total && total > 0 ? "lunas" : "belum_lunas";

  // Auto-fill Nominal Bayar with total when not dual payment (and not editing an existing order)
  useEffect(() => {
    if (dualPayment) return;
    if (order) return;
    setAmount(total);
  }, [total, dualPayment, order]);

  const filtered = products.filter((p) => {
    if (activeCategory !== "all" && (p.category_id || "") !== activeCategory) return false;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  const isDynamicPriceItem = (productId: string | null) => {
    if (!productId) return true;
    const direct = products.find((p) => p.id === productId);
    if (direct) return !!direct.dynamic_price;
    const v = variants.find((x) => x.id === productId);
    if (v) {
      const parent = products.find((p) => p.id === v.product_id);
      return !!parent?.dynamic_price;
    }
    return false;
  };

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

  const handleSave = async (afterAction: "print" | "whatsapp" | null = null, waPhoneOverride?: string) => {
    if (!currentStore) return;
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu produk");
      return;
    }
    const proofRequired = posMode ? posSettings.require_payment_proof : true;
    if (proofRequired && !proofUrl) {
      toast.error("Bukti pembayaran wajib diunggah");
      return;
    }
    if (posMode && posSettings.require_customer && !effectiveBooking && !manualCustomerName) {
      toast.error("Silakan pilih pelanggan terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const discountNote =
        txDiscountAmount > 0
          ? `[Diskon Transaksi: ${
              txDiscountMode === "pct" ? `${txDiscountValue}% = ` : ""
            }${fmt(txDiscountAmount)}]`
          : "";
      const svcNote =
        serviceChargeAmount > 0
          ? `[Service Charge: ${
              posSettings.service_charge_type === "percent"
                ? `${posSettings.service_charge_value}% = `
                : ""
            }${fmt(serviceChargeAmount)}]`
          : "";
      const customerDisplayName = effectiveBooking?.customer_name || manualCustomerName || null;
      const customerNote =
        customerDisplayName && !effectiveBooking ? `(Pelanggan: ${customerDisplayName})` : "";
      const finalNote = [discountNote, svcNote, customerNote, note].filter(Boolean).join(" ").trim();
      const payload: any = {
        booking_id: effectiveBooking ? effectiveBooking.id : null,
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
        note: finalNote || null,
        service_charge: serviceChargeAmount,
        service_charge_type: serviceChargeAmount > 0 ? posSettings.service_charge_type : null,
        service_charge_value: serviceChargeAmount > 0 ? posSettings.service_charge_value : null,
        tax_enabled: storeTax.enabled && (taxSummary.hasExclude || taxSummary.hasInclude),
        tax_mode:
          taxSummary.hasExclude && taxSummary.hasInclude
            ? "mixed"
            : taxSummary.hasExclude
            ? "exclude"
            : taxSummary.hasInclude
            ? "include"
            : null,
        tax_rate: storeTax.enabled ? storeTax.rate : 0,
        tax_amount: taxSummary.excludeTax,
        tax_included_amount: taxSummary.includeTax,
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

      // Post-save action
      if (afterAction === "print") {
        const bookingIdParam = effectiveBooking?.id ? `id=${effectiveBooking.id}&` : "";
        window.open(`/receipt?${bookingIdParam}order=${orderId}`, "_blank");
      } else if (afterAction === "whatsapp") {
        const phoneRaw = (waPhoneOverride || "").replace(/\D/g, "");
        if (phoneRaw) {
          let phone = phoneRaw;
          if (phone.startsWith("0")) phone = "62" + phone.slice(1);
          else if (!phone.startsWith("62")) phone = "62" + phone;
          const bookingIdParam = effectiveBooking?.id ? `id=${effectiveBooking.id}&` : "";
          const receiptUrl = `${window.location.origin}/receipt?${bookingIdParam}order=${orderId}`;
          const custName = effectiveBooking?.customer_name || manualCustomerName || "";
          const msg =
            `Halo${custName ? ` ${custName}` : ""}! 🙏\n\n` +
            `Berikut nota digital pesanan Anda dari *${currentStore.name || ""}*.\n` +
            `Total: *${fmt(total)}*\n\n` +
            `Lihat nota:\n${receiptUrl}\n\nTerima kasih!`;
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
        } else {
          toast.error("Nomor WhatsApp belum diisi");
        }
      }

      setFinishOpen(false);
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
      <DialogContent className="max-w-none w-screen h-screen sm:max-w-none sm:rounded-none p-0 top-0 left-0 translate-x-0 translate-y-0 overflow-hidden flex flex-col border-0 gap-0 [&>button.absolute]:hidden">
        {/* Top blue header bar */}
        <div className="h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 shrink-0">
          <div className="font-semibold text-lg truncate">
            {order
              ? `Ubah Order ${order.bid || ""}`
              : posMode
              ? "POS Kasir"
              : "Tambah Order"}
            {effectiveBooking ? ` — ${effectiveBooking.customer_name}` : ""}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {order?.id && (!posMode || posSettings.enable_print) && (
              <button
                type="button"
                onClick={() => window.open(`/receipt?id=${booking.id}&order=${order.id}`, "_blank")}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-white/15 hover:bg-white/25 text-sm"
                title="Cetak nota order"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center px-3 h-8 rounded bg-white text-red-600 font-bold text-sm hover:bg-red-50"
              title="Tutup"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-primary/95">
          {/* LEFT — Nota / Pesanan Baru */}
  <div style={{ width: leftWidth }} className="shrink-0 bg-background flex flex-col border-r">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              {posMode && !booking ? (
                <button
                  type="button"
                  onClick={() => setCustomerPickerOpen(true)}
                  className="h-7 w-7 rounded-full hover:bg-accent flex items-center justify-center"
                  title="Pilih pelanggan"
                >
                  <User className={`h-4 w-4 ${effectiveBooking || manualCustomerName ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
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
                      <div key={ix} className="grid grid-cols-[1fr_88px_90px] gap-2 px-3 py-2 text-xs items-center">
                        <div className="min-w-0">
                          <div className="font-medium truncate leading-tight">{it.product_name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
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
                            <button
                              type="button"
                              onClick={() => removeItem(ix)}
                              className="h-5 w-5 inline-flex items-center justify-center text-destructive hover:bg-destructive/10 rounded"
                              title="Hapus"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6 shrink-0" onClick={() => updateQty(ix, it.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateQty(ix, Number(e.target.value))}
                            className="h-6 w-9 text-xs text-center px-0"
                          />
                          <Button size="icon" variant="outline" className="h-6 w-6 shrink-0" onClick={() => updateQty(ix, it.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {isDynamicPriceItem(it.product_id) ? (
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
                        ) : (
                          <div className="text-right font-medium leading-tight" title="Harga terkunci">
                            <div>{fmt(gross)}</div>
                            {it.discount ? (
                              <div className="text-[10px] text-destructive">-{fmt(it.discount)}</div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer + payment fields */}
            <div className="border-t px-3 py-2 text-xs space-y-1 bg-muted/30">
              <div>Jumlah Item: <span className="font-semibold">{items.reduce((s, i) => s + i.quantity, 0)}</span></div>
              {posMode && !booking ? (
                (effectiveBooking || manualCustomerName) && (
                  <div className="text-muted-foreground">
                    Pelanggan:{" "}
                    <span className="font-medium text-foreground">
                      {effectiveBooking?.customer_name || manualCustomerName}
                    </span>
                    {matchedBooking && (
                      <span className="ml-1 text-emerald-700">
                        (BID <span className="font-mono">{matchedBooking.bid}</span>)
                      </span>
                    )}
                  </div>
                )
              ) : (
                <>
                  <div className="text-muted-foreground">
                    Pelanggan: <span className="font-medium text-foreground">{effectiveBooking?.customer_name || "—"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    BID Booking: <span className="font-mono text-foreground">{effectiveBooking?.bid || "—"}</span>
                  </div>
                </>
              )}
              <div className="pt-1">
                <Label className="text-[11px]">Diskon</Label>
                <div className="flex gap-1">
                  <Select value={txDiscountMode} onValueChange={(v) => setTxDiscountMode(v as "rp" | "pct")}>
                    <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rp">Rp</SelectItem>
                      <SelectItem value="pct">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    className="h-8 text-xs"
                    placeholder="0"
                    value={txDiscountValue ? fmtNum(txDiscountValue) : ""}
                    onChange={(e) => {
                      const v = parseNum(e.target.value);
                      if (txDiscountMode === "pct") setTxDiscountValue(Math.min(100, v));
                      else setTxDiscountValue(v);
                    }}
                  />
                </div>
                {txDiscountAmount > 0 && (
                  <div className="text-[11px] text-destructive mt-0.5">- {fmt(txDiscountAmount)}</div>
                )}
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

            <PaymentProofUpload
              value={proofUrl}
              onChange={setProofUrl}
              required={posMode ? posSettings.require_payment_proof : true}
              compact
            />

            {posSettings.service_charge_enabled && (
              <div className="flex items-center justify-between text-xs px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={applyServiceCharge}
                    onCheckedChange={(v) => setApplyServiceCharge(!!v)}
                  />
                  <span className="text-muted-foreground">
                    Service Charge
                    {posSettings.service_charge_type === "percent"
                      ? ` (${posSettings.service_charge_value}%)`
                      : ""}
                  </span>
                </label>
                <span className={`font-semibold ${applyServiceCharge ? "" : "text-muted-foreground line-through"}`}>
                  + {fmt(
                    posSettings.service_charge_type === "percent"
                      ? Math.round((netAfterDiscount * posSettings.service_charge_value) / 100)
                      : Math.max(0, posSettings.service_charge_value)
                  )}
                </span>
              </div>
            )}

            {(taxSummary.hasExclude || taxSummary.hasInclude) && (
              <div className="space-y-0.5 px-1">
                {taxSummary.hasExclude && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      PPN ({storeTax.rate}%)
                    </span>
                    <span className="font-semibold">
                      + {fmt(taxSummary.excludeTax)}
                    </span>
                  </div>
                )}
                {taxSummary.hasInclude && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>PPN ({storeTax.rate}%) termasuk harga</span>
                    <span>{fmt(taxSummary.includeTax)}</span>
                  </div>
                )}
              </div>
            )}

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
              onClick={() => {
                if (items.length === 0) {
                  toast.error("Tambahkan minimal satu produk");
                  return;
                }
                setWaPhone(
                  (effectiveBooking?.phone as string) ||
                    (effectiveBooking?.customer_phone as string) ||
                    "",
                );
                setFinishOpen(true);
              }}
              disabled={saving}
              className="mt-auto h-16 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-2xl font-bold flex items-center justify-center gap-3 shrink-0"
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {fmt(total)}
            </button>
          </div>

          {/* Resizer between left and right */}
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
            className={`w-1.5 shrink-0 cursor-col-resize bg-primary/30 hover:bg-primary/60 active:bg-primary/70 transition-colors relative group ${resizing ? "bg-primary/70" : ""}`}
            title="Geser untuk mengatur lebar"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
            <GripVertical className="h-4 w-4 text-white/70 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
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
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                    activeCategory === "all"
                      ? "bg-background text-foreground border-background"
                      : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                  }`}
                >
                  Semua Kategori
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                      activeCategory === c.id
                        ? "bg-background text-foreground border-background"
                        : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
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
        {customerPickerOpen && (
          <Dialog open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pilih Pelanggan</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Cari nama pelanggan..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Atau ketik manual (tidak tersimpan)"
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setMatchedBooking(null);
                      setPosCustomerName("");
                      setCustomerPickerOpen(false);
                    }}
                    disabled={!manualCustomerName.trim()}
                  >
                    Pakai
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto border rounded divide-y">
                  {activeBookings.length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold bg-muted text-muted-foreground">
                      Pelanggan di Kamar (BID)
                    </div>
                  )}
                  {activeBookings
                    .filter((b) => !customerSearch || b.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()))
                    .map((b) => (
                      <button
                        key={`bk-${b.id}`}
                        type="button"
                        onClick={() => {
                          setMatchedBooking(b);
                          setPosCustomerName(b.customer_name || "");
                          setManualCustomerName("");
                          setCustomerPickerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        <div className="font-medium">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {b.bid} · {b.rooms?.name || ""}
                        </div>
                      </button>
                    ))}
                  {dbCustomers.length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold bg-muted text-muted-foreground">
                      Database Pelanggan
                    </div>
                  )}
                  {dbCustomers
                    .filter((c) => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()))
                    .slice(0, 50)
                    .map((c) => (
                      <button
                        key={`cu-${c.id}`}
                        type="button"
                        onClick={() => {
                          setMatchedBooking(null);
                          setManualCustomerName(c.name);
                          setPosCustomerName("");
                          setCustomerPickerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </button>
                    ))}
                </div>
                {(effectiveBooking || manualCustomerName) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMatchedBooking(null);
                      setManualCustomerName("");
                      setPosCustomerName("");
                      setCustomerPickerOpen(false);
                    }}
                  >
                    Hapus pilihan pelanggan
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Finish action popup: Print or WhatsApp */}
        <Dialog open={finishOpen} onOpenChange={(o) => !saving && setFinishOpen(o)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Selesaikan Transaksi</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-center py-3 rounded-md bg-emerald-50 text-emerald-700">
                <div className="text-xs">Total Pembayaran</div>
                <div className="text-2xl font-bold">{fmt(total)}</div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Pilih cara mengirim nota ke pelanggan.
              </p>

              {(!posMode || posSettings.enable_print) && (
                <Button
                  className="w-full h-12 justify-start gap-3"
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleSave("print")}
                >
                  <Printer className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Cetak Printer</div>
                    <div className="text-[11px] text-muted-foreground">Simpan lalu buka nota untuk dicetak</div>
                  </div>
                </Button>
              )}

              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  Kirim Nota Digital via WhatsApp
                </div>
                <Input
                  placeholder="Nomor WhatsApp pelanggan (mis. 0812xxxx)"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  className="h-9"
                  inputMode="tel"
                />
                <Button
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700"
                  disabled={saving || !waPhone.trim()}
                  onClick={() => handleSave("whatsapp", waPhone)}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Kirim via WhatsApp
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                disabled={saving}
                onClick={() => handleSave(null)}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Simpan Tanpa Nota
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}