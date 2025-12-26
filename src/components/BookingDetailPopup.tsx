import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2, User, Clock, LogIn, LogOut, CheckCircle, AlertCircle } from "lucide-react";

interface BookingDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
  statusColors: Record<string, string>;
}

interface BookingDetail {
  id: string;
  bid: string | null;
  customer_name: string;
  phone: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: string | null;
  price: number;
  note: string | null;
  created_at: string;
  created_by: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_out_at: string | null;
  checked_out_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  room_name: string;
  variant_name?: string;
  discount_type?: string | null;
  discount_value?: number | null;
  payment_method?: string | null;
  reference_no?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
}

interface TrackingEntry {
  action: string;
  user_name: string;
  timestamp: string;
  icon: React.ReactNode;
}

export default function BookingDetailPopup({
  isOpen,
  onClose,
  bookingId,
  statusColors,
}: BookingDetailPopupProps) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetail();
    }
  }, [isOpen, bookingId]);

  const fetchBookingDetail = async () => {
    if (!bookingId) return;
    setLoading(true);

    try {
      // Fetch booking detail
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          rooms (name)
        `)
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Collect all user IDs to fetch
      const userIds = [
        bookingData.created_by,
        bookingData.checked_in_by,
        bookingData.checked_out_by,
        bookingData.confirmed_by,
      ].filter(Boolean);

      // Fetch profiles for users
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        const profileMap: Record<string, string> = {};
        profilesData?.forEach((p) => {
          profileMap[p.id] = p.name;
        });
        setProfiles(profileMap);
      }

      // Fetch booking products
      const { data: productsData } = await supabase
        .from("booking_products")
        .select("*")
        .eq("booking_id", bookingId);

      setProducts(productsData || []);

      // Fetch variant name if variant_id exists
      let variantName = undefined;
      if (bookingData.variant_id) {
        const { data: variantData } = await supabase
          .from("room_variants")
          .select("variant_name")
          .eq("id", bookingData.variant_id)
          .single();
        variantName = variantData?.variant_name;
      }

      setBooking({
        ...bookingData,
        room_name: bookingData.rooms?.name || "Unknown",
        variant_name: variantName,
      });
    } catch (error) {
      console.error("Error fetching booking detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case "BO":
        return "Reservasi";
      case "CI":
        return "Check In";
      case "CO":
        return "Check Out";
      case "BATAL":
        return "BATAL";
      default:
        return "Reservasi";
    }
  };

  const getStatusColor = (status: string | null) => {
    return statusColors[status || "BO"] || "#87CEEB";
  };

  const getTrackingHistory = (): TrackingEntry[] => {
    if (!booking) return [];

    const entries: TrackingEntry[] = [];

    // Created
    entries.push({
      action: "Dibuat",
      user_name: profiles[booking.created_by] || "Unknown",
      timestamp: booking.created_at,
      icon: <User className="h-4 w-4 text-blue-500" />,
    });

    // Confirmed
    if (booking.confirmed_at && booking.confirmed_by) {
      entries.push({
        action: "Dikonfirmasi",
        user_name: profiles[booking.confirmed_by] || "Unknown",
        timestamp: booking.confirmed_at,
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      });
    }

    // Check In
    if (booking.checked_in_at && booking.checked_in_by) {
      entries.push({
        action: "Check In",
        user_name: profiles[booking.checked_in_by] || "Unknown",
        timestamp: booking.checked_in_at,
        icon: <LogIn className="h-4 w-4 text-emerald-500" />,
      });
    }

    // Check Out
    if (booking.checked_out_at && booking.checked_out_by) {
      entries.push({
        action: "Check Out",
        user_name: profiles[booking.checked_out_by] || "Unknown",
        timestamp: booking.checked_out_at,
        icon: <LogOut className="h-4 w-4 text-orange-500" />,
      });
    }

    // BATAL
    if (booking.status === "BATAL") {
      entries.push({
        action: "Dibatalkan",
        user_name: "-",
        timestamp: booking.created_at,
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      });
    }

    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy HH:mm", { locale: idLocale });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detail Booking
            {booking?.bid && (
              <Badge variant="outline" className="font-mono">
                {booking.bid}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : booking ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                style={{
                  backgroundColor: getStatusColor(booking.status),
                  color: booking.status === "CO" || booking.status === "BATAL" ? "#fff" : "#1F2937",
                }}
              >
                {getStatusLabel(booking.status)}
              </Badge>
            </div>

            <Separator />

            {/* Customer Info */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Informasi Pelanggan</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Nama</span>
                <span>{booking.customer_name}</span>
                <span className="text-muted-foreground">Telepon</span>
                <span>{booking.phone}</span>
              </div>
            </div>

            <Separator />

            {/* Booking Info */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Informasi Booking</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Ruangan</span>
                <span>{booking.room_name}</span>
                {booking.variant_name && (
                  <>
                    <span className="text-muted-foreground">Varian</span>
                    <span>{booking.variant_name}</span>
                  </>
                )}
                <span className="text-muted-foreground">Tanggal</span>
                <span>{format(new Date(booking.date), "d MMMM yyyy", { locale: idLocale })}</span>
                <span className="text-muted-foreground">Waktu</span>
                <span>{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</span>
                <span className="text-muted-foreground">Durasi</span>
                <span>{booking.duration} jam</span>
                <span className="text-muted-foreground">Harga</span>
                <span>{formatCurrency(booking.price)}</span>
                {booking.payment_method && (
                  <>
                    <span className="text-muted-foreground">Pembayaran</span>
                    <span>{booking.payment_method} {booking.reference_no ? `(${booking.reference_no})` : ""}</span>
                  </>
                )}
              </div>
            </div>

            {/* Products */}
            {products.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Produk</h4>
                  <div className="space-y-1">
                    {products.map((product) => (
                      <div key={product.id} className="flex justify-between text-sm">
                        <span>{product.product_name} x{product.quantity}</span>
                        <span>{formatCurrency(product.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {booking.note && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Catatan</h4>
                  <p className="text-sm text-muted-foreground">{booking.note}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Tracking History */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Riwayat Tracking
              </h4>
              <div className="space-y-3">
                {getTrackingHistory().map((entry, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5">{entry.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium">{entry.action}</div>
                      <div className="text-muted-foreground">
                        oleh {entry.user_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Booking tidak ditemukan
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
