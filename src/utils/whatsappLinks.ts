import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface BookingData {
  confirmationToken: string;
  customerName: string;
  customerPhone: string;
  storeName: string;
  categoryName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://treebox.app";

/**
 * Generate confirmation page URL
 */
export function getConfirmationUrl(token: string, action?: 'confirm' | 'cancel'): string {
  const url = `${BASE_URL}/booking/confirm?token=${token}`;
  return action ? `${url}&action=${action}` : url;
}

/**
 * Format currency in Indonesian Rupiah
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate WhatsApp message for booking confirmation
 */
export function generateBookingConfirmationMessage(booking: BookingData): string {
  const confirmUrl = getConfirmationUrl(booking.confirmationToken, 'confirm');
  const cancelUrl = getConfirmationUrl(booking.confirmationToken, 'cancel');
  const detailUrl = getConfirmationUrl(booking.confirmationToken);
  
  const formattedDate = format(new Date(booking.bookingDate), "EEEE, d MMMM yyyy", { locale: idLocale });
  
  const message = `Halo ${booking.customerName}! 👋

Terima kasih telah melakukan booking di *${booking.storeName}*.

📋 *Detail Booking Anda:*
📅 Tanggal: ${formattedDate}
⏰ Waktu: ${booking.startTime} - ${booking.endTime}
🎮 Kategori: ${booking.categoryName}
💰 Total: ${formatCurrency(booking.totalPrice)}

Silakan konfirmasi atau batalkan booking Anda:

✅ *Konfirmasi Booking:*
${confirmUrl}

❌ *Batalkan Booking:*
${cancelUrl}

📄 *Lihat Detail Lengkap:*
${detailUrl}

Jika ada pertanyaan, silakan hubungi kami. Terima kasih! 🙏`;

  return message;
}

/**
 * Generate WhatsApp link with pre-filled message
 * @param phone - Customer phone number (will be formatted to international format)
 * @param message - Message to send
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Clean phone number - remove spaces, dashes, and leading zeros
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
  
  // Convert to international format (Indonesia)
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith("62") && !cleanPhone.startsWith("+62")) {
    cleanPhone = "62" + cleanPhone;
  }
  
  // Remove + if present
  cleanPhone = cleanPhone.replace("+", "");
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate complete WhatsApp confirmation link for a booking
 */
export function generateBookingWhatsAppLink(booking: BookingData): string {
  const message = generateBookingConfirmationMessage(booking);
  return generateWhatsAppLink(booking.customerPhone, message);
}

/**
 * Open WhatsApp with the booking confirmation message
 */
export function openWhatsAppConfirmation(booking: BookingData): void {
  const link = generateBookingWhatsAppLink(booking);
  window.open(link, "_blank");
}
