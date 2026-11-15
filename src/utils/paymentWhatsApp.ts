import { isVerifiedDokuCheckoutUrl } from "./dokuChannels";

export interface PaymentWhatsAppCustomer {
  phone?: string;
  name?: string;
  bid?: string;
}

export function paymentWhatsAppLink(customer: PaymentWhatsAppCustomer, paymentUrl: string | null, amount: number | null): string | null {
  if (!isVerifiedDokuCheckoutUrl(paymentUrl)) return null;
  const raw = customer.phone?.trim() || "";
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  else if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  else if (!raw.startsWith("+") && phone.startsWith("8")) phone = `62${phone}`;
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  const message = [
    `Halo${customer.name ? ` ${customer.name}` : ""}, berikut link pembayaran Anda${customer.bid ? ` untuk booking ${customer.bid}` : ""}.`,
    ...(amount != null ? [`Nominal: Rp ${amount.toLocaleString("id-ID")}`] : []),
    paymentUrl,
    "Silakan selesaikan pembayaran melalui link tersebut. Terima kasih!",
  ].join("\n\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}