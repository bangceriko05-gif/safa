import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchGroupBilling, billingRoomTotal } from "@/utils/groupBookingBilling";
import { receiptOrderBreakdown, stripAutoOrderNotes } from "@/utils/posOrderCharges";
import { bookingReceiptStay } from "@/utils/bookingReceiptStay";
import {
  getEffectivePrinterConfig,
  isPrinterConnected,
  printRaw,
  shouldAttemptDirectPrint,
  type PrinterConfig,
} from "@/lib/thermalPrinter";
import {
  buildBookingReceiptEscPos,
  buildDepositReceiptEscPos,
  buildDraftInvoiceEscPos,
  buildTransactionReceiptEscPos,
  type BookingReceiptEscPosInput,
  type DepositReceiptEscPosInput,
  type DraftInvoiceEscPosInput,
  type ReceiptHeaderMeta,
  type TransactionReceiptEscPosInput,
} from "@/lib/receiptEscPos";

export type DirectPrintOutcome =
  | { mode: "direct" }
  | { mode: "tab" }
  | { mode: "fallback"; error: unknown };

/**
 * Core decision logic:
 * - Printer not connected (sync or async check) -> open new tab, never printRaw.
 * - Printer connected -> print directly without opening a new tab.
 * - Printer write fails -> fallback to opening the new tab.
 */
export async function runDirectOrTabPrint(deps: {
  shouldAttemptSync: () => boolean;
  checkConnected: () => Promise<boolean>;
  printDirectly: () => Promise<void>;
  openTab: (afterError: boolean) => void;
}): Promise<DirectPrintOutcome> {
  if (!deps.shouldAttemptSync()) {
    deps.openTab(false);
    return { mode: "tab" };
  }
  const connected = await deps.checkConnected();
  if (!connected) {
    deps.openTab(false);
    return { mode: "tab" };
  }
  try {
    await deps.printDirectly();
    return { mode: "direct" };
  } catch (error) {
    deps.openTab(true);
    return { mode: "fallback", error };
  }
}

function openReceiptTab(url: string, afterPrinterError = false) {
  const opened = window.open(url, "_blank");
  if (!opened) {
    toast.error(
      afterPrinterError
        ? "Printer tidak terhubung dan pop-up diblokir browser."
        : "Nota tidak dapat dibuka. Izinkan pop-up untuk situs ini.",
      {
        action: {
          label: "Buka Nota",
          onClick: () => {
            window.open(url, "_blank");
          },
        },
      }
    );
    return;
  }
  if (afterPrinterError) {
    toast.info("Printer tidak terhubung, nota dibuka di tab baru.");
  }
}

export function bookingReceiptUrl(opts: {
  bookingId?: string | null;
  orderId?: string | null;
  combined?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.bookingId) params.set("id", opts.bookingId);
  if (opts.orderId) params.set("order", opts.orderId);
  if (opts.combined) params.set("combined", "1");
  return `/receipt?${params.toString()}`;
}

export function transactionReceiptUrl(transactionId: string, type: "income" | "expense"): string {
  return `/receipt/transaction?id=${encodeURIComponent(transactionId)}&type=${type}`;
}

export function depositReceiptUrl(depositId: string): string {
  return `/receipt/deposit?id=${encodeURIComponent(depositId)}`;
}

async function fetchHeaderMeta(storeId?: string | null, fallbackName = "ANKA PMS"): Promise<{
  header: ReceiptHeaderMeta;
  calendarType: string | null;
}> {
  if (!storeId) {
    return {
      header: { businessName: fallbackName, footerText: "Terima kasih atas kunjungan Anda!" },
      calendarType: null,
    };
  }
  const [storeRes, settingsRes] = await Promise.all([
    supabase.from("stores").select("name, calendar_type").eq("id", storeId).maybeSingle(),
    supabase.from("print_settings").select("*").eq("store_id", storeId).maybeSingle(),
  ]);
  const s = settingsRes.data;
  const storeName = storeRes.data?.name || fallbackName;
  return {
    calendarType: storeRes.data?.calendar_type || null,
    header: {
      businessName: s?.business_name || storeName,
      businessAddress: s?.business_address || null,
      businessPhone: s?.business_phone || null,
      managerName: s?.manager_name || null,
      showManagerSignature: s ? Boolean(s.show_manager_signature) : true,
      footerText: s ? s.footer_text : "Terima kasih atas kunjungan Anda!",
    },
  };
}

