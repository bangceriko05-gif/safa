import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { isVerifiedDokuCheckoutUrl } from "./dokuChannels";

export interface PaymentWhatsAppCustomer {
  phone?: string;
  name?: string;
  bid?: string;
  storeName?: string | null;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  /** Menginap per jam: tanggal disertai jam check-in/check-out. */
  withTime?: boolean;
}

/** Nama & nomor yang ditampilkan di samping ikon WhatsApp agar kasir tahu tujuannya. */
export function paymentWhatsAppCustomerLabel(customer: PaymentWhatsAppCustomer): { name: string; phone: string } | null {
  const name = customer.name?.trim() || "";
  const phone = customer.phone?.trim() || "";
  if (!name && !phone) return null;
  return { name: name || "Tanpa nama", phone: phone || "Nomor belum diisi" };
}

/** Recheck the shared outstanding balance before requesting a payment link. */
export function canShareBookingPayment(remaining: number, statuses: Array<string | null>) {
  return Number.isFinite(remaining) && remaining > 0 && statuses.length > 0 && !statuses.includes("BATAL");
}

function stayText(value: Date | string | null | undefined, withTime: boolean) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, withTime ? "dd MMM yyyy HH:mm" : "dd MMM yyyy", { locale: idLocale });
}

export function paymentWhatsAppLink(customer: PaymentWhatsAppCustomer, paymentUrl: string | null, amount: number | null): string | null {
  if (!isVerifiedDokuCheckoutUrl(paymentUrl)) return null;
  const raw = customer.phone?.trim() || "";
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  else if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  else if (!raw.startsWith("+") && phone.startsWith("8")) phone = `62${phone}`;
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  const checkIn = stayText(customer.checkIn, Boolean(customer.withTime));
  const checkOut = stayText(customer.checkOut, Boolean(customer.withTime));
  const details = [
    ...(customer.storeName ? [`Hotel: ${customer.storeName}`] : []),
    ...(checkIn ? [`Check-in: ${checkIn}`] : []),
    ...(checkOut ? [`Check-out: ${checkOut}`] : []),
    ...(amount != null ? [`Nominal: Rp ${amount.toLocaleString("id-ID")}`] : []),
  ];
  const message = [
    `Halo${customer.name ? ` ${customer.name}` : ""}, berikut link pembayaran Anda${customer.bid ? ` untuk booking ${customer.bid}` : ""}.`,
    ...(details.length ? [details.join("\n")] : []),
    paymentUrl,
    "Silakan selesaikan pembayaran melalui link tersebut. Terima kasih!",
  ].join("\n\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
