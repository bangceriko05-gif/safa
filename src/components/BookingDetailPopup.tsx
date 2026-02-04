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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2, User, Clock, LogIn, LogOut, CheckCircle, AlertCircle, Edit, Trash2, Plus, ChevronDown, Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import CheckInDepositPopup from "@/components/deposit/CheckInDepositPopup";
import CheckOutDepositPopup from "@/components/deposit/CheckOutDepositPopup";

interface BookingDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
  statusColors: Record<string, string>;
  onStatusChange?: () => void;
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
  room_id: string;
  store_id: string | null;
  variant_name?: string;
  discount_type?: string | null;
  discount_value?: number | null;
  payment_method?: string | null;
  reference_no?: string | null;
}

interface ActivityLogEntry {
  id: string;
  action_type: string;
  description: string;
  user_name: string;
  created_at: string;
}

interface TrackingEntry {
  action: string;
  user_name: string;
  timestamp: string;
  description: string;
  icon: React.ReactNode;
}

export default function BookingDetailPopup({
  isOpen,
  onClose,
  bookingId,
  statusColors,
  onStatusChange,
}: BookingDetailPopupProps) {
  const { currentStore } = useStore();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [roomDeposits, setRoomDeposits] = useState<Set<string>>(new Set());
  
  // Check-in deposit popup state
  const [checkInDepositPopup, setCheckInDepositPopup] = useState<{
    open: boolean;
    onConfirmCallback: (() => Promise<void>) | null;
  }>({ open: false, onConfirmCallback: null });

  // Check-out deposit popup state
  const [checkOutDepositPopup, setCheckOutDepositPopup] = useState<{
    open: boolean;
    onConfirmCallback: (() => Promise<void>) | null;
  }>({ open: false, onConfirmCallback: null });

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetail();
      fetchRoomDeposits();
    }
  }, [isOpen, bookingId]);

  const fetchRoomDeposits = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("room_deposits")
        .select("room_id")
        .eq("store_id", currentStore.id)
        .eq("status", "active");

      if (error) throw error;
      setRoomDeposits(new Set(data?.map(d => d.room_id) || []));
    } catch (error) {
      console.error("Error fetching room deposits:", error);
    }
  };

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

      // Fetch activity logs for this booking
      const { data: logsData } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "Booking")
        .eq("entity_id", bookingId)
        .order("created_at", { ascending: true });

      setActivityLogs(logsData || []);

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

  const handleStatusChange = async (newStatus: string) => {
    if (!booking || !bookingId) return;
    
    // If changing to Check In, show deposit popup only if no active deposit exists
    if (newStatus === "CI") {
      const hasActiveDeposit = roomDeposits.has(booking.room_id);
      
      // Skip deposit popup if room already has active deposit
      if (!hasActiveDeposit) {
        setCheckInDepositPopup({
          open: true,
          onConfirmCallback: async () => {
            await executeStatusChange(newStatus);
          },
        });
        return;
      }
    }
    
    // If changing to Check Out, check for active deposits first
    if (newStatus === "CO") {
      const hasActiveDeposit = roomDeposits.has(booking.room_id);
      
      if (hasActiveDeposit) {
        setCheckOutDepositPopup({
          open: true,
          onConfirmCallback: async () => {
            await executeStatusChange(newStatus);
          },
        });
        return;
      }
    }
    
    await executeStatusChange(newStatus);
  };

  const executeStatusChange = async (newStatus: string) => {
    if (!booking || !bookingId) return;
    
    setUpdatingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Anda harus login untuk mengubah status",
          variant: "destructive",
        });
        return;
      }

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Add timestamp and user for specific status changes
      if (newStatus === "CI") {
        updateData.checked_in_at = new Date().toISOString();
        updateData.checked_in_by = user.id;
      } else if (newStatus === "CO") {
        updateData.checked_out_at = new Date().toISOString();
        updateData.checked_out_by = user.id;
      } else if (newStatus === "BO") {
        updateData.confirmed_at = new Date().toISOString();
        updateData.confirmed_by = user.id;
      }

      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (error) throw error;

      // Log activity
      const statusLabels: Record<string, string> = {
        BO: "Reservasi",
        CI: "Check In",
        CO: "Check Out",
        BATAL: "Batal",
      };

      await logActivity({
        actionType: "updated",
        entityType: "Booking",
        entityId: bookingId,
        description: `Mengubah status booking ${booking.customer_name} ke ${statusLabels[newStatus] || newStatus}`,
        storeId: booking.store_id || currentStore?.id,
      });

      // Update room_daily_status for CO status - use TODAY as the checkout date
      if (newStatus === "CO" && booking.room_id) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        await supabase
          .from("room_daily_status")
          .upsert({
            room_id: booking.room_id,
            date: todayStr,
            status: "Kotor",
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "room_id,date" });
      }

      toast({
        title: "Berhasil",
        description: `Status berhasil diubah ke ${statusLabels[newStatus] || newStatus}`,
      });

      // Refresh booking data and deposits
      await fetchBookingDetail();
      await fetchRoomDeposits();
      
      // Notify parent component
      onStatusChange?.();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Gagal",
        description: error.message || "Gagal mengubah status",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getAvailableStatuses = () => {
    const currentStatus = booking?.status || "BO";
    // Define valid status transitions
    const transitions: Record<string, string[]> = {
      BO: ["CI", "BATAL"],
      CI: ["CO", "BATAL"],
      CO: [], // Cannot change from CO
      BATAL: [], // Cannot change from BATAL
    };
    return transitions[currentStatus] || [];
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

  const getActionIcon = (actionType: string, description: string) => {
    if (actionType === "created") {
      return <Plus className="h-4 w-4 text-blue-500" />;
    } else if (actionType === "updated") {
      if (description.toLowerCase().includes("check in") || description.toLowerCase().includes("ci")) {
        return <LogIn className="h-4 w-4 text-emerald-500" />;
      } else if (description.toLowerCase().includes("check out") || description.toLowerCase().includes("co")) {
        return <LogOut className="h-4 w-4 text-orange-500" />;
      } else if (description.toLowerCase().includes("batal")) {
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      } else if (description.toLowerCase().includes("konfirmasi") || description.toLowerCase().includes("bo")) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      }
      return <Edit className="h-4 w-4 text-yellow-500" />;
    } else if (actionType === "deleted") {
      return <Trash2 className="h-4 w-4 text-red-500" />;
    } else if (actionType === "check-in") {
      return <LogIn className="h-4 w-4 text-emerald-500" />;
    } else if (actionType === "check-out") {
      return <LogOut className="h-4 w-4 text-orange-500" />;
    } else if (actionType === "confirm") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <User className="h-4 w-4 text-gray-500" />;
  };

  const getTrackingHistory = (): TrackingEntry[] => {
    // Use activity logs as the primary source
    return activityLogs.map((log) => ({
      action: log.action_type === "created" ? "Dibuat" : 
              log.action_type === "updated" ? "Diubah" : 
              log.action_type === "deleted" ? "Dihapus" :
              log.action_type === "check-in" ? "Check In" :
              log.action_type === "check-out" ? "Check Out" :
              log.action_type === "confirm" ? "Dikonfirmasi" : log.action_type,
      user_name: log.user_name,
      timestamp: log.created_at,
      description: log.description,
      icon: getActionIcon(log.action_type, log.description),
    }));
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

  const handlePrintReceipt = () => {
    if (booking) {
      window.open(`/receipt?id=${booking.id}`, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              Detail Booking
              {booking?.bid && (
                <Badge variant="outline" className="font-mono">
                  {booking.bid}
                </Badge>
              )}
            </div>
            {booking && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReceipt}
                className="gap-1"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
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
              {getAvailableStatuses().length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingStatus}
                      className="gap-1 font-semibold"
                      style={{
                        backgroundColor: getStatusColor(booking.status),
                        color: booking.status === "CO" || booking.status === "BATAL" ? "#fff" : "#1F2937",
                        borderColor: getStatusColor(booking.status),
                      }}
                    >
                      {updatingStatus ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          {getStatusLabel(booking.status)}
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {getAvailableStatuses().map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className="cursor-pointer"
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getStatusColor(status) }}
                        />
                        {getStatusLabel(status)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge
                  style={{
                    backgroundColor: getStatusColor(booking.status),
                    color: booking.status === "CO" || booking.status === "BATAL" ? "#fff" : "#1F2937",
                  }}
                >
                  {getStatusLabel(booking.status)}
                </Badge>
              )}
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
              {getTrackingHistory().length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada riwayat aktivitas</p>
              ) : (
                <div className="space-y-3">
                  {getTrackingHistory().map((entry, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                      <div className="mt-0.5">{entry.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.action}</div>
                        <div className="text-muted-foreground text-xs">
                          {entry.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          oleh <span className="font-medium">{entry.user_name}</span> • {formatDateTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Booking tidak ditemukan
          </div>
        )}
      </DialogContent>

      {/* Check-In Deposit Popup */}
      {booking && checkInDepositPopup.open && (
        <CheckInDepositPopup
          open={checkInDepositPopup.open}
          onClose={() => setCheckInDepositPopup({ open: false, onConfirmCallback: null })}
          onConfirm={async () => {
            if (checkInDepositPopup.onConfirmCallback) {
              await checkInDepositPopup.onConfirmCallback();
            }
          }}
          bookingData={{
            id: booking.id,
            room_id: booking.room_id,
            room_name: booking.room_name,
            customer_name: booking.customer_name,
            store_id: booking.store_id || currentStore?.id || "",
          }}
        />
      )}

      {/* Check-Out Deposit Popup */}
      {booking && checkOutDepositPopup.open && (
        <CheckOutDepositPopup
          open={checkOutDepositPopup.open}
          onClose={() => setCheckOutDepositPopup({ open: false, onConfirmCallback: null })}
          onConfirm={async () => {
            if (checkOutDepositPopup.onConfirmCallback) {
              await checkOutDepositPopup.onConfirmCallback();
            }
          }}
          bookingData={{
            id: booking.id,
            room_id: booking.room_id,
            room_name: booking.room_name,
            customer_name: booking.customer_name,
            store_id: booking.store_id || currentStore?.id || "",
          }}
        />
      )}
    </Dialog>
  );
}