async function markFreePpnItems(
  items: { product_id?: string | null; name: string; quantity: number; subtotal: number; freePpn?: boolean }[],
  taxActive: boolean
) {
  const ids = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))) as string[];
  if (!taxActive || ids.length === 0) return items;
  const [{ data: prods }, { data: vars }] = await Promise.all([
    supabase.from("products").select("id, tax_enabled").in("id", ids),
    supabase.from("product_variants").select("id, product_id").in("id", ids),
  ]);
  const taxed = new Map<string, boolean>();
  (prods || []).forEach((p: any) => taxed.set(p.id, Boolean(p.tax_enabled)));
  const missingParents = (vars || []).map((v: any) => v.product_id).filter((id: string) => !taxed.has(id));
  if (missingParents.length) {
    const { data: parents } = await supabase.from("products").select("id, tax_enabled").in("id", missingParents);
    (parents || []).forEach((p: any) => taxed.set(p.id, Boolean(p.tax_enabled)));
  }
  (vars || []).forEach((v: any) => {
    if (taxed.has(v.product_id)) taxed.set(v.id, taxed.get(v.product_id)!);
  });
  return items.map((i) =>
    i.product_id && taxed.has(i.product_id) ? { ...i, freePpn: !taxed.get(i.product_id) } : i
  );
}

function bookingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "BO": return "Reservasi";
    case "CI": return "Check In";
    case "CO": return "Check Out";
    case "BATAL": return "BATAL";
    default: return "Reservasi";
  }
}

