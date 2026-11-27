import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { EscPosBuilder, colsForPaper, formatIDR } from "@/lib/escpos";
import type { PrinterConfig } from "@/lib/thermalPrinter";

export interface ReceiptHeaderMeta {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  managerName?: string | null;
  showManagerSignature?: boolean;
  footerText?: string | null;
}

export interface BookingReceiptEscPosInput {
  header: ReceiptHeaderMeta;
  title: "NOTA BOOKING" | "NOTA ORDER" | "NOTA GABUNGAN";
  bid?: string | null;
  createdAt: string;
  customerName?: string | null;
  phone?: string | null;
  statusLabel?: string | null;
  orderOnlyMode: boolean;
  checkInDate?: string | null;
  checkOutDate?: Date | null;
  duration?: number;
  durationUnit?: string;
  roomName?: string;
  variantName?: string | null;
  multiRooms?: { label: string; amount: number }[];
  roomSubtotal: number;
  products: { name: string; quantity: number; subtotal: number; freePpn?: boolean }[];
  discountAmount: number;
  discountLabel?: string;
  deposit?: { label: string; amount: number } | null;
  serviceCharge?: { label: string; amount: number } | null;
  tax?: { label: string; amount: number } | null;
  orderOther?: { label: string; amount: number } | null;
  grandTotal: number;
  isLunas: boolean;
  payments: { label: string; method: string; amount: number; ref?: string | null }[];
  totalPaid: number;
  remaining: number;
  note?: string | null;
}

export interface TransactionReceiptEscPosInput {
  header: ReceiptHeaderMeta;
  isExpense: boolean;
  bid?: string | null;
  createdAt: string;
  date: string;
  customerName?: string | null;
  description?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
  creatorName?: string | null;
  products?: { name: string; quantity: number; subtotal: number }[];
  totalAmount: number;
  paidAmount?: number;
}

export interface DepositReceiptEscPosInput {
  header: ReceiptHeaderMeta;
  isReprint: boolean;
  createdAt: string;
  roomName: string;
  isUang: boolean;
  amount?: number | null;
  identityType?: string | null;
  identityOwnerName?: string | null;
  notes?: string | null;
  statusLabel: string;
  creatorName: string;
}

export interface DraftInvoiceEscPosInput {
  storeName: string;
  dateLabel: string;
  customerName?: string | null;
  products: { name: string; quantity: number; subtotal: number }[];
  discount?: { label: string; amount: number } | null;
  total: number;
}

const rp = (n: number) => `Rp ${formatIDR(n)}`;

function writeHeader(b: EscPosBuilder, h: ReceiptHeaderMeta) {
  b.align("center").bold(true).line(h.businessName || "ANKA PMS").bold(false);
  if (h.businessAddress) b.wrap(h.businessAddress);
  if (h.businessPhone) b.line(`Tel: ${h.businessPhone}`);
  b.align("left").divider();
}

function writeFooter(b: EscPosBuilder, h: ReceiptHeaderMeta, config: PrinterConfig) {
  b.divider();
  if (h.showManagerSignature && h.managerName) {
    b.align("center").line("Hormat Kami,").feed(2).line(h.managerName).line("Manager").feed(1);
  }
  if (h.footerText) {
    b.align("center").wrap(h.footerText);
  }
  b.align("center").line("Powered by ANKA PMS").align("left");
  if (config.openDrawer) b.openDrawer();
  if (config.autoCut) b.cut();
  else b.feed(3);
}

function safeFormatDate(value: string | Date, pattern: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "-");
  return format(d, pattern, { locale: idLocale });
}

export function buildBookingReceiptEscPos(data: BookingReceiptEscPosInput, config: PrinterConfig): Uint8Array {
  const b = new EscPosBuilder(colsForPaper(config.paper));
  writeHeader(b, data.header);

  b.align("center").bold(true).line(data.title).bold(false);
  if (data.bid) b.line(`No: ${data.bid}`);
  b.line(safeFormatDate(data.createdAt, "dd/MM/yyyy HH:mm"));
  b.align("left").divider();

  if (data.customerName) b.row("Pelanggan:", data.customerName);
  if (data.phone) b.row("Telepon:", data.phone);
  if (data.statusLabel) b.row("Status:", data.statusLabel);

  if (!data.orderOnlyMode) {
    b.divider();
    if (data.checkInDate) b.row("Check In:", safeFormatDate(data.checkInDate, "dd MMM yyyy"));
    if (data.checkOutDate) b.row("Check Out:", safeFormatDate(data.checkOutDate, "dd MMM yyyy"));
    if (data.duration != null) b.row("Durasi:", `${data.duration} ${data.durationUnit === "jam" ? "jam" : "malam"}`);
    if (data.roomName) b.row("Ruangan:", data.roomName);
    if (data.variantName) b.row("Tipe Room:", data.variantName);
  }

  b.divider();
  if (!data.orderOnlyMode && data.multiRooms && data.multiRooms.length > 1) {
    data.multiRooms.forEach((r) => b.row(r.label, rp(r.amount)));
  }
  if (!data.orderOnlyMode) {
    b.row("Total Biaya", rp(data.roomSubtotal));
  }
  for (const p of data.products) {
    b.row(`${p.name} x${p.quantity}`, rp(p.subtotal));
    if (p.freePpn) b.line("  (free ppn)");
  }
  if (data.discountAmount > 0) {
    b.row(data.discountLabel || "Diskon", `-${rp(data.discountAmount)}`);
  }
  if (data.deposit) {
    b.row(data.deposit.label, rp(data.deposit.amount));
  }
  if (data.serviceCharge && data.serviceCharge.amount > 0) {
    b.row(data.serviceCharge.label, rp(data.serviceCharge.amount));
  }
  if (data.tax && data.tax.amount > 0) {
    b.row(data.tax.label, rp(data.tax.amount));
  }
  if (data.orderOther && data.orderOther.amount !== 0) {
    const val = data.orderOther.amount < 0 ? `-${rp(-data.orderOther.amount)}` : rp(data.orderOther.amount);
    b.row(data.orderOther.label, val);
  }

  b.divider();
  b.bold(true).row("TOTAL", rp(data.grandTotal)).bold(false);
  b.bold(true).row("Status Bayar:", data.isLunas ? "LUNAS" : "BELUM LUNAS").bold(false);
  for (const pay of data.payments) {
    b.row(pay.label, pay.method);
    b.row("Jumlah:", rp(pay.amount));
    if (pay.ref && pay.ref !== "-") b.row("Ref:", pay.ref);
  }
  b.bold(true).row("Total Bayar:", rp(data.totalPaid)).bold(false);
  if (!data.isLunas && data.remaining > 0) {
    b.row("Sisa Bayar:", rp(data.remaining));
  }

  if (data.note) {
    b.divider();
    b.wrap(`Catatan: ${data.note}`);
  }

  writeFooter(b, data.header, config);
  return b.build();
}

