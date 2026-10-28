import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, Plus, Minus, Trash2, Search, User, Printer, MessageCircle, GripVertical, Settings2, ClipboardList, Globe, ExternalLink, Copy, Check, X, Package } from "lucide-react";
import { toast } from "sonner";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import DiscountDialog from "@/components/purchase/DiscountDialog";
import ProductCategoryManager from "@/components/products/ProductCategoryManager";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CustomerNameInput from "@/components/customers/CustomerNameInput";
import PosPaymentPanel from "./PosPaymentPanel";
import DokuCheckoutPanel, { type DokuCheckoutState } from "./DokuCheckoutPanel";
import { canConfirmPosService } from "@/utils/posServiceConfirmation";
import { functionErrorMessage, userFacingError } from "@/utils/userFacingError";
import { dokuGroupForMethod, enabledDokuCodes, opensDokuOnSelection, isVerifiedDokuCheckoutUrl } from "@/utils/dokuChannels";
import { useTransactionCancellation, appendCancellationReason } from "@/hooks/useTransactionCancellation";
import { isLocalPosDraft, readPosOrderDrafts, removePosOrderDraft, savePosOrderDraft } from "@/utils/posOrderDrafts";

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
  notes?: string;
}

interface AddOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any | null;
  order?: any | null;
  onSaved: () => void;
  posMode?: boolean;
  presetRoomId?: string | null;
}

