import { addDays, format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export const defaultWhatsAppMessages = {
  booking_message: "Halo {nama}, kami dari {outlet} mengingatkan kedatangan Anda pada {tanggal_check_in} pukul {jam_check_in}. Nomor booking: {bid}. Kami menantikan kedatangan Anda. Terima kasih!",
  check_in_message: "Halo {nama}, semoga Anda menikmati menginap di {outlet}. Kami mengingatkan waktu check out Anda pada {tanggal_check_out} pukul {jam_check_out}. Nomor booking: {bid}. Silakan hubungi kami jika memerlukan bantuan. Terima kasih!",
  check_out_message: "Halo {nama}, terima kasih telah menginap di {outlet}. Bagaimana pengalaman menginap Anda? Kami senang menerima kesan dan masukan Anda. Semoga dapat menyambut Anda kembali!",
};
export type WhatsAppMessages = typeof defaultWhatsAppMessages;
export interface WhatsAppBooking {
  customer_name: string;
  phone?: string;
  status?: string;
  bid?: string;
  date?: string;
  check_in_date?: string;
  check_out_date?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
}
export const whatsappVariables = ["nama", "outlet", "bid", "tanggal_check_in", "jam_check_in", "tanggal_check_out", "jam_check_out"];

export function bookingWhatsAppLink(booking: WhatsAppBooking, outlet: string, messages: WhatsAppMessages): string | null {
  const raw = booking.phone?.trim() || "";
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  else if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  else if (!raw.startsWith("+") && phone.startsWith("8")) phone = `62${phone}`;
  if (!/^[1-9]\d{7,14}$/.test(phone) || booking.status === "BATAL") return null;
  const date = (value?: string) => {
    if (!value) return "-";
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? "-" : format(parsed, "d MMMM yyyy", { locale: id });
  };
  let checkout = booking.check_out_date;
  if (!checkout && booking.date) {
    const start = parseISO(booking.date);
    if (!Number.isNaN(start.getTime())) checkout = format(addDays(start, Math.max(1, booking.duration || 1)), "yyyy-MM-dd");
  }
  const values: Record<string, string> = {
    nama: booking.customer_name, outlet, bid: booking.bid || "-",
    tanggal_check_in: date(booking.check_in_date || booking.date),
    tanggal_check_out: date(checkout),
    jam_check_in: booking.start_time?.slice(0, 5) || "14:00",
    jam_check_out: booking.end_time?.slice(0, 5) || "12:00",
  };
  const template = booking.status === "CO" ? messages.check_out_message : booking.status === "CI" ? messages.check_in_message : messages.booking_message;
  const message = template.replace(/\{([a-z_]+)\}/g, (match, key: string) => values[key] ?? match);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}