async function loadBookingEscPosInput(opts: {
  bookingId?: string | null;
  orderId?: string | null;
  combined?: boolean;
}): Promise<BookingReceiptEscPosInput> {
  const { bookingId, orderId, combined } = opts;

  if (!bookingId && orderId) {
    const { data: ord, error } = await supabase.from("booking_orders").select("*").eq("id", orderId).single();
    if (error || !ord) throw error || new Error("Order tidak ditemukan");
    const [{ header }, { data: oItems }] = await Promise.all([
      fetchHeaderMeta(ord.store_id),
      supabase
        .from("booking_order_items")
        .select("product_id, product_name, quantity, unit_price, subtotal")
        .eq("booking_order_id", orderId),
    ]);
    const rawItems = (oItems || []).map((it: any) => ({
      product_id: it.product_id,
      name: it.product_name,
      quantity: Number(it.quantity),
      subtotal: Number(it.subtotal),
    }));
    const products = await markFreePpnItems(rawItems, Number((ord as any).tax_rate || 0) > 0);
    const itemsSub = rawItems.reduce((s, it) => s + it.subtotal, 0);
    const b = receiptOrderBreakdown([ord as any], itemsSub);
    const serviceAmt = Number((ord as any).service_charge || 0);
    const grandTotal = itemsSub + serviceAmt + b.tax + b.other;
    const paid1 = Number(ord.amount || 0);
    const paid2 = ord.dual_payment ? Number(ord.amount_2 || 0) : 0;
    const totalPaid = paid1 + paid2;
    const payments: BookingReceiptEscPosInput["payments"] = [];
    if (ord.payment_method) {
      payments.push({ label: "Pembayaran 1:", method: ord.payment_method, amount: paid1, ref: ord.reference_no });
    }
    if (ord.dual_payment && ord.payment_method_2) {
      payments.push({ label: "Pembayaran 2:", method: ord.payment_method_2, amount: paid2, ref: ord.reference_no_2 });
    }
    return {
      header,
      title: "NOTA ORDER",
      bid: ord.bid,
      createdAt: ord.created_at,
      customerName: (ord as any).customer_name || "-",
      phone: (ord as any).customer_phone || "-",
      orderOnlyMode: true,
      roomSubtotal: 0,
      products,
      discountAmount: 0,
      serviceCharge:
        serviceAmt > 0
          ? {
              label:
                (ord as any).service_charge_type === "percent" && (ord as any).service_charge_value != null
                  ? `Service Charge (${(ord as any).service_charge_value}%)`
                  : "Service Charge",
              amount: serviceAmt,
            }
          : null,
      tax:
        b.tax > 0
          ? { label: `PPN${(ord as any).tax_rate ? ` (${(ord as any).tax_rate}%)` : ""}`, amount: b.tax }
          : null,
      orderOther: b.other !== 0 ? { label: b.other < 0 ? "Diskon Transaksi" : "Biaya Lain", amount: b.other } : null,
      grandTotal,
      isLunas: totalPaid >= grandTotal,
      payments,
      totalPaid,
      remaining: Math.max(0, grandTotal - totalPaid),
      note: stripAutoOrderNotes(ord.note) || null,
    };
  }

  if (!bookingId) throw new Error("ID booking tidak ditemukan");
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select("*, rooms (name, store_id)")
    .eq("id", bookingId)
    .single();
  if (bookingError || !bookingData) throw bookingError || new Error("Booking tidak ditemukan");

  const storeId = bookingData.store_id || bookingData.rooms?.store_id;
  const [{ header, calendarType }, variantRes, productsRes, shared, depositRes] = await Promise.all([
    fetchHeaderMeta(storeId),
    bookingData.variant_id
      ? supabase.from("room_variants").select("variant_name, price").eq("id", bookingData.variant_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("booking_products").select("product_name, quantity, subtotal").eq("booking_id", bookingId),
    !orderId ? fetchGroupBilling(bookingData) : Promise.resolve(null),
    bookingData.room_id
      ? supabase
          .from("room_deposits")
          .select("deposit_type, amount, identity_type")
          .eq("room_id", bookingData.room_id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let mergedItems = (shared?.products || productsRes.data || []).map((p: any) => ({
    product_id: null as string | null,
    name: p.product_name,
    quantity: Number(p.quantity),
    subtotal: Number(p.subtotal),
  }));
  let orderOnlyMode = false;
  let overrideBid: string | null = null;
  let orderExtraPaid = 0;
  let serviceCharge: BookingReceiptEscPosInput["serviceCharge"] = null;
  let tax: BookingReceiptEscPosInput["tax"] = null;
  let orderOther: BookingReceiptEscPosInput["orderOther"] = null;
  let orderTaxActive = false;

  if (orderId) {
    const [{ data: ord }, { data: oItems }] = await Promise.all([
      supabase
        .from("booking_orders")
        .select("id, bid, total_amount, amount, amount_2, dual_payment, service_charge, service_charge_type, service_charge_value, tax_amount, tax_rate")
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("booking_order_items")
        .select("product_id, product_name, quantity, subtotal")
        .eq("booking_order_id", orderId),
    ]);
    orderOnlyMode = true;
    overrideBid = ord?.bid || null;
    orderTaxActive = Number((ord as any)?.tax_rate || 0) > 0;
    mergedItems = (oItems || []).map((it: any) => ({
      product_id: it.product_id,
      name: it.product_name,
      quantity: Number(it.quantity),
      subtotal: Number(it.subtotal),
    }));
    orderExtraPaid = Number(ord?.amount || 0) + (ord?.dual_payment ? Number(ord?.amount_2 || 0) : 0);
    const sc = Number((ord as any)?.service_charge || 0);
    if (sc > 0) {
      serviceCharge = {
        label:
          (ord as any)?.service_charge_type === "percent" && (ord as any)?.service_charge_value != null
            ? `Service Charge (${(ord as any).service_charge_value}%)`
            : "Service Charge",
        amount: sc,
      };
    }
    const itemsSub = mergedItems.reduce((s, it) => s + it.subtotal, 0);
    const b = receiptOrderBreakdown(ord ? [ord as any] : [], itemsSub);
    if (b.tax > 0) tax = { label: `PPN${(ord as any)?.tax_rate ? ` (${(ord as any).tax_rate}%)` : ""}`, amount: b.tax };
    if (b.other !== 0) orderOther = { label: b.other < 0 ? "Diskon Transaksi" : "Biaya Lain", amount: b.other };
  } else if (combined) {
    const { data: ords } = await supabase
      .from("booking_orders")
      .select("id, total_amount, amount, amount_2, dual_payment, service_charge, tax_amount, tax_rate")
      .eq("booking_id", bookingId);
    const ordIds = (ords || []).map((o: any) => o.id);
    let combinedItemsSub = 0;
    if (ordIds.length > 0) {
      const { data: oItems } = await supabase
        .from("booking_order_items")
        .select("product_id, product_name, quantity, subtotal")
        .in("booking_order_id", ordIds);
      const extraItems = (oItems || []).map((it: any) => ({
        product_id: it.product_id,
        name: it.product_name,
        quantity: Number(it.quantity),
        subtotal: Number(it.subtotal),
      }));
      combinedItemsSub = extraItems.reduce((s, it) => s + it.subtotal, 0);
      mergedItems = [...mergedItems, ...extraItems];
    }
    orderTaxActive = (ords || []).some((o: any) => Number(o.tax_rate || 0) > 0);
    orderExtraPaid = (ords || []).reduce(
      (s: number, o: any) => s + Number(o.amount || 0) + (o.dual_payment ? Number(o.amount_2 || 0) : 0),
      0
    );
    const sc = (ords || []).reduce((s: number, o: any) => s + Number(o.service_charge || 0), 0);
    if (sc > 0) serviceCharge = { label: "Service Charge", amount: sc };
    const b = receiptOrderBreakdown((ords || []) as any[], combinedItemsSub);
    const rates = Array.from(
      new Set((ords || []).filter((o: any) => Number(o.tax_amount || 0) > 0).map((o: any) => Number(o.tax_rate || 0)))
    );
    if (b.tax > 0) tax = { label: `PPN${rates.length === 1 && rates[0] ? ` (${rates[0]}%)` : ""}`, amount: b.tax };
    if (b.other !== 0) orderOther = { label: b.other < 0 ? "Diskon Transaksi" : "Biaya Lain", amount: b.other };
  }

  const products = await markFreePpnItems(mergedItems, orderTaxActive);
  const stay = bookingReceiptStay(bookingData, calendarType);
  const multiOwner = shared && shared.rooms.length > 1 ? shared.totals.owner : null;
  const roomSubtotal = orderOnlyMode ? 0 : shared ? shared.totals.roomTotal : Number(bookingData.price || 0);
  const productsTotal = products.reduce((s, p) => s + p.subtotal, 0);

  let discountAmount = 0;
  if (shared && !orderOnlyMode) {
    discountAmount = shared.totals.discount;
  } else if (bookingData.discount_value && bookingData.discount_value > 0) {
    if (bookingData.discount_type === "percentage" || bookingData.discount_type === "percent") {
      const base = bookingData.discount_applies_to === "product" ? productsTotal : roomSubtotal;
      discountAmount = Math.round(base * (bookingData.discount_value / 100));
    } else {
      discountAmount = Number(bookingData.discount_value);
    }
  }

  const orderCharges = (serviceCharge?.amount || 0) + (tax?.amount || 0) + (orderOther?.amount || 0);
  const grandTotal = orderOnlyMode ? productsTotal + orderCharges : roomSubtotal + productsTotal - discountAmount + orderCharges;

  const paid1 = orderOnlyMode ? 0 : multiOwner ? shared!.totals.paid1 : Number(bookingData.price || 0);
  const dual = multiOwner ? Boolean(multiOwner.dual_payment) : Boolean(bookingData.dual_payment);
  const paid2 = orderOnlyMode ? 0 : dual ? (multiOwner ? shared!.totals.paid2 : Number(bookingData.price_2 || 0)) : 0;
  const totalPaid = paid1 + paid2 + (orderOnlyMode || combined ? orderExtraPaid : 0);
  const payMethod1 = multiOwner ? multiOwner.payment_method : bookingData.payment_method;
  const payMethod2 = multiOwner ? multiOwner.payment_method_2 : bookingData.payment_method_2;

  const payments: BookingReceiptEscPosInput["payments"] = [];
  if (payMethod1) {
    payments.push({ label: "Pembayaran 1:", method: payMethod1, amount: paid1, ref: bookingData.reference_no });
  }
  if (dual && payMethod2) {
    payments.push({ label: "Pembayaran 2:", method: payMethod2, amount: paid2, ref: bookingData.reference_no_2 });
  }

  const dep = depositRes.data;
  const deposit = dep
    ? {
        label: `Deposito (${dep.deposit_type === "Uang" ? "Uang" : `Identitas - ${dep.identity_type || ""}`})`,
        amount: dep.deposit_type === "Uang" ? Number(dep.amount || 0) : 0,
      }
    : null;

  const multiRooms =
    !orderOnlyMode && shared && shared.rooms.length > 1
      ? shared.rooms.map((r, i) => ({
          label: `Kamar ${i + 1} ${r.rooms?.name || ""} ${r.duration}${stay.unit === "jam" ? "j" : "m"}`,
          amount: billingRoomTotal(r),
        }))
      : undefined;

  return {
    header,
    title: orderOnlyMode ? "NOTA ORDER" : combined ? "NOTA GABUNGAN" : "NOTA BOOKING",
    bid: overrideBid || bookingData.bid,
    createdAt: bookingData.created_at,
    customerName: bookingData.customer_name,
    phone: bookingData.phone,
    statusLabel: bookingStatusLabel(bookingData.status),
    orderOnlyMode,
    checkInDate: bookingData.date,
    checkOutDate: stay.checkout,
    duration: bookingData.duration,
    durationUnit: stay.unit,
    roomName: bookingData.rooms?.name || "Unknown",
    variantName: variantRes.data?.variant_name || null,
    multiRooms,
    roomSubtotal,
    products,
    discountAmount,
    discountLabel:
      bookingData.discount_type === "percent" && bookingData.discount_value
        ? `Diskon (${bookingData.discount_value}%)`
        : "Diskon",
    deposit,
    serviceCharge,
    tax,
    orderOther,
    grandTotal,
    isLunas: totalPaid >= grandTotal,
    payments,
    totalPaid,
    remaining: Math.max(0, grandTotal - totalPaid),
    note: bookingData.note || null,
  };
}

async function loadTransactionEscPosInput(
  transactionId: string,
  type: "income" | "expense"
): Promise<TransactionReceiptEscPosInput> {
  const table = type === "expense" ? "expenses" : "incomes";
  const { data, error } = await supabase.from(table).select("*").eq("id", transactionId).single();
  if (error || !data) throw error || new Error("Transaksi tidak ditemukan");
  const [{ header }, profileRes, productsRes] = await Promise.all([
    fetchHeaderMeta(data.store_id),
    data.created_by ? supabase.from("profiles").select("name").eq("id", data.created_by).maybeSingle() : Promise.resolve({ data: null }),
    type === "income"
      ? supabase.from("income_products").select("product_name, quantity, subtotal").eq("income_id", transactionId)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    header,
    isExpense: type === "expense",
    bid: data.bid,
    createdAt: data.created_at,
    date: data.date,
    customerName: (data as any).customer_name,
    description: data.description,
    category: (data as any).category,
    paymentMethod: data.payment_method,
    creatorName: profileRes.data?.name || "-",
    products: (productsRes.data || []).map((p: any) => ({
      name: p.product_name,
      quantity: Number(p.quantity),
      subtotal: Number(p.subtotal),
    })),
    totalAmount: Number(data.amount || 0),
    paidAmount: Number((data as any).paid_amount || 0),
  };
}

async function loadDepositEscPosInput(depositId: string): Promise<{
  input: DepositReceiptEscPosInput;
  currentPrintCount: number;
}> {
  const { data, error } = await supabase.from("room_deposits").select("*").eq("id", depositId).single();
  if (error || !data) throw error || new Error("Deposit tidak ditemukan");
  const [{ header }, roomRes, profileRes] = await Promise.all([
    fetchHeaderMeta(data.store_id),
    data.room_id ? supabase.from("rooms").select("name").eq("id", data.room_id).maybeSingle() : Promise.resolve({ data: null }),
    data.created_by ? supabase.from("profiles").select("name").eq("id", data.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const currentPrintCount = Number(data.print_count || 0);
  return {
    currentPrintCount,
    input: {
      header,
      isReprint: currentPrintCount >= 1,
      createdAt: data.created_at,
      roomName: roomRes.data?.name || "-",
      isUang: data.deposit_type === "uang",
      amount: data.amount ? Number(data.amount) : null,
      identityType: data.identity_type,
      identityOwnerName: data.identity_owner_name,
      notes: data.notes,
      statusLabel: data.status === "active" ? "Aktif" : "Dikembalikan",
      creatorName: profileRes.data?.name || "-",
    },
  };
}

export function printBookingReceipt(opts: {
  storeId?: string | null;
  bookingId?: string | null;
  orderId?: string | null;
  combined?: boolean;
}): Promise<DirectPrintOutcome> {
  const url = bookingReceiptUrl(opts);
  const storeId = opts.storeId || undefined;
  return runDirectOrTabPrint({
    shouldAttemptSync: () => shouldAttemptDirectPrint(storeId),
    checkConnected: () => isPrinterConnected(storeId),
    printDirectly: async () => {
      const config = getEffectivePrinterConfig(storeId);
      const data = await loadBookingEscPosInput(opts);
      const bytes = buildBookingReceiptEscPos(data, config);
      await printRaw(bytes, config, { allowPrompt: false });
      toast.success(`Nota berhasil dicetak${config.deviceName ? ` ke ${config.deviceName}` : ""}`);
    },
    openTab: (afterError) => openReceiptTab(url, afterError),
  });
}

export function printTransactionReceipt(opts: {
  storeId?: string | null;
  transactionId: string;
  type: "income" | "expense";
}): Promise<DirectPrintOutcome> {
  const url = transactionReceiptUrl(opts.transactionId, opts.type);
  const storeId = opts.storeId || undefined;
  return runDirectOrTabPrint({
    shouldAttemptSync: () => shouldAttemptDirectPrint(storeId),
    checkConnected: () => isPrinterConnected(storeId),
    printDirectly: async () => {
      const config = getEffectivePrinterConfig(storeId);
      const data = await loadTransactionEscPosInput(opts.transactionId, opts.type);
      const bytes = buildTransactionReceiptEscPos(data, config);
      await printRaw(bytes, config, { allowPrompt: false });
      toast.success(`Nota berhasil dicetak${config.deviceName ? ` ke ${config.deviceName}` : ""}`);
    },
    openTab: (afterError) => openReceiptTab(url, afterError),
  });
}

export function printDepositReceipt(opts: {
  storeId?: string | null;
  depositId: string;
}): Promise<DirectPrintOutcome> {
  const url = depositReceiptUrl(opts.depositId);
  const storeId = opts.storeId || undefined;
  return runDirectOrTabPrint({
    shouldAttemptSync: () => shouldAttemptDirectPrint(storeId),
    checkConnected: () => isPrinterConnected(storeId),
    printDirectly: async () => {
      const config = getEffectivePrinterConfig(storeId);
      const { input, currentPrintCount } = await loadDepositEscPosInput(opts.depositId);
      const bytes = buildDepositReceiptEscPos(input, config);
      await printRaw(bytes, config, { allowPrompt: false });
      await supabase
        .from("room_deposits")
        .update({ print_count: currentPrintCount + 1 })
        .eq("id", opts.depositId);
      toast.success(`Nota deposit berhasil dicetak${config.deviceName ? ` ke ${config.deviceName}` : ""}`);
    },
    openTab: (afterError) => openReceiptTab(url, afterError),
  });
}

export function printDraftInvoice(opts: {
  storeId?: string | null;
  invoice: DraftInvoiceEscPosInput;
  openFallback: () => void;
}): Promise<DirectPrintOutcome> {
  const storeId = opts.storeId || undefined;
  return runDirectOrTabPrint({
    shouldAttemptSync: () => shouldAttemptDirectPrint(storeId),
    checkConnected: () => isPrinterConnected(storeId),
    printDirectly: async () => {
      const config = getEffectivePrinterConfig(storeId);
      const bytes = buildDraftInvoiceEscPos(opts.invoice, config);
      await printRaw(bytes, config, { allowPrompt: false });
      toast.success(`Invoice berhasil dicetak${config.deviceName ? ` ke ${config.deviceName}` : ""}`);
    },
    openTab: (afterError) => {
      if (afterError) toast.info("Printer tidak terhubung, invoice dibuka di tab baru.");
      opts.openFallback();
    },
  });
}

/** Used by the "Print Nota" button inside already-opened receipt pages. */
export async function printFromReceiptPage(opts: {
  storeId?: string | null;
  buildBytes: (config: PrinterConfig) => Uint8Array;
}): Promise<"direct" | "browser"> {
  const storeId = opts.storeId || undefined;
  if (!shouldAttemptDirectPrint(storeId) || !(await isPrinterConnected(storeId))) {
    window.print();
    return "browser";
  }
  try {
    const config = getEffectivePrinterConfig(storeId);
    await printRaw(opts.buildBytes(config), config, { allowPrompt: false });
    toast.success(`Nota berhasil dicetak${config.deviceName ? ` ke ${config.deviceName}` : ""}`);
    return "direct";
  } catch {
    toast.info("Printer tidak terhubung, membuka dialog cetak browser.");
    window.print();
    return "browser";
  }
}