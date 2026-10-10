import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { bookingWhatsAppLink, WhatsAppBooking } from "@/utils/bookingWhatsApp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function WhatsAppIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6A12 12 0 0 0 12 24c6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.5ZM12 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.3-.4A10 10 0 1 1 12 22Zm5.5-7.5c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2l-1 1.2c-.2.2-.4.2-.7.1-1.8-.9-3-2-3.9-3.6-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.2 3.4 5.4 4.8 2 .9 2.8.9 3.8.7.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.5Z" /></svg>;
}

export default function BookingWhatsAppPhone({ booking, className, icon = true }: { booking: WhatsAppBooking; className?: string; icon?: boolean }) {
  const { currentStore } = useStore();
  const { data, isError } = useWhatsAppMessages(currentStore?.id);
  if (!booking.phone) return <span>-</span>;
  const href = data ? bookingWhatsAppLink(booking, currentStore?.name || "", data) : null;
  return <Button variant="link" className={cn("booking-whatsapp-phone h-auto min-w-0 justify-start gap-1 p-0 font-semibold", className)} aria-label={`WhatsApp ${booking.phone}`} title="Buka WhatsApp" onClick={(event) => {
    event.preventDefault(); event.stopPropagation();
    if (!href) { toast.error(isError ? "Gagal memuat pesan WhatsApp. Coba kembali." : !data ? "Pesan WhatsApp sedang dimuat. Coba kembali." : "Nomor WhatsApp tidak valid atau booking dibatalkan."); return; }
    window.open(href, "_blank", "noopener,noreferrer");
  }}>{icon && <WhatsAppIcon className="h-3 w-3 shrink-0" />}<span className="truncate">{booking.phone}</span></Button>;
}