export default function AddOrderModal({ open, onOpenChange, booking, order, onSaved, posMode = false, presetRoomId = null }: AddOrderModalProps) {
  const { currentStore } = useStore();
  const { methods } = usePaymentMethods();
  // Channel DOKU aktif untuk outlet ini (dari Pengaturan DOKU)
  const [dokuChannels, setDokuChannels] = useState<string[]>([]);
  const [dokuCheckout, setDokuCheckout] = useState<DokuCheckoutState | null>(null);
  const savedDokuOrderId = useRef<string | null>(null);
  useEffect(() => {
    setDokuCheckout(null);
    savedDokuOrderId.current = null;
  }, [open, currentStore?.id]);
  useEffect(() => {
    if (!currentStore?.id) { setDokuChannels([]); return; }
    let active = true;
    void (async () => {
      const { data } = await supabase.from("website_payment_settings").select("doku_enabled,doku_channels").eq("store_id", currentStore.id).maybeSingle();
      if (!active) return;
      setDokuChannels(data?.doku_enabled && Array.isArray(data.doku_channels) ? data.doku_channels.filter((v): v is string => typeof v === "string") : []);
    })();
    return () => { active = false; };
  }, [currentStore?.id]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [variantPickerFor, setVariantPickerFor] = useState<Product | null>(null);
  // Panel "Atur Item Pesanan" — muncul menggantikan katalog saat produk dipilih
  const [itemConfig, setItemConfig] = useState<{ product: Product; variant: ProductVariant | null } | null>(null);
  const [cfgQty, setCfgQty] = useState<number>(1);
  const [cfgPrice, setCfgPrice] = useState<number>(0);
  const [cfgDiscMode, setCfgDiscMode] = useState<"rp" | "pct">("rp");
  const [cfgDiscValue, setCfgDiscValue] = useState<number>(0);
  const [cfgNotes, setCfgNotes] = useState<string>("");
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

  // Daftar transaksi POS (draft / selesai / online)
  const [txListOpen, setTxListOpen] = useState(false);
  const posHeaderActionsRef = useRef<HTMLDivElement>(null);
  const [txTab, setTxTab] = useState<"draft" | "selesai" | "online">("draft");
  const [txOrders, setTxOrders] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null);
  // Filter tanggal daftar transaksi
  const [txDateFilter, setTxDateFilter] = useState<"semua" | "hari_ini" | "kemarin" | "7_hari" | "bulan_ini" | "bulan_lalu" | "custom">("semua");
  const [txCustomFrom, setTxCustomFrom] = useState("");
  const [txCustomTo, setTxCustomTo] = useState("");
  // Draft yang dibuka langsung di POS untuk dilanjutkan/diedit
  const [draftOrder, setDraftOrder] = useState<any | null>(null);

  const { requestCancellation: requestTxDelete, cancellationDialog: txDeleteDialog } = useTransactionCancellation("pesanan POS");
  const deleteTx = (e: React.MouseEvent, o: any) => {
    e.stopPropagation();
    requestTxDelete(o.bid || undefined, async (reason) => {
      if (!currentStore) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (isLocalPosDraft(o)) {
        if (user) removePosOrderDraft(localStorage, currentStore.id, user.id, o.id);
        if (o.server_order_id) {
          const { data: cur } = await supabase.from("booking_orders").select("note").eq("id", o.server_order_id).eq("store_id", currentStore.id).maybeSingle();
          const { error } = await supabase.from("booking_orders").update({ process_status: "batal", note: appendCancellationReason(cur?.note, reason) }).eq("id", o.server_order_id).eq("store_id", currentStore.id);
          if (error) { toast.error(userFacingError(error, "Pesanan belum dapat dihapus. Silakan coba lagi.")); return; }
        }
      } else {
        const { data: cur } = await supabase.from("booking_orders").select("note").eq("id", o.id).eq("store_id", currentStore.id).maybeSingle();
        const { error } = await supabase.from("booking_orders").update({ process_status: "batal", note: appendCancellationReason(cur?.note, reason) }).eq("id", o.id).eq("store_id", currentStore.id);
        if (error) { toast.error(userFacingError(error, "Pesanan belum dapat dihapus. Silakan coba lagi.")); return; }
      }
      toast.success(`Pesanan ${o.bid || ""} dihapus`);
      void fetchTxOrders();
    });
  };

  const fetchTxOrders = async () => {
    if (!currentStore) return;
    setTxLoading(true);
    const { data } = await supabase
      .from("booking_orders")
      .select("id, bid, date, total_amount, payment_status, process_status, customer_name, room_id, booking_id, order_source, created_at, booking_order_items(product_name, quantity)")
      .eq("store_id", currentStore.id)
      .order("created_at", { ascending: false })
      .limit(200);

    let rows: any[] = (data as any) || [];

    // Ikuti status booking induk: kalau booking sudah check out (selesai),
    // order POS terkait tidak boleh tetap berstatus draft/proses.
    const bookingIds = Array.from(
      new Set(rows.filter((o) => o.booking_id).map((o) => o.booking_id))
    );
    if (bookingIds.length > 0) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("id, status")
        .in("id", bookingIds);
      const doneBookings = new Set(
        (bks || []).filter((b: any) => (b.status || "").toUpperCase() === "CO").map((b: any) => b.id)
      );
      const toSync = rows.filter(
        (o) =>
          o.booking_id &&
          doneBookings.has(o.booking_id) &&
          (o.process_status || "").toLowerCase() !== "selesai" &&
          (o.process_status || "").toLowerCase() !== "batal"
      );
      if (toSync.length > 0) {
        await supabase
          .from("booking_orders")
          .update({ process_status: "selesai" })
          .in("id", toSync.map((o) => o.id));
        const synced = new Set(toSync.map((o) => o.id));
        rows = rows.map((o) => (synced.has(o.id) ? { ...o, process_status: "selesai" } : o));
      }
    }

    // Transaksi LUNAS dianggap selesai: order yang sudah lunas tidak boleh
    // tetap berstatus draft/proses.
    const lunasSync = rows.filter(
      (o) =>
        (o.payment_status || "").toLowerCase() === "lunas" &&
        (o.process_status || "").toLowerCase() !== "selesai" &&
        (o.process_status || "").toLowerCase() !== "batal"
    );
    if (lunasSync.length > 0) {
      await supabase
        .from("booking_orders")
        .update({ process_status: "selesai" })
        .in("id", lunasSync.map((o) => o.id));
      const synced = new Set(lunasSync.map((o) => o.id));
      rows = rows.map((o) => (synced.has(o.id) ? { ...o, process_status: "selesai" } : o));
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const drafts = user ? readPosOrderDrafts(localStorage, currentStore.id, user.id) : [];
      const resumedServerIds = new Set(drafts.map((draft) => draft.server_order_id).filter(Boolean));
      setTxOrders([...drafts, ...rows.filter((row) => !resumedServerIds.has(row.id))]);
    } catch (error) {
      setTxOrders(rows);
      toast.error(userFacingError(error, "Draft belum dapat dimuat. Silakan coba lagi."));
    }
    setTxLoading(false);
  };


  useEffect(() => {
    if (open && posMode) void fetchTxOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, posMode, currentStore?.id]);

  const isDraftTx = (o: any) => {
    const ps = (o.process_status || "proses").toLowerCase();
    return ps !== "selesai" && ps !== "batal";
  };
  const isOnlineTx = (o: any) => (o.order_source || "pos").toLowerCase() === "barcode";

  const txDateRange = (): { from: string; to: string } | null => {
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (txDateFilter === "hari_ini") return { from: iso(today), to: iso(today) };
    if (txDateFilter === "kemarin") { const d = new Date(today); d.setDate(d.getDate() - 1); return { from: iso(d), to: iso(d) }; }
    if (txDateFilter === "7_hari") { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: iso(d), to: iso(today) }; }
    if (txDateFilter === "bulan_ini") return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    if (txDateFilter === "bulan_lalu") return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
    if (txDateFilter === "custom" && txCustomFrom) return { from: txCustomFrom, to: txCustomTo || txCustomFrom };
    return null;
  };
  const inTxDateRange = (o: any) => {
    const r = txDateRange();
    if (!r) return true;
    const d = (o.date || "").slice(0, 10);
    return d >= r.from && d <= r.to;
  };

  // Badge jumlah transaksi mengikuti filter tanggal (kalender) yang dipilih
  const dateFilteredTx = txOrders.filter(inTxDateRange);
  const draftCount = dateFilteredTx.filter(isDraftTx).length;
  const selesaiCount = dateFilteredTx.filter((o) => (o.process_status || "").toLowerCase() === "selesai").length;
  const onlineCount = dateFilteredTx.filter(isOnlineTx).length;

  const filteredTx = txOrders.filter((o) => {
    if (!inTxDateRange(o)) return false;
    if (txTab === "draft") return isDraftTx(o);
    if (txTab === "selesai") return (o.process_status || "").toLowerCase() === "selesai";
    return isOnlineTx(o); // online: hanya pesanan via scan barcode kamar
  });

  const openTxList = (tab: "draft" | "selesai" | "online") => {
    setTxTab(tab);
    setTxListOpen(true);
    void fetchTxOrders();
  };

  // Buka transaksi draft langsung di POS (tanpa tab baru) untuk dilanjutkan/diedit
  const openDraftInPos = async (o: any) => {
    if (isLocalPosDraft(o)) {
      setTxListOpen(false);
      setMatchedBooking(o.matched_booking || null);
      setDraftOrder(o);
      toast.success("Draft dibuka di POS");
      return;
    }
    const { data: full } = await supabase
      .from("booking_orders")
      .select("*")
      .eq("id", o.id)
      .single();
    if (!full) {
      toast.error("Gagal memuat transaksi draft");
      return;
    }
    setTxListOpen(false);
    setDraftOrder(full);
    if ((full as any).booking_id) {
      const { data: bk } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", (full as any).booking_id)
        .maybeSingle();
      setMatchedBooking(bk || null);
    } else {
      setMatchedBooking(null);
    }
    toast.success(`Draft ${(full as any).bid || ""} dibuka di POS`);
  };

  const copyBid = async (e: React.MouseEvent, id: string, bid?: string | null) => {
    e.stopPropagation();
    if (!bid) return;
    try {
      await navigator.clipboard.writeText(bid);
      setCopiedBidId(id);
      toast.success("BID disalin");
      setTimeout(() => setCopiedBidId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      toast.error("Gagal menyalin BID");
    }
  };

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

  // Default date filter for completed transactions: today
  useEffect(() => {
    if (txTab === "selesai" && txDateFilter === "semua") {
      setTxDateFilter("hari_ini");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txTab]);

  // POS-mode customer matching
  const [posCustomerName, setPosCustomerName] = useState("");
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [matchedBooking, setMatchedBooking] = useState<any | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const activeStoreIdRef = useRef(currentStore?.id);
  activeStoreIdRef.current = currentStore?.id;

  useLayoutEffect(() => {
    setDbCustomers([]);
    setPickedCustomerPhone("");
  }, [currentStore?.id]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [pickedCustomerPhone, setPickedCustomerPhone] = useState("");
  const [confirmSaveCustomer, setConfirmSaveCustomer] = useState<{ name: string } | null>(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // Transaction-wide discount
  const [txDiscountMode, setTxDiscountMode] = useState<"rp" | "pct">("rp");
  const [txDiscountValue, setTxDiscountValue] = useState<number>(0);
  // Per-transaction toggle: cashier can opt out of the configured service charge
  const [applyServiceCharge, setApplyServiceCharge] = useState<boolean>(true);
  const effectiveBooking = booking || matchedBooking;
  // Order yang sedang diedit: dari prop (mode booking) atau draft yang dibuka dari daftar transaksi POS
  const activeOrder = draftOrder || order;
  const [paymentView, setPaymentView] = useState(false);
  const [serviceConfirmOpen, setServiceConfirmOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [attendantName, setAttendantName] = useState("");

  useEffect(() => {
    setPaymentView(false);
    setServiceConfirmOpen(false);
    setItemConfig(null);
    setAttendantName((draftOrder || order)?.attendant_name || "");
    setStaffOptions([]);
    if (!open || !posMode || !currentStore) return;
    let cancelled = false;
    setStaffLoading(true);
    (async () => {
      try {
        const [{ data: access, error }, { data: auth }] = await Promise.all([
          supabase.from("user_store_access").select("user_id").eq("store_id", currentStore.id),
          supabase.auth.getUser(),
        ]);
        if (error) throw error;
        const ids = [...new Set((access || []).map((row) => row.user_id))];
        const { data: profiles, error: profileError } = ids.length
          ? await supabase.from("profiles").select("id, name, email").in("id", ids)
          : { data: [], error: null };
        if (profileError) throw profileError;
        if (cancelled) return;
        const options = (profiles || []).map((profile) => ({ id: profile.id, name: profile.name || profile.email || "Petugas" }));
        options.sort((a, b) => a.name.localeCompare(b.name));
        setStaffOptions(options);
        const current = options.find((option) => option.id === auth.user?.id);
        if (!(draftOrder || order)?.attendant_name && current) setAttendantName(current.name);
      } catch (error) {
        if (!cancelled) toast.error(userFacingError(error, "Daftar petugas belum dapat dimuat. Tutup POS dan buka kembali."));
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, posMode, currentStore?.id, draftOrder, order]);


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

  const [catManagerOpen, setCatManagerOpen] = useState(false);

  const reloadCategories = async () => {
    if (!currentStore) return;
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name, sort_order, pos_visible")
      .eq("store_id", currentStore.id)
      .eq("pos_visible", true)
      .order("sort_order", { ascending: true })
      .order("name");
    setCategories((cats as any) || []);
  };

  useEffect(() => {
    if (!open || !currentStore) return;
    (async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, images, category_id, collection_id, dynamic_price, tax_enabled, tax_mode")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      const { data: hiddenCols } = await supabase
        .from("product_collections")
        .select("id")
        .eq("store_id", currentStore.id)
        .eq("pos_visible", false);
      const hiddenColIds = new Set((hiddenCols || []).map((c: any) => c.id));
      setProducts((prods || []).filter((p: any) => !p.collection_id || !hiddenColIds.has(p.collection_id)));
      const { data: cats } = await supabase
        .from("product_categories")
        .select("id, name, sort_order, pos_visible")
        .eq("store_id", currentStore.id)
        .eq("pos_visible", true)
        .order("sort_order", { ascending: true })
        .order("name");
      setCategories((cats as any) || []);
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
      if (activeStoreIdRef.current !== currentStore.id) return;
      setDbCustomers(cust as any);
    })();
  }, [open, posMode, currentStore]);

  useEffect(() => {
    if (!open) {
      setPosCustomerName("");
      setMatchedBooking(null);
      setShowSuggest(false);
      setManualCustomerName("");
      setPickedCustomerPhone("");
      setTxDiscountMode("rp");
      setTxDiscountValue(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeOrder) {
      setDate(activeOrder.date);
      setPaymentMethod(activeOrder.payment_method || "Cash");
      setReferenceNo(activeOrder.reference_no || "");
      setDualPayment(!!activeOrder.dual_payment);
      setPaymentMethod2(activeOrder.payment_method_2 || "");
      setReferenceNo2(activeOrder.reference_no_2 || "");
      setAmount(Number(activeOrder.amount) || 0);
      setAmount2(Number(activeOrder.amount_2) || 0);
      setProofUrl(activeOrder.payment_proof_urls?.[0] || null);
      setNote(activeOrder.note || "");
      if (activeOrder.customer_name) setManualCustomerName(activeOrder.customer_name);
      if (isLocalPosDraft(activeOrder)) {
        setItems(activeOrder.items || []);
        setPickedCustomerPhone(activeOrder.customer_phone || "");
        setTxDiscountMode(activeOrder.tx_discount_mode || "rp");
        setTxDiscountValue(activeOrder.tx_discount_value || 0);
        setApplyServiceCharge(activeOrder.apply_service_charge ?? true);
        return;
      }
      supabase
        .from("booking_order_items")
        .select("*")
        .eq("booking_order_id", activeOrder.id)
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
              notes: d.notes || undefined,
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
      setManualCustomerName("");
    }
  }, [open, activeOrder]);

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
  // Metode DOKU aktif hanya di POS; pembayaran diselesaikan lewat halaman DOKU.
  const dokuGroup = posMode ? dokuGroupForMethod(paymentMethod) : null;

  // Auto-fill Nominal Bayar with total when not dual payment (and not editing an existing order)
  useEffect(() => {
    if (dualPayment) return;
    if (activeOrder) return;
    setAmount(total);
  }, [total, dualPayment, activeOrder]);

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

  const openItemConfig = (p: Product, v: ProductVariant | null) => {
    setItemConfig({ product: p, variant: v });
    setCfgQty(1);
    setCfgPrice(Number(v ? v.price : p.price) || 0);
    setCfgDiscMode("rp");
    setCfgDiscValue(0);
    setCfgNotes("");
  };

  const addProduct = (p: Product) => {
    const productVariants = variants.filter((v) => v.product_id === p.id);
    if (productVariants.length > 0) {
      setVariantPickerFor(p);
      return;
    }
    openItemConfig(p, null);
  };

  const addVariant = (p: Product, v: ProductVariant) => {
    setVariantPickerFor(null);
    openItemConfig(p, v);
  };

  const commitItemConfig = () => {
    if (!itemConfig) return;
    const { product, variant } = itemConfig;
    const productId = variant ? variant.id : product.id;
    const name = variant ? `${product.name} - ${variant.variant_name}` : product.name;
    const qty = Math.max(1, Math.floor(cfgQty) || 1);
    const base = Number(variant ? variant.price : product.price) || 0;
    const price = isDynamicPriceItem(productId) ? Math.max(0, Math.floor(cfgPrice) || 0) : base;
    const discAbs =
      cfgDiscMode === "pct"
        ? Math.round((Math.min(100, Math.max(0, cfgDiscValue)) / 100) * qty * price)
        : Math.max(0, Math.floor(cfgDiscValue) || 0);
    const disc = discAbs > 0 ? { discount: discAbs, discount_mode: cfgDiscMode, discount_value: Math.floor(cfgDiscValue) || 0 } : {};
    const note = cfgNotes.trim() ? { notes: cfgNotes.trim() } : {};
    setItems((prev) => {
      const ix = prev.findIndex((i) => i.product_id === productId);
      // Gabungkan hanya jika baris lama belum punya diskon/catatan sendiri
      if (ix >= 0 && !(prev[ix].discount || 0) && !prev[ix].notes) {
        const next = [...prev];
        next[ix] = { ...next[ix], quantity: next[ix].quantity + qty, unit_price: price, ...disc, ...note };
        return next;
      }
      return [...prev, { product_id: productId, product_name: name, quantity: qty, unit_price: price, ...disc, ...note }];
    });
    setItemConfig(null);
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

  const openDokuCheckout = async (orderId: string, method: string, renew = false) => {
    const group = dokuGroupForMethod(method);
    if (!group) return;
    setDokuCheckout({ orderId, url: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("doku-checkout", {
        body: { order_id: orderId, channels: enabledDokuCodes(group, dokuChannels), ...(renew ? { renew: true } : {}) },
      });
      if (error || !isVerifiedDokuCheckoutUrl(data?.checkout_url)) {
        setDokuCheckout({ orderId, url: null, error: await functionErrorMessage(error, data, "Tagihan DOKU belum dapat dibuat. Transaksi tersimpan dengan status belum lunas.") });
      } else {
        setDokuCheckout({ orderId, url: data.checkout_url, error: null });
      }
    } catch {
      setDokuCheckout({ orderId, url: null, error: "Halaman pembayaran belum dapat dibuka. Transaksi tersimpan; silakan coba lagi." });
    }
  };

  const handleSave = async (afterAction: "print" | "whatsapp" | null = null, waPhoneOverride?: string, methodOverride?: string) => {
    if (!currentStore || saving) return;
    const selectedMethod = methodOverride || paymentMethod;
    const selectedDokuGroup = posMode ? dokuGroupForMethod(selectedMethod) : null;
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu produk");
      return;
    }
    const proofRequired = posMode ? posSettings.require_payment_proof : true;
    if (proofRequired && !proofUrl && !selectedDokuGroup) {
      toast.error("Bukti pembayaran wajib diunggah");
      return;
    }
    if (posMode && posSettings.require_customer && !effectiveBooking && !manualCustomerName) {
      toast.error("Silakan pilih pelanggan terlebih dahulu");
      return;
    }
    if (posMode && (!paymentView || !canConfirmPosService(attendantName) || !staffOptions.some((staff) => staff.name === attendantName))) {
      toast.error("Pilih dan konfirmasi petugas yang melayani transaksi terlebih dahulu.");
      return;
    }
    setSaving(true);
    if (selectedDokuGroup) setDokuCheckout({ orderId: "", url: null, error: null });
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
        booking_id: effectiveBooking ? effectiveBooking.id : activeOrder?.booking_id ?? null,
        room_id: (effectiveBooking as any)?.room_id ?? presetRoomId ?? activeOrder?.room_id ?? null,
        order_source: presetRoomId ? "barcode" : activeOrder?.order_source ?? "pos",

        store_id: currentStore.id,
        date,
        customer_name: customerDisplayName,
        customer_phone: effectiveBooking?.phone || pickedCustomerPhone || activeOrder?.customer_phone || null,
        ...(posMode ? { attendant_name: attendantName.trim() } : {}),
        payment_method: selectedMethod,
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

      // Pembayaran DOKU tidak dianggap uang diterima: tagihan dibuat ke DOKU dan
      // status lunas hanya berubah lewat notifikasi resmi DOKU (webhook).
      if (selectedDokuGroup) {
        const priorPaid = Number(activeOrder?.amount || 0) + Number(activeOrder?.amount_2 || 0);
        payload.amount = Number(activeOrder?.amount || 0);
        payload.amount_2 = Number(activeOrder?.amount_2 || 0);
        payload.dual_payment = !!activeOrder?.dual_payment;
        payload.payment_method = selectedMethod;
        payload.payment_method_2 = activeOrder?.payment_method_2 ?? null;
        payload.reference_no = activeOrder?.reference_no ?? null;
        payload.reference_no_2 = activeOrder?.reference_no_2 ?? null;
        payload.payment_proof_urls = activeOrder?.payment_proof_urls ?? [];
        payload.payment_status = priorPaid >= total && total > 0 ? "lunas" : "belum_lunas";
      }

      let orderId = savedDokuOrderId.current || (isLocalPosDraft(activeOrder) ? activeOrder?.server_order_id : activeOrder?.id);
      if (orderId) {
        const { error } = await supabase.from("booking_orders").update(payload).eq("id", orderId).eq("store_id", currentStore.id);
        if (error) throw error;
        const { error: deleteError } = await supabase.from("booking_order_items").delete().eq("booking_order_id", orderId);
        if (deleteError) throw deleteError;
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

      if (selectedDokuGroup) savedDokuOrderId.current = orderId;

      const itemsPayload = items.map((it) => ({
        booking_order_id: orderId,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount || 0,
        discount_mode: it.discount_mode || "rp",
        discount_value: it.discount_value || 0,
        notes: it.notes || null,
        subtotal: Math.max(0, it.quantity * it.unit_price - (it.discount || 0)),
      }));
      const { error: itemErr } = await supabase.from("booking_order_items").insert(itemsPayload);
      if (itemErr) throw itemErr;

      if (selectedDokuGroup) {
        savedDokuOrderId.current = orderId;
        if (isLocalPosDraft(activeOrder) && user) {
          removePosOrderDraft(localStorage, currentStore.id, user.id, activeOrder.id);
        }
        await openDokuCheckout(orderId, selectedMethod);
        onSaved();
        return;
      }

      if (isLocalPosDraft(activeOrder) && user) {
        removePosOrderDraft(localStorage, currentStore.id, user.id, activeOrder.id);
      }

      toast.success(activeOrder ? "Order diperbarui" : "Order ditambahkan");
      setDraftOrder(null);

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
          const itemLines = items
            .filter((it) => it.product_name && it.quantity > 0)
            .map((it) => {
              const line = it.quantity * it.unit_price - (it.discount || 0);
              return `• ${it.product_name} x${it.quantity} — ${fmt(line)}`;
            })
            .join("\n");
          const msg =
            `Halo${custName ? ` ${custName}` : ""}! 🙏\n\n` +
            `Berikut nota digital pesanan Anda dari *${currentStore.name || ""}*.\n\n` +
            `*Rincian Pesanan:*\n${itemLines || "-"}\n\n` +
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
      setDokuCheckout(null);
      toast.error(userFacingError(e, "Transaksi belum berhasil disimpan. Silakan coba lagi."));
    } finally {
      setSaving(false);
    }
  };

  const startNewOrder = async () => {
    if (saving || !currentStore) return;
    setSaving(true);
    try {
      if (items.length > 0) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw error || new Error("Sign in required");
        // Keep unsubmitted amounts in the draft, never in received revenue.
        // Existing server orders keep their original row until checkout.
        const draftId = isLocalPosDraft(activeOrder) ? activeOrder.id : `pos-draft:${activeOrder?.id || crypto.randomUUID()}`;
        savePosOrderDraft(localStorage, currentStore.id, user.id, {
          ...activeOrder,
          id: draftId,
          server_order_id: activeOrder?.server_order_id || (isLocalPosDraft(activeOrder) ? null : activeOrder?.id) || null,
          store_id: currentStore.id,
          created_at: activeOrder?.created_at || new Date().toISOString(),
          date,
          process_status: "proses",
          payment_status: "belum_lunas",
          order_source: activeOrder?.order_source || (presetRoomId ? "barcode" : "pos"),
          customer_name: effectiveBooking?.customer_name || manualCustomerName || null,
          customer_phone: effectiveBooking?.phone || pickedCustomerPhone || null,
          matched_booking: effectiveBooking,
          items,
          booking_order_items: items,
          total_amount: total,
          payment_method: paymentMethod,
          reference_no: referenceNo,
          dual_payment: dualPayment,
          payment_method_2: paymentMethod2,
          reference_no_2: referenceNo2,
          amount,
          amount_2: amount2,
          payment_proof_urls: proofUrl ? [proofUrl] : [],
          note,
          attendant_name: attendantName,
          tx_discount_mode: txDiscountMode,
          tx_discount_value: txDiscountValue,
          apply_service_charge: applyServiceCharge,
        });
        toast.success("Pesanan disimpan sebagai draft");
      }
      setDraftOrder(null);
      setMatchedBooking(null);
      setItems([]);
      setItemConfig(null);
      setVariantPickerFor(null);
      setPosCustomerName("");
      setManualCustomerName("");
      setPickedCustomerPhone("");
      setShowSuggest(false);
      setCustomerSearch("");
      setSearch("");
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
      setTxDiscountMode("rp");
      setTxDiscountValue(0);
      setApplyServiceCharge(true);
      setPaymentView(false);
      setServiceConfirmOpen(false);
      setPriceEditFor(null);
      setDiscountFor(null);
      setFinishOpen(false);
      void fetchTxOrders();
    } catch (error) {
      toast.error(userFacingError(error, "Pesanan belum dapat disimpan sebagai draft. Pesanan Anda tetap terbuka; silakan coba lagi."));
    } finally {
      setSaving(false);
    }
  };

  const paymentFields = posMode && dokuGroup ? (
    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
      <p className="font-semibold text-foreground">Pembayaran online DOKU ({paymentMethod})</p>
      <p>Tagihan DOKU terbuka setelah transaksi disimpan. Status menjadi LUNAS otomatis setelah DOKU mengonfirmasi pembayaran; bukti bayar tidak perlu diunggah.</p>
    </div>
  ) : (
<div className={posMode ? "space-y-3" : "border-t px-3 py-2 space-y-2 overflow-y-auto max-h-[40%]"}>
              <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
              </div>
              {!posMode && <div>
                <Label className="text-xs">Metode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}
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
              compact={!posMode}
              disabled={saving}
              label="Bukti Pembayaran"
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
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setDraftOrder(null); onOpenChange(o); }}>
      <DialogContent className="inset-0 max-w-none w-screen h-screen max-h-none sm:max-w-none rounded-none p-0 top-0 left-0 translate-x-0 translate-y-0 overflow-hidden flex flex-col border-0 gap-0 shadow-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 [&>button.absolute]:hidden">
        {/* Top blue header bar */}
        <div ref={posHeaderRef} className="relative h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 shrink-0">
          {/* Pengukur lebar teks nama outlet (tak terlihat) */}
          <span ref={posHeaderNameMeasureRef} className="absolute invisible whitespace-nowrap text-lg font-semibold pointer-events-none" aria-hidden="true">
            {currentStore?.name ?? ""}
          </span>
          {currentStore?.name ? (
            <div
              ref={posHeaderNameRef}
              className="absolute top-1/2 font-semibold text-lg truncate pointer-events-none will-change-[transform,left]"
              style={{
                left: headerNameShifted ? 16 : "50%",
                maxWidth: headerNameShifted ? "55%" : "40%",
                transform: `translateY(-50%) translateX(${headerNameShifted ? "0" : "-50%"})`,
                transition:
                  "left 550ms cubic-bezier(0.34, 1.3, 0.36, 1), transform 550ms cubic-bezier(0.34, 1.3, 0.36, 1), max-width 250ms ease",
              }}
            >
              {currentStore.name}
            </div>
          ) : (
            <div className="font-semibold text-lg truncate">
              {posMode ? "POS Kasir" : "Tambah Order"}
            </div>
          )}
          <div ref={posHeaderActionsRef} className="ml-auto flex items-center gap-2">
            {activeOrder?.id && !isLocalPosDraft(activeOrder) && (!posMode || posSettings.enable_print) && (
              <button
                type="button"
                onClick={() => window.open(`/receipt?${booking?.id ? `id=${booking.id}&` : ""}order=${activeOrder.id}`, "_blank")}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-white/15 hover:bg-white/25 text-sm"
                title="Cetak nota order"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            )}
            {draftOrder && (
              <button
                type="button"
                onClick={() => void startNewOrder()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-white/15 hover:bg-white/25 text-sm"
                title="Keluar dari mode ubah draft dan buat order baru"
              >
                <Plus className="h-4 w-4" />
                Order Baru
              </button>
            )}
            {posMode && (
              <button
                type="button"
                onClick={() => setCatManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-white/15 hover:bg-white/25 text-sm"
                title="Pengaturan kategori POS"
              >
                <Settings2 className="h-4 w-4" />
                Kategori
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

        <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kelola Kategori POS</DialogTitle>
            </DialogHeader>
            <ProductCategoryManager
              table="product_categories"
              searchPlaceholder="Cari kategori..."
              onChanged={reloadCategories}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog daftar transaksi POS: draft / selesai / online */}
        <Dialog open={txListOpen} onOpenChange={setTxListOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle>Daftar Transaksi</DialogTitle>
                <Select value={txDateFilter} onValueChange={(v) => setTxDateFilter(v as any)}>
                  <SelectTrigger className="h-10 w-[170px] text-base font-bold">
                    <SelectValue placeholder="Semua Tanggal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Tanggal</SelectItem>
                    <SelectItem value="hari_ini">Hari Ini</SelectItem>
                    <SelectItem value="kemarin">Kemarin</SelectItem>
                    <SelectItem value="7_hari">7 Hari Terakhir</SelectItem>
                    <SelectItem value="bulan_ini">Bulan Ini</SelectItem>
                    <SelectItem value="bulan_lalu">Bulan Lalu</SelectItem>
                    <SelectItem value="custom">Sesuaikan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>
            {txDateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={txCustomFrom} onChange={(e) => setTxCustomFrom(e.target.value)} className="h-10 text-base font-bold" />
                <span className="text-base text-muted-foreground font-bold">s/d</span>
                <Input type="date" value={txCustomTo} onChange={(e) => setTxCustomTo(e.target.value)} className="h-10 text-base font-bold" />
              </div>
            )}
            <div className="flex gap-2">
              {([
                { key: "draft", label: `Draft (${draftCount})` },
                { key: "selesai", label: `Selesai (${selesaiCount})` },
                { key: "online", label: `Online (${onlineCount})` },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTxTab(t.key)}
                  className={`flex-1 h-11 rounded-lg text-base font-bold transition ${txTab === t.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {txLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTx.length === 0 ? (
                <div className="text-center text-lg text-black font-bold py-8">
                  {txTab === "draft" ? "Tidak ada transaksi draft" : txTab === "selesai" ? "Belum ada transaksi selesai" : "Belum ada transaksi online"}
                </div>
              ) : (
                <div className="space-y-3 py-1">
                  {filteredTx.map((o) => {
                    const ps = (o.process_status || "proses").toLowerCase();
                    const its = o.booking_order_items || [];
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          if (ps !== "selesai" && ps !== "batal") {
                            void openDraftInPos(o);
                          } else {
                            window.open(`/pos-order/${o.id}`, "_blank");
                          }
                        }}
                        className="w-full text-left border rounded-xl p-4 text-base hover:border-primary/60 hover:bg-accent/40 transition space-y-2 bg-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="font-mono font-bold text-black text-base">{o.bid || "-"}</span>
                            <button
                              type="button"
                              onClick={(e) => copyBid(e, o.id, o.bid)}
                              className="p-1.5 rounded-md hover:bg-accent text-black hover:text-primary"
                              title="Salin BID"
                            >
                              {copiedBidId === o.id ? (
                                <Check className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <Copy className="h-5 w-5" />
                              )}
                            </button>
                          </span>
                          <span className="flex items-center gap-2">
                            {(o.order_source || "pos").toLowerCase() === "barcode" && (
                              <Globe className="h-5 w-5 text-black" />
                            )}
                            <span className={`px-2.5 py-1 rounded-md text-sm font-black ${ps === "selesai" ? "bg-emerald-100 text-emerald-700" : ps === "batal" ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-700"}`}>
                              {ps === "selesai" ? "SELESAI" : ps === "batal" ? "BATAL" : "DRAFT"}
                            </span>
                            {ps !== "batal" && (
                              <span role="button" tabIndex={0} aria-label={`Hapus ${o.bid || "pesanan"}`} title="Hapus" onClick={(e) => deleteTx(e, o)} onKeyDown={(e) => { if (e.key === "Enter") deleteTx(e as any, o); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive">
                                <Trash2 className="h-5 w-5" />
                              </span>
                            )}
                            {ps !== "selesai" && ps !== "batal" ? (
                              <ClipboardList className="h-5 w-5 text-primary" />
                            ) : (
                              <ExternalLink className="h-5 w-5 text-black" />
                            )}
                          </span>
                        </div>
                        <div className="text-base font-bold text-black">
                          {o.date} · {o.customer_name || "Tanpa nama"} · {o.payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS"}
                        </div>
                        {its.length > 0 && (
                          <div className="text-base text-black truncate">
                            {its.map((it: any) => `${it.product_name} x${it.quantity}`).join(", ")}
                          </div>
                        )}
                        <div className="flex justify-between items-center font-black pt-2 border-t text-lg text-black">
                          <span>Total</span>
                          <span>{fmt(Number(o.total_amount) || 0)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {txDeleteDialog}

        <div className="flex-1 flex overflow-hidden bg-primary/95">
          {/* LEFT — Nota / Pesanan Baru */}
  <fieldset disabled={saving || !!dokuCheckout} style={{ width: leftWidth }} className="min-w-0 shrink-0 bg-background flex flex-col border-r max-w-[45vw] md:max-w-none">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              {posMode && !booking ? (
                <button
                  type="button"
                  onClick={() => setCustomerPickerOpen(true)}
                  className="h-7 max-w-[55%] px-2 rounded hover:bg-accent flex items-center gap-1.5 min-w-0"
                  title="Pilih pelanggan"
                >
                  <User className={`h-4 w-4 shrink-0 ${effectiveBooking || manualCustomerName ? "text-primary" : "text-muted-foreground"}`} />
                  {(effectiveBooking?.customer_name || manualCustomerName) && (
                    <span className="text-xs font-medium truncate">
                      {effectiveBooking?.customer_name || manualCustomerName}
                    </span>
                  )}
                </button>
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <div
                className="min-w-0 flex-1 px-2 text-center font-semibold text-sm break-words"
                data-pos-order-title
              >
                {items.length > 0 ? activeOrder?.bid || effectiveBooking?.bid || "Pesanan Baru" : "Pesanan Baru"}
              </div>
              {posMode ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-primary"
                    aria-label="Tambah pesanan baru"
                    title="Tambah pesanan baru"
                    onClick={() => void startNewOrder()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                  </Button>
                  <button
                    type="button"
                    onClick={() => openTxList("draft")}
                    className="relative h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                    title="Daftar transaksi (draft & selesai)"
                  >
                    <ClipboardList className="h-4 w-4" />
                    {draftCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {draftCount > 99 ? "99+" : draftCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openTxList("online")}
                    className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                    title="Daftar transaksi online (pesanan via scan QR kamar)"
                  >
                    <Globe className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  title="Tambah catatan"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
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
                          {it.notes && (
                            <div className="text-[10px] text-muted-foreground italic truncate mt-0.5" title={it.notes}>
                              “{it.notes}”
                            </div>
                          )}
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
                              inputMode="numeric"
                              value={priceDraft ? new Intl.NumberFormat("id-ID").format(priceDraft) : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d]/g, "");
                                setPriceDraft(raw ? parseInt(raw, 10) : 0);
                              }}
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

            {!posMode && paymentFields}

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
                     pickedCustomerPhone ||
                     "",
                 );
                if (posMode) {
                  if (!paymentView) setServiceConfirmOpen(true);
                } else setFinishOpen(true);
              }}
              disabled={saving}
              className="mt-auto h-16 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-2xl font-bold flex items-center justify-center gap-3 shrink-0"
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {posMode ? (paymentView ? "Pembayaran" : "Pembayaran · ") : ""}{!posMode || !paymentView ? fmt(total) : ""}
            </button>
          </fieldset>

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

          {/* RIGHT — Product grid / Atur Item Pesanan */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {posMode && paymentView ? (
            <PosPaymentPanel total={fmt(total)} attendant={attendantName} methods={methods} selected={paymentMethod} onSelect={(method) => {
              setPaymentMethod(method);
              if (opensDokuOnSelection(method)) void handleSave(null, undefined, method);
            }} saving={saving} dokuChannels={dokuChannels}
              checkout={dokuCheckout && currentStore ? <DokuCheckoutPanel checkout={dokuCheckout} storeId={currentStore.id} saving={saving} onRenew={() => {
                if (!dokuCheckout.orderId || saving) return;
                setSaving(true);
                void openDokuCheckout(dokuCheckout.orderId, paymentMethod, true).finally(() => setSaving(false));
              }} onRetry={() => {
                if (!dokuCheckout.orderId || saving) return;
                setSaving(true);
                void openDokuCheckout(dokuCheckout.orderId, paymentMethod).finally(() => setSaving(false));
              }} /> : undefined}
              onBack={() => setPaymentView(false)} onSave={() => {
                if (dokuGroup) { void handleSave(null); return; }
                setWaPhone(effectiveBooking?.phone || effectiveBooking?.customer_phone || pickedCustomerPhone || "");
                setFinishOpen(true);
              }}>
              {paymentFields}
            </PosPaymentPanel>
          ) : itemConfig ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="bg-primary text-primary-foreground px-4 py-3 shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Pengaturan Item</p>
                <h3 className="text-lg font-bold leading-tight mt-0.5">Atur Item Pesanan</h3>
                <p className="text-xs opacity-90 mt-0.5">Sesuaikan harga, jumlah, diskon, dan catatan sebelum disimpan.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(() => {
                  const { product, variant } = itemConfig;
                  const productId = variant ? variant.id : product.id;
                  const name = variant ? `${product.name} - ${variant.variant_name}` : product.name;
                  const imgs = (variant ? undefined : product.images);
                  const img = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                  const fixed = !isDynamicPriceItem(productId);
                  const qty = Math.max(1, Math.floor(cfgQty) || 1);
                  const price = fixed ? Number(variant ? variant.price : product.price) || 0 : Math.max(0, Math.floor(cfgPrice) || 0);
                  const discAbs = cfgDiscMode === "pct"
                    ? Math.round((Math.min(100, Math.max(0, cfgDiscValue)) / 100) * qty * price)
                    : Math.max(0, Math.floor(cfgDiscValue) || 0);
                  const subtotal = Math.max(0, qty * price - discAbs);
                  return (
                    <>
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <div className="h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{name}</div>
                        {!fixed && <div className="text-xs text-primary mt-0.5">Harga bebas ubah</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Harga</Label>
                        <Input
                          inputMode="numeric"
                          disabled={fixed}
                          value={price ? new Intl.NumberFormat("id-ID").format(price) : ""}
                          placeholder="0"
                          onChange={(e) => setCfgPrice(parseNum(e.target.value))}
                          className="h-10"
                        />
                        {fixed && <p className="text-[11px] text-muted-foreground">Harga produk ini tidak dapat diubah.</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Jumlah</Label>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-10 w-9 shrink-0" onClick={() => setCfgQty((q) => Math.max(1, (Math.floor(q) || 1) - 1))}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            inputMode="numeric"
                            value={cfgQty ? String(Math.floor(cfgQty)) : ""}
                            onChange={(e) => setCfgQty(parseNum(e.target.value) || 0)}
                            className="h-10 text-center"
                          />
                          <Button type="button" variant="outline" size="icon" className="h-10 w-9 shrink-0" onClick={() => setCfgQty((q) => (Math.floor(q) || 0) + 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Diskon Item</Label>
                      <div className="flex gap-2">
                        <div className="flex shrink-0 rounded-md border overflow-hidden h-10">
                          <button
                            type="button"
                            onClick={() => setCfgDiscMode("pct")}
                            aria-pressed={cfgDiscMode === "pct"}
                            className={`w-9 text-sm font-semibold transition ${cfgDiscMode === "pct" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setCfgDiscMode("rp")}
                            aria-pressed={cfgDiscMode === "rp"}
                            className={`w-9 text-xs font-semibold transition border-l ${cfgDiscMode === "rp" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                          >
                            Rp
                          </button>
                        </div>
                        <Input
                          inputMode="numeric"
                          value={cfgDiscValue ? new Intl.NumberFormat("id-ID").format(cfgDiscValue) : ""}
                          placeholder="0"
                          onChange={(e) => setCfgDiscValue(parseNum(e.target.value))}
                          className="h-10 flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Catatan Item</Label>
                      <Textarea
                        placeholder="Contoh: tanpa pedas, saus dipisah..."
                        value={cfgNotes}
                        onChange={(e) => setCfgNotes(e.target.value)}
                        className="min-h-20 resize-y"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3">
                      <span className="text-sm font-medium">Subtotal item</span>
                      <span className="text-lg font-bold text-primary">{fmt(subtotal)}</span>
                    </div>
                    </>
                  );
                })()}
              </div>
              <div className="flex gap-2 p-4 pt-0 shrink-0">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setItemConfig(null)}>
                  <X className="mr-2 h-4 w-4" />Batal
                </Button>
                <Button className="flex-1 h-11" onClick={commitItemConfig}>
                  <Check className="mr-2 h-4 w-4" />Simpan
                </Button>
              </div>
            </div>
          ) : (<>
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
            </>
            )}
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
                  placeholder="Cari nama atau nomor telepon..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-9"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomerNameInput
                      storeId={currentStore?.id}
                      value={manualCustomerName}
                      onChange={setManualCustomerName}
                      placeholder="Atau ketik manual / cari pelanggan"
                      className="h-9"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      const nm = manualCustomerName.trim();
                      const exists = dbCustomers.some(
                        (c) => (c.name || "").trim().toLowerCase() === nm.toLowerCase()
                      );
                      setMatchedBooking(null);
                      setPosCustomerName("");
                      setPickedCustomerPhone("");
                      setCustomerPickerOpen(false);
                      if (!exists) {
                        setNewCustomerPhone("");
                        setConfirmSaveCustomer({ name: nm });
                      }
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
                    .filter((b) => {
                      if (!customerSearch) return true;
                      const q = customerSearch.toLowerCase();
                      return (
                        b.customer_name?.toLowerCase().includes(q) ||
                        (b.phone || "").toLowerCase().includes(q)
                      );
                    })
                    .map((b) => (
                      <button
                        key={`bk-${b.id}`}
                        type="button"
                        onClick={() => {
                          setMatchedBooking(b);
                          setPosCustomerName(b.customer_name || "");
                          setManualCustomerName("");
                          setPickedCustomerPhone(b.phone || "");
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
                    .filter((c) => {
                      if (!customerSearch) return true;
                      const q = customerSearch.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(q) ||
                        (c.phone || "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((c) => (
                      <button
                        key={`cu-${c.id}`}
                        type="button"
                        onClick={() => {
                          setMatchedBooking(null);
                          setManualCustomerName(c.name);
                          setPosCustomerName("");
                          setPickedCustomerPhone(c.phone || "");
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
                      setPickedCustomerPhone("");
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

        {/* Offer to save a new customer to the database */}
        <Dialog open={!!confirmSaveCustomer} onOpenChange={(v) => !v && setConfirmSaveCustomer(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Simpan Pelanggan Baru?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Nama <span className="font-medium text-foreground">{confirmSaveCustomer?.name}</span> belum ada di
                Data Pelanggan. Simpan ke database pelanggan?
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Nomor HP (opsional)</Label>
                <Input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="h-9"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmSaveCustomer(null)}>
                  Tidak
                </Button>
                <Button
                  size="sm"
                  disabled={savingNewCustomer}
                  onClick={async () => {
                    if (!confirmSaveCustomer || !currentStore) return;
                    setSavingNewCustomer(true);
                    try {
                      const { data: userRes } = await supabase.auth.getUser();
                      const uid = userRes?.user?.id;
                      const { error } = await supabase.from("customers").insert({
                        name: confirmSaveCustomer.name,
                        phone: newCustomerPhone.trim() || null,
                        store_id: currentStore.id,
                        created_by: uid,
                      } as any);
                      if (error) throw error;
                      const { invalidateCustomerCache, fetchCustomersCached } = await import(
                        "@/utils/customerCache"
                      );
                      invalidateCustomerCache(currentStore.id);
                      setDbCustomers((await fetchCustomersCached(currentStore.id)) as any);
                      if (newCustomerPhone.trim()) setPickedCustomerPhone(newCustomerPhone.trim());
                      toast.success("Pelanggan disimpan ke Data Pelanggan");
                      setConfirmSaveCustomer(null);
                    } catch (e: any) {
                      toast.error("Gagal menyimpan pelanggan: " + (e?.message || ""));
                    } finally {
                      setSavingNewCustomer(false);
                    }
                  }}
                >
                  {savingNewCustomer ? "Menyimpan..." : "Ya, Simpan"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={serviceConfirmOpen} onOpenChange={setServiceConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Dilayani Oleh</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Transaksi ini dilayani oleh siapa?</p>
            <div className="space-y-2">
              <Label htmlFor="pos-attendant">Petugas</Label>
              <Select value={attendantName} onValueChange={setAttendantName} disabled={staffLoading}>
                <SelectTrigger id="pos-attendant"><SelectValue placeholder={staffLoading ? "Memuat petugas..." : "Pilih petugas"} /></SelectTrigger>
                <SelectContent>{staffOptions.map((staff) => <SelectItem key={staff.id} value={staff.name}>{staff.name}</SelectItem>)}</SelectContent>
              </Select>
              {!staffLoading && staffOptions.length === 0 && <p className="text-sm text-destructive">Belum ada petugas yang dapat dipilih di outlet ini. Hubungi admin untuk memberikan akses outlet.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setServiceConfirmOpen(false)}>Batal</Button>
              <Button disabled={staffLoading || !canConfirmPosService(attendantName) || !staffOptions.some((staff) => staff.name === attendantName)} onClick={() => { setItemConfig(null); setPaymentView(true); setServiceConfirmOpen(false); }}>Ya, Benar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Finish action popup: Print or WhatsApp */}
        <Dialog open={finishOpen} onOpenChange={(o) => !saving && setFinishOpen(o)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Selesaikan Transaksi</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Receipt preview */}
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-tight">
                <div className="text-center font-semibold text-xs mb-1">
                  {currentStore?.name || "Nota"}
                </div>
                {(effectiveBooking?.customer_name || manualCustomerName) && (
                  <div className="text-center text-[10px] text-muted-foreground mb-1">
                    Pelanggan: {effectiveBooking?.customer_name || manualCustomerName}
                  </div>
                )}
                <div className="border-t border-dashed my-1" />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {items.map((it, i) => {
                    const gross = it.quantity * it.unit_price;
                    const sub = Math.max(0, gross - (it.discount || 0));
                    return (
                      <div key={i}>
                        <div className="truncate">{it.product_name}</div>
                        <div className="flex justify-between">
                          <span>{it.quantity} x {fmt(it.unit_price)}</span>
                          <span>{fmt(sub)}</span>
                        </div>
                        {it.discount ? (
                          <div className="flex justify-between text-destructive">
                            <span>Diskon</span>
                            <span>-{fmt(it.discount)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-dashed my-1" />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{fmt(itemsSubtotal)}</span>
                </div>
                {txDiscountAmount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon Transaksi</span>
                    <span>-{fmt(txDiscountAmount)}</span>
                  </div>
                )}
                {taxSummary.excludeTax > 0 && (
                  <div className="flex justify-between">
                    <span>PPN</span>
                    <span>{fmt(taxSummary.excludeTax)}</span>
                  </div>
                )}
                {serviceChargeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Service Charge</span>
                    <span>{fmt(serviceChargeAmount)}</span>
                  </div>
                )}
                <div className="border-t border-dashed my-1" />
                <div className="flex justify-between font-bold text-sm text-emerald-700">
                  <span>TOTAL</span>
                  <span>{fmt(total)}</span>
                </div>
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