export function buildTransactionReceiptEscPos(data: TransactionReceiptEscPosInput, config: PrinterConfig): Uint8Array {
  const b = new EscPosBuilder(colsForPaper(config.paper));
  writeHeader(b, data.header);

  b.align("center").bold(true).line(data.isExpense ? "NOTA PENGELUARAN" : "NOTA PEMASUKAN").bold(false);
  if (data.bid) b.line(`No: ${data.bid}`);
  b.line(safeFormatDate(data.createdAt, "dd/MM/yyyy HH:mm"));
  b.align("left").divider();

  b.row("Tanggal:", safeFormatDate(data.date, "dd MMM yyyy"));
  if (data.isExpense) {
    b.row("Deskripsi:", data.description || "-");
    b.row("Kategori:", data.category || "-");
  } else {
    b.row("Pelanggan:", data.customerName || "-");
    if (data.description) b.row("Deskripsi:", data.description);
  }
  b.row("Metode Bayar:", data.paymentMethod || "-");
  b.row("Dibuat oleh:", data.creatorName || "-");

  if (!data.isExpense && data.products && data.products.length > 0) {
    b.divider();
    b.bold(true).line("Produk:").bold(false);
    for (const p of data.products) {
      b.row(`${p.name} x${p.quantity}`, rp(p.subtotal));
    }
  }

  b.divider();
  b.bold(true).row("TOTAL", rp(data.totalAmount)).bold(false);
  if (!data.isExpense && data.paidAmount && data.paidAmount > 0) {
    b.row("Jumlah Bayar", rp(data.paidAmount));
    const diff = data.paidAmount - data.totalAmount;
    if (diff > 0) b.row("Kembalian", rp(diff));
    else if (diff < 0) b.row("Kurang Bayar", rp(Math.abs(diff)));
  }

  writeFooter(b, data.header, config);
  return b.build();
}

export function buildDepositReceiptEscPos(data: DepositReceiptEscPosInput, config: PrinterConfig): Uint8Array {
  const b = new EscPosBuilder(colsForPaper(config.paper));
  if (data.isReprint) {
    b.align("center").bold(true).line("*** REPRINT ***").bold(false);
  }
  writeHeader(b, data.header);

  b.align("center").bold(true).line("NOTA DEPOSIT").bold(false);
  b.line(safeFormatDate(data.createdAt, "dd/MM/yyyy HH:mm"));
  b.align("left").divider();

  b.row("Kamar:", data.roomName || "-");
  b.row("Jenis Deposit:", data.isUang ? "Uang" : "Identitas");
  if (data.isUang && data.amount) {
    b.row("Nominal:", rp(data.amount));
  } else if (!data.isUang) {
    b.row("Identitas:", data.identityType || "-");
    b.row("Pemilik:", data.identityOwnerName || "-");
  }
  if (data.notes) b.wrap(`Catatan: ${data.notes}`);
  b.row("Status:", data.statusLabel);
  b.row("Dibuat oleh:", data.creatorName || "-");

  if (data.isUang && data.amount) {
    b.divider();
    b.bold(true).row("TOTAL DEPOSIT", rp(data.amount)).bold(false);
  }

  writeFooter(b, data.header, config);
  return b.build();
}

export function buildDraftInvoiceEscPos(data: DraftInvoiceEscPosInput, config: PrinterConfig): Uint8Array {
  const b = new EscPosBuilder(colsForPaper(config.paper));
  b.align("center").bold(true).line(data.storeName || "Store").bold(false);
  if (data.dateLabel) b.line(data.dateLabel);
  b.align("left").divider();
  b.align("center").bold(true).line("INVOICE").bold(false).align("left");
  if (data.customerName) b.row("Pelanggan:", data.customerName);
  b.divider();
  for (const p of data.products) {
    b.row(`${p.name} x${p.quantity}`, rp(p.subtotal));
  }
  if (data.discount && data.discount.amount > 0) {
    b.row(data.discount.label, `-${rp(data.discount.amount)}`);
  }
  b.divider();
  b.bold(true).row("TOTAL", rp(data.total)).bold(false);
  writeFooter(b, { businessName: data.storeName }, config);
  return b.build();
}