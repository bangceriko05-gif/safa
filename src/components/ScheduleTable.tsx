import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit, Trash2, User, Phone, Clock, DollarSign, FileText, Calendar, Copy, ChevronDown, XCircle, Undo, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { logActivity } from "@/utils/activityLogger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CheckInDepositPopup from "@/components/deposit/CheckInDepositPopup";

interface ScheduleTableProps {
  selectedDate: Date;
  userRole: string | null;
  onAddBooking: (roomId: string, time: string) => void;
  onEditBooking: (booking: any) => void;
  displaySize?: string;
}

interface Room {
  id: string;
  name: string;
  status: string;
  created_at?: string;
}

interface Booking {
  id: string;
  customer_name: string;
  phone?: string;
  reference_no?: string;
  room_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  price_2?: number;
  dual_payment?: boolean;
  payment_method?: string;
  payment_method_2?: string;
  note?: string;
  created_by?: string;
  status?: string;
  discount_value?: number;
  discount_type?: string;
  discount_applies_to?: string;
  checked_in_by?: string;
  checked_in_at?: string;
  checked_out_by?: string;
  checked_out_at?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  bid?: string;
}

interface BookingWithAdmin extends Booking {
  admin_name?: string;
  products_total?: number;
  checked_in_by_name?: string;
  checked_out_by_name?: string;
  confirmed_by_name?: string;
  room_subtotal?: number;
  variant_price?: number;
}

export default function ScheduleTable({
  selectedDate,
  userRole,
  onAddBooking,
  onEditBooking,
  displaySize = "normal",
}: ScheduleTableProps) {
  const { currentStore } = useStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<BookingWithAdmin[]>([]);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusColors, setStatusColors] = useState<Record<string, string>>({
    BO: "#87CEEB",
    CI: "#90EE90",
    CO: "#6B7280",
    BATAL: "#9CA3AF",
  });
  const [bookingTextColor, setBookingTextColor] = useState<string>(() => {
    return localStorage.getItem("booking-text-color") || "#1F2937";
  });
  const [roomDailyStatus, setRoomDailyStatus] = useState<Record<string, string>>({});
  const [roomDailyStatusData, setRoomDailyStatusData] = useState<Record<string, { status: string; updated_by_name?: string }>>({});
  const [updatingPopupStatus, setUpdatingPopupStatus] = useState<string | null>(null);
  const [confirmReadyRoom, setConfirmReadyRoom] = useState<{ roomId: string; roomName: string } | null>(null);
  const [roomsWithCheckout, setRoomsWithCheckout] = useState<Set<string>>(new Set());
  
  // Check-in deposit popup state
  const [checkInDepositPopup, setCheckInDepositPopup] = useState<{
    open: boolean;
    bookingId: string;
    bookingData: BookingWithAdmin | null;
    onConfirmCallback: (() => Promise<void>) | null;
  }>({ open: false, bookingId: "", bookingData: null, onConfirmCallback: null });

  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = i + 9;
    const displayHour = hour >= 24 ? hour - 24 : hour;
    return `${displayHour.toString().padStart(2, "0")}:00`;
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchRooms();
    fetchUserPermissions();
    fetchStatusColors();

    // Listen for status color changes
    const handleStatusColorsChange = () => fetchStatusColors();
    const handleBookingTextColorChange = () => {
      const color = localStorage.getItem("booking-text-color") || "#1F2937";
      setBookingTextColor(color);
    };
    
    window.addEventListener("status-colors-changed", handleStatusColorsChange);
    window.addEventListener("booking-text-color-changed", handleBookingTextColorChange);

    return () => {
      window.removeEventListener("status-colors-changed", handleStatusColorsChange);
      window.removeEventListener("booking-text-color-changed", handleBookingTextColorChange);
    };
  }, [currentStore]);

  const fetchStatusColors = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("status_colors")
        .select("*")
        .eq("store_id", currentStore.id);

      if (error) throw error;

      // If no colors exist for this store, create defaults
      if (!data || data.length === 0) {
        const defaultColors = [
          { status: "BO", color: "#87CEEB", store_id: currentStore.id },
          { status: "CI", color: "#90EE90", store_id: currentStore.id },
          { status: "CO", color: "#6B7280", store_id: currentStore.id },
        ];

        const { data: newColors, error: insertError } = await supabase
          .from("status_colors")
          .insert(defaultColors)
          .select();

        if (insertError) {
          console.error("Error creating default status colors:", insertError);
          return;
        }

        const colors: Record<string, string> = {};
        newColors?.forEach((sc) => {
          colors[sc.status] = sc.color;
        });
        setStatusColors(colors);
      } else {
        const colors: Record<string, string> = {};
        data.forEach((sc) => {
          colors[sc.status] = sc.color;
        });
        setStatusColors(colors);
      }
    } catch (error) {
      console.error("Error fetching status colors:", error);
    }
  };

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission_id, permissions(name)")
        .eq("user_id", user.id);

      if (error) throw error;
      
      const permissionNames = data?.map((up: any) => up.permissions?.name).filter(Boolean) || [];
      setUserPermissions(permissionNames);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    }
  };

  const hasPermission = (permissionName: string) => {
    return userPermissions.includes(permissionName) || userRole === "admin";
  };

  useEffect(() => {
    if (!currentStore) return;
    // Clear bookings first and set loading
    setBookings([]);
    setIsLoading(true);
    fetchBookings().finally(() => setIsLoading(false));

    // **OPTIMIZED REALTIME: Debounced updates to prevent excessive fetching**
    let debounceTimer: NodeJS.Timeout;
    
    const channel = supabase
      .channel(`bookings-${currentStore.id}-${format(selectedDate, "yyyy-MM-dd")}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `store_id=eq.${currentStore.id}`,
        },
        (payload) => {
          console.log('Booking changed:', payload);
          // Debounce: Wait 500ms before fetching to batch multiple updates
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchBookings();
          }, 500);
        }
      )
      .subscribe();

    // Listen for booking changes
    const handleBookingChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchBookings();
      }, 300);
    };
    window.addEventListener("booking-changed", handleBookingChange);

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
      window.removeEventListener("booking-changed", handleBookingChange);
    };
  }, [selectedDate, currentStore]);

  const fetchRooms = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      
      // Remove duplicates and ensure unique room IDs
      const uniqueRooms = data ? data.filter((room, index, self) => 
        index === self.findIndex((r) => r.id === room.id)
      ) : [];
      
      setRooms(uniqueRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchRoomDailyStatus = async () => {
    try {
      if (!currentStore) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("room_daily_status")
        .select("room_id, status, updated_by")
        .eq("date", dateStr);

      if (error) throw error;

      const map: Record<string, string> = {};
      const dataMap: Record<string, { status: string; updated_by_name?: string }> = {};
      
      // Get user names for updated_by
      const userIds = data?.map(r => r.updated_by).filter(Boolean) || [];
      let userNames: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          userNames[p.id] = p.name;
        });
      }
      
      data?.forEach((row) => {
        map[row.room_id] = row.status;
        dataMap[row.room_id] = {
          status: row.status,
          updated_by_name: row.updated_by ? userNames[row.updated_by] : undefined,
        };
      });
      setRoomDailyStatus(map);
      setRoomDailyStatusData(dataMap);
    } catch (error) {
      console.error("Error fetching room daily status:", error);
    }
  };

  // Fetch rooms that have had checkouts today (to show "was used" indicator)
  const fetchRoomsWithCheckout = async () => {
    try {
      if (!currentStore) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Fetch bookings with CO status for the selected date
      const { data, error } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("date", dateStr)
        .eq("store_id", currentStore.id)
        .eq("status", "CO");

      if (error) throw error;

      const roomIds = new Set(data?.map(b => b.room_id) || []);
      setRoomsWithCheckout(roomIds);
    } catch (error) {
      console.error("Error fetching rooms with checkout:", error);
    }
  };

  useEffect(() => {
    if (!currentStore) return;
    fetchRoomDailyStatus();
    fetchRoomsWithCheckout();

    const channel = supabase
      .channel(
        `room-daily-status-${currentStore.id}-${format(selectedDate, "yyyy-MM-dd")}`
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_daily_status" },
        () => fetchRoomDailyStatus()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchRoomsWithCheckout()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStore, selectedDate]);

  const fetchBookings = async () => {
    try {
      if (!currentStore) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Fetch all bookings for the date (exclude CO and BATAL status - they should not appear on calendar)
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*, bid")
        .eq("date", dateStr)
        .eq("store_id", currentStore.id)
        .not("status", "in", "(CO,BATAL)");

      if (error) throw error;
      
      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // **OPTIMIZED: Fetch all related data in parallel**
      const bookingIds = bookingsData.map(b => b.id);
      const allUserIds = [...new Set([
        ...bookingsData.map(b => b.created_by),
        ...bookingsData.map(b => b.checked_in_by),
        ...bookingsData.map(b => b.checked_out_by),
        ...bookingsData.map(b => b.confirmed_by),
      ].filter(Boolean))] as string[];
      const variantIds = [...new Set(bookingsData.map(b => b.variant_id).filter(Boolean))] as string[];

      // Parallel fetch all related data at once
      const [
        { data: profiles },
        { data: bookingProducts },
        { data: variants }
      ] = await Promise.all([
        supabase.from("profiles").select("id, name").in("id", allUserIds),
        supabase.from("booking_products").select("booking_id, subtotal").in("booking_id", bookingIds),
        supabase.from("room_variants").select("id, price, duration").in("id", variantIds)
      ]);

      // Create a map for products total by booking_id
      const productsMap = new Map<string, number>();
      (bookingProducts || []).forEach(bp => {
        const current = productsMap.get(bp.booking_id) || 0;
        productsMap.set(bp.booking_id, current + Number(bp.subtotal));
      });

      // Create a map for variant info
      const variantMap = new Map(
        (variants || []).map(v => [v.id, v])
      );

      // Create a map for quick lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p.name])
      );

      // Map bookings with admin names, products total, and room subtotal
      const bookingsWithAdmin: BookingWithAdmin[] = bookingsData.map(booking => {
        const productsTotal = productsMap.get(booking.id) || 0;
        
        // Calculate room subtotal based on variant
        let roomSubtotal = 0;
        let variantPrice = 0;
        if (booking.variant_id) {
          const variant = variantMap.get(booking.variant_id);
          if (variant) {
            variantPrice = variant.price;
            // Calculate price per hour and multiply by booking duration
            const pricePerHour = variant.price / variant.duration;
            roomSubtotal = Math.round(pricePerHour * booking.duration);
          }
        }
        
        return {
          ...booking,
          admin_name: profileMap.get(booking.created_by || "") || "Unknown",
          products_total: productsTotal,
          checked_in_by_name: booking.checked_in_by ? profileMap.get(booking.checked_in_by) : undefined,
          checked_out_by_name: booking.checked_out_by ? profileMap.get(booking.checked_out_by) : undefined,
          confirmed_by_name: booking.confirmed_by ? profileMap.get(booking.confirmed_by) : undefined,
          room_subtotal: roomSubtotal,
          variant_price: variantPrice,
        };
      });
      
      setBookings(bookingsWithAdmin);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const handleDeleteBooking = async () => {
    if (!deleteBookingId) return;

    try {
      // Get booking details before deleting for logging
      const { data: bookingToDelete } = await supabase
        .from("bookings")
        .select(`
          customer_name, 
          date,
          rooms (name)
        `)
        .eq("id", deleteBookingId)
        .single();

      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", deleteBookingId);

      if (error) throw error;

      // Log activity
      if (bookingToDelete) {
        const roomName = (bookingToDelete as any).rooms?.name || 'Unknown';
        await logActivity({
          actionType: 'deleted',
          entityType: 'Booking',
          entityId: deleteBookingId,
          description: `Menghapus booking ${bookingToDelete.customer_name} di kamar ${roomName} pada ${bookingToDelete.date}`,
          storeId: currentStore?.id,
        });
      }

      toast.success("Booking berhasil dihapus");
      fetchBookings();
    } catch (error: any) {
      toast.error("Gagal menghapus booking");
      console.error(error);
    } finally {
      setDeleteBookingId(null);
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      // Get booking details for logging and room update
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(`
          customer_name,
          room_id,
          rooms (name)
        `)
        .eq("id", bookingId)
        .single();

      // Get current user for tracking who made the change
      const { data: { user } } = await supabase.auth.getUser();

      // Prepare update data
      const updateData: any = { status: newStatus };
      
      if (newStatus === "CI") {
        updateData.checked_in_by = user?.id;
        updateData.checked_in_at = new Date().toISOString();
      } else if (newStatus === "CO") {
        updateData.checked_out_by = user?.id;
        updateData.checked_out_at = new Date().toISOString();

        // Mark room as "Kotor" for TODAY (the actual checkout date)
        if (bookingData?.room_id) {
          const todayStr = format(new Date(), "yyyy-MM-dd");

          const { error: dailyError } = await supabase
            .from("room_daily_status")
            .upsert(
              {
                room_id: bookingData.room_id,
                date: todayStr,
                status: "Kotor",
                updated_by: user?.id,
              },
              { onConflict: "room_id,date" }
            );

          if (dailyError) throw dailyError;
        }
      }

      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (error) throw error;

      if (bookingData) {
        const roomName = (bookingData as any).rooms?.name || 'Unknown';
        const actionType = newStatus === 'CI' ? 'check-in' : newStatus === 'CO' ? 'check-out' : 'updated';
        await logActivity({
          actionType,
          entityType: 'Booking',
          entityId: bookingId,
          description: `Mengubah status booking ${bookingData.customer_name} di kamar ${roomName} menjadi ${newStatus}`,
          storeId: currentStore?.id,
        });
      }

      toast.success(`Status berhasil diubah ke ${newStatus}`);
      fetchBookings();
      fetchRoomDailyStatus();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal mengubah status");
      console.error(error);
    }
  };

  const handlePopupStatusChange = async (bookingId: string, newStatus: string, bookingData: BookingWithAdmin) => {
    // If changing to Check In, show deposit popup first
    if (newStatus === "CI") {
      // Get room name for deposit popup
      const room = rooms.find(r => r.id === bookingData.room_id);
      
      setCheckInDepositPopup({
        open: true,
        bookingId,
        bookingData: {
          ...bookingData,
          room_name: room?.name,
        } as any,
        onConfirmCallback: async () => {
          await executeStatusChange(bookingId, newStatus, bookingData);
        },
      });
      return;
    }
    
    await executeStatusChange(bookingId, newStatus, bookingData);
  };

  const executeStatusChange = async (bookingId: string, newStatus: string, bookingData: BookingWithAdmin) => {
    setUpdatingPopupStatus(bookingId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Anda harus login untuk mengubah status");
        return;
      }

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "CI") {
        updateData.checked_in_by = user.id;
        updateData.checked_in_at = new Date().toISOString();
      } else if (newStatus === "CO") {
        updateData.checked_out_by = user.id;
        updateData.checked_out_at = new Date().toISOString();

        // Mark room as Kotor for TODAY (the actual checkout date)
        if (bookingData.room_id) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          await supabase
            .from("room_daily_status")
            .upsert({
              room_id: bookingData.room_id,
              date: todayStr,
              status: "Kotor",
              updated_by: user.id,
            }, { onConflict: "room_id,date" });
          fetchRoomDailyStatus();
        }
      } else if (newStatus === "BATAL") {
        // BATAL: Set room to ready (Aktif) directly
        if (bookingData.room_id) {
          const dateStr = format(selectedDate, "yyyy-MM-dd");
          await supabase
            .from("room_daily_status")
            .upsert({
              room_id: bookingData.room_id,
              date: dateStr,
              status: "Aktif",
              updated_by: user.id,
            }, { onConflict: "room_id,date" });
          fetchRoomDailyStatus();
        }
      } else if (newStatus === "BO") {
        updateData.confirmed_by = user.id;
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (error) throw error;

      const statusLabels: Record<string, string> = {
        BO: "Reservasi",
        CI: "Check In",
        CO: "Check Out",
        BATAL: "Batal",
      };

      await logActivity({
        actionType: 'updated',
        entityType: 'Booking',
        entityId: bookingId,
        description: `Mengubah status booking ${bookingData.customer_name} ke ${statusLabels[newStatus] || newStatus}`,
      });

      toast.success(`Status berhasil diubah ke ${statusLabels[newStatus] || newStatus}`);
      fetchBookings();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Gagal mengubah status");
    } finally {
      setUpdatingPopupStatus(null);
    }
  };

  const getPopupAvailableStatuses = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      BO: ["CI", "BATAL"],
      CI: ["CO", "BATAL"],
      CO: [],
      BATAL: [],
    };
    return transitions[currentStatus] || [];
  };

  const getPopupStatusLabel = (status: string) => {
    switch (status) {
      case "BO": return "Reservasi";
      case "CI": return "Check In";
      case "CO": return "Check Out";
      case "BATAL": return "BATAL";
      default: return status;
    }
  };

  const handleRoomStatusChange = async (roomId: string, newStatus: string, skipConfirmation = false) => {
    // If changing to Ready/Aktif and not skipping confirmation, show dialog
    if (newStatus === "Aktif" && !skipConfirmation) {
      const room = rooms.find((r) => r.id === roomId);
      setConfirmReadyRoom({ roomId, roomName: room?.name || "Unknown" });
      return;
    }
    
    try {
      const room = rooms.find((r) => r.id === roomId);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data: { user } } = await supabase.auth.getUser();

      if (newStatus === "Aktif") {
        // Instead of deleting, update with status Aktif to track who set it ready
        const { error } = await supabase
          .from("room_daily_status")
          .upsert(
            {
              room_id: roomId,
              date: dateStr,
              status: "Aktif",
              updated_by: user?.id,
            },
            { onConflict: "room_id,date" }
          );

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("room_daily_status")
          .upsert(
            {
              room_id: roomId,
              date: dateStr,
              status: newStatus,
              updated_by: user?.id,
            },
            { onConflict: "room_id,date" }
          );

        if (error) throw error;
      }

      await logActivity({
        actionType: 'updated',
        entityType: 'Room',
        entityId: roomId,
        description: `Mengubah status kamar ${room?.name || 'Unknown'} tanggal ${dateStr} menjadi ${newStatus === 'Aktif' ? 'Ready' : newStatus}`,
      });

      toast.success(`Status kamar ${room?.name} tanggal ${format(selectedDate, "dd MMM")} sudah ${newStatus === 'Aktif' ? 'Ready' : newStatus}`);
      fetchRoomDailyStatus();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal mengubah status kamar");
      console.error(error);
    }
  };

  const handleConfirmReady = async () => {
    if (!confirmReadyRoom) return;
    await handleRoomStatusChange(confirmReadyRoom.roomId, "Aktif", true);
    setConfirmReadyRoom(null);
  };

  // Check if a slot is the start of a booking
  // Also handles bookings that started before the first visible time slot
  const isBookingStart = (roomId: string, time: string) => {
    const slotHour = parseInt(time.split(":")[0]);
    const firstVisibleHour = 9; // First hour in timeSlots
    
    return bookings.find((b) => {
      if (b.room_id !== roomId) return false;
      
      const bookingStartHour = parseInt(b.start_time.split(":")[0]);
      let bookingEndHour = parseInt(b.end_time.split(":")[0]);
      
      // Handle overnight bookings
      if (bookingEndHour < bookingStartHour) {
        bookingEndHour += 24;
      }
      
      // Exact match: booking starts at this slot
      if (bookingStartHour === slotHour) {
        return true;
      }
      
      // Booking started before visible hours (e.g., 08:00) but is still active
      // Show it at the first visible slot
      if (bookingStartHour < firstVisibleHour && slotHour === firstVisibleHour) {
        // Check if booking is still active at first visible hour
        return bookingEndHour > firstVisibleHour;
      }
      
      return false;
    });
  };

  // Check if a slot is occupied by a booking (but not the start)
  const isSlotOccupied = (roomId: string, time: string) => {
    const firstVisibleHour = 9; // First hour in timeSlots
    let slotHour = parseInt(time.split(":")[0]);
    
    // Convert slot hour to 24+ format if it's in the early morning
    if (slotHour >= 0 && slotHour <= 5) {
      slotHour += 24;
    }
    
    return bookings.some((b) => {
      if (b.room_id !== roomId) return false;
      
      const bookingStartHour = parseInt(b.start_time.split(":")[0]);
      let startHour = bookingStartHour;
      let endHour = parseInt(b.end_time.split(":")[0]);
      
      if (endHour < startHour) {
        endHour += 24;
      }
      
      // If booking started before visible hours and we're at the first visible hour,
      // it's shown as a booking start, not occupied
      if (startHour < firstVisibleHour && slotHour === firstVisibleHour) {
        return false;
      }
      
      // For bookings that started before visible hours, treat firstVisibleHour as the effective start
      const effectiveStart = startHour < firstVisibleHour ? firstVisibleHour : startHour;
      
      // Check if this slot is occupied but not the start
      return slotHour > effectiveStart && slotHour < endHour;
    });
  };

  // Filter & deduplicate rooms: show only active rooms for regular users
  const roomsByStatus = (userRole === "admin" || userRole === "leader")
    ? rooms
    : rooms.filter((room) => room.status === "Aktif");

  // Untuk tanggal lampau, sembunyikan ruangan yang dibuat setelah tanggal yang dipilih
  const filteredRooms = roomsByStatus.filter((room) => {
    if (!room.created_at) return true;
    const roomCreatedDate = new Date(room.created_at);
    const selectedOnlyDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const roomOnlyDate = new Date(roomCreatedDate.getFullYear(), roomCreatedDate.getMonth(), roomCreatedDate.getDate());
    return roomOnlyDate <= selectedOnlyDate;
  });

  const displayRooms = Array.from(
    new Map(filteredRooms.map((room) => [room.id, room])).values(),
  );

  // Hide any rooms that don't have a valid name to avoid rendering empty columns
  const visibleRooms = displayRooms.filter((room) => room.name && room.name.trim() !== "");
  // Size configurations
  const sizeConfig = {
    normal: {
      headerPadding: "p-2",
      cellPadding: "p-2",
      fontSize: "text-xs",
      headerFont: "text-sm",
      minWidth: "min-w-[120px]",
      iconSize: "w-2.5 h-2.5",
      buttonHeight: "min-h-[55px]",
      cardPadding: "p-2.5",
      buttonIconSize: "h-3 w-3",
      buttonTextSize: "text-xs",
      buttonPadding: "px-2.5",
      buttonHeight2: "h-7",
      dotSize: "w-2.5 h-2.5",
      spacing: "space-y-1.5",
      gapSize: "gap-1.5",
    },
    compact: {
      headerPadding: "p-1.5",
      cellPadding: "p-1.5",
      fontSize: "text-[10px]",
      headerFont: "text-xs",
      minWidth: "min-w-[100px]",
      iconSize: "w-2 h-2",
      buttonHeight: "min-h-[45px]",
      cardPadding: "p-2",
      buttonIconSize: "h-2.5 w-2.5",
      buttonTextSize: "text-[10px]",
      buttonPadding: "px-2",
      buttonHeight2: "h-6",
      dotSize: "w-2 h-2",
      spacing: "space-y-1",
      gapSize: "gap-1",
    },
    large: {
      headerPadding: "p-1",
      cellPadding: "p-1",
      fontSize: "text-[9px]",
      headerFont: "text-[10px]",
      minWidth: "min-w-[85px]",
      iconSize: "w-1.5 h-1.5",
      buttonHeight: "min-h-[40px]",
      cardPadding: "p-1.5",
      buttonIconSize: "h-2 w-2",
      buttonTextSize: "text-[9px]",
      buttonPadding: "px-1.5",
      buttonHeight2: "h-5",
      dotSize: "w-1.5 h-1.5",
      spacing: "space-y-0.5",
      gapSize: "gap-0.5",
    },
  };

  const size = sizeConfig[displaySize as keyof typeof sizeConfig] || sizeConfig.normal;

  console.log("[ScheduleTable] counts", {
    rooms: rooms.length,
    filteredRooms: filteredRooms.length,
    displayRooms: displayRooms.length,
    visibleRooms: visibleRooms.length,
    selectedDate: selectedDate.toISOString(),
  });
  console.table(
    visibleRooms.map((room, index) => ({
      idx: index,
      id: room.id,
      name: room.name,
      status: room.status,
      created_at: room.created_at,
    }))
  );


  return (
    <>
      {isLoading && (
        <div className="bg-card rounded-xl shadow-[var(--shadow-card)] border-2 border-border p-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Memuat data booking...</span>
          </div>
        </div>
      )}
      
      {!isLoading && (
        <div className="bg-card rounded-xl shadow-[var(--shadow-card)] overflow-hidden border-2 border-border">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border bg-muted/50">
                <th className={`${size.headerPadding} text-left font-medium ${size.headerFont} sticky left-0 top-0 bg-muted/50 z-20 border-r-2 border-border`}>
                  Waktu
                </th>
                {visibleRooms.map((room) => {
                  const isBlocked = room.status !== "Aktif";
                  const dailyStatus = roomDailyStatus[room.id] || null;
                  const isKotor = dailyStatus === "Kotor";
                  const wasUsedToday = roomsWithCheckout.has(room.id);
                  const isReadyAfterUse = wasUsedToday && dailyStatus === "Aktif";

                  // Determine dot color: 
                  // - Red if Kotor
                  // - Green/Teal if Ready after use (was used today)
                  // - Gray if blocked
                  // - Blue if normal available
                  const getDotColor = () => {
                    if (isKotor) return "#EF4444";
                    if (isBlocked) return "#9CA3AF";
                    if (isReadyAfterUse) return "#14B8A6"; // Teal for "cleaned after use"
                    return "#3B82F6";
                  };

                  return (
                    <th 
                      key={room.id} 
                      className={`${size.headerPadding} text-left font-medium ${size.headerFont} ${size.minWidth} border-r-2 border-border sticky top-0 z-10 ${isBlocked ? "opacity-50" : ""} ${isReadyAfterUse ? "bg-teal-50 dark:bg-teal-950/30" : "bg-muted/50"}`}
                    >
                      <div className={`flex items-center ${size.gapSize}`}> 
                        <div className="relative">
                          <div
                            className={`${size.dotSize} rounded-full`}
                            style={{ backgroundColor: getDotColor() }}
                          />
                          {/* Small sparkle icon for rooms that were used and cleaned */}
                          {isReadyAfterUse && (
                            <Sparkles 
                              className="absolute -top-1 -right-1 w-2.5 h-2.5 text-teal-500" 
                              style={{ filter: "drop-shadow(0 0 2px rgba(20, 184, 166, 0.5))" }}
                            />
                          )}
                        </div>
                        {room.name}

                        {isKotor ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <span
                                className={`${size.fontSize} text-muted-foreground cursor-pointer hover:text-primary transition-colors`}
                                title="Klik untuk set Ready"
                              >
                                (Kotor)
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" side="bottom" align="start">
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Kamar sedang kotor (tanggal ini)</p>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleRoomStatusChange(room.id, "Aktif")}
                                >
                                  Set Ready
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : isReadyAfterUse && roomDailyStatusData[room.id]?.updated_by_name ? (
                          <span 
                            className={`${size.fontSize} text-teal-600 dark:text-teal-400 font-medium`} 
                            title={`Sudah dibersihkan oleh: ${roomDailyStatusData[room.id].updated_by_name}`}
                          >
                            ✓ Bersih
                          </span>
                        ) : roomDailyStatusData[room.id]?.status === "Aktif" && roomDailyStatusData[room.id]?.updated_by_name ? (
                          <span className={`${size.fontSize} text-muted-foreground`} title={`Direadykan oleh: ${roomDailyStatusData[room.id].updated_by_name}`}>
                            (Ready - {roomDailyStatusData[room.id].updated_by_name})
                          </span>
                        ) : isBlocked ? (
                          <span className={`${size.fontSize} text-muted-foreground`}>
                            ({room.status})
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time, index) => {
                const nextTime = timeSlots[index + 1] || "05:00";
                return (
                  <tr key={time} className="border-b-2 border-border hover:bg-muted/30 transition-colors">
                    <td className={`${size.cellPadding} ${size.fontSize} font-medium sticky left-0 bg-card border-r-2 border-border z-10`}>
                      {time} - {nextTime}
                    </td>
                    {visibleRooms.map((room) => {
                      const booking = isBookingStart(room.id, time);
                      const isOccupied = isSlotOccupied(room.id, time);
                      const isBlocked = room.status !== "Aktif";

                      // If this slot is occupied by a booking (but not the start), render nothing but keep the cell structure
                      // Note: We return empty fragment because the parent booking cell uses rowSpan
                      if (isOccupied) {
                        // The rowSpan from the booking start cell covers this - return null is correct
                        // BUT we need to make sure the room.id matches the booking's room_id
                        return null;
                      }

                      if (booking) {
                        // Calculate room subtotal from variant
                        const roomSubtotal = booking.room_subtotal || 0;
                        
                        // Calculate products total
                        const productsTotal = booking.products_total || 0;
                        
                        // Calculate discount
                        let discount = 0;
                        if (booking.discount_value && booking.discount_value > 0) {
                          const targetAmount = booking.discount_applies_to === "variant" ? roomSubtotal : productsTotal;
                          if (booking.discount_type === "percentage") {
                            discount = Math.round((targetAmount * booking.discount_value) / 100);
                          } else {
                            discount = booking.discount_value;
                          }
                        }
                        
                        // Calculate grand total (room subtotal + products - discount)
                        const grandTotal = Math.max(0, roomSubtotal + productsTotal - discount);
                        
                        // Determine background color based on status using configured colors
                        const status = booking.status || 'BO';
                        const statusColor = statusColors[status] || '#3B82F6';
                        const isBatal = status === 'BATAL';
                        const bgColor = isBatal ? `${statusColor}20` : `${statusColor}40`; // Add transparency
                        const borderColor = statusColor;
                          
                        // Calculate the actual rowSpan based on visible time slots
                        const bookingStartHour = parseInt(booking.start_time.split(":")[0]);
                        const firstVisibleHour = 9;
                        const bookingEndHour = parseInt(booking.end_time.split(":")[0]);
                        
                        // If booking started before visible hours, calculate rowSpan from first visible hour
                        const effectiveRowSpan = bookingStartHour < firstVisibleHour 
                          ? bookingEndHour - firstVisibleHour 
                          : booking.duration;
                          
                        return (
                          <td 
                            key={room.id} 
                            className={`${size.cellPadding} align-top border-r-2 border-border bg-blue-500/10`}
                            rowSpan={effectiveRowSpan}
                          >
                            <Card
                              className={`${size.cardPadding} h-full transition-[var(--transition-smooth)] relative ${
                                isBlocked || isBatal
                                  ? "opacity-60 bg-muted/30" 
                                  : "hover:shadow-[var(--shadow-hover)]"
                              }`}
                              style={{
                                backgroundColor: isBlocked ? "#f3f4f6" : bgColor,
                                borderLeft: `3px solid ${isBlocked ? "#9CA3AF" : borderColor}`,
                              }}
                            >
                              {/* Status Badge with Popover */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div 
                                    className={`absolute top-1 right-1 ${size.buttonTextSize} font-bold px-2 py-0.5 rounded shadow-sm cursor-pointer hover:scale-105 transition-transform active:scale-95`}
                                    style={{
                                      backgroundColor: statusColor,
                                      color: '#000'
                                    }}
                                  >
                                    {status}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-80 p-4 bg-card border-2 shadow-xl animate-fade-in z-50" 
                                  side="right"
                                  align="start"
                                >
                                  <div className="space-y-3">
                                    {/* Header with Status */}
                                    <div className="flex items-center justify-between pb-2 border-b">
                                      <h3 className="font-bold text-lg">Detail Booking</h3>
                                      {getPopupAvailableStatuses(status).length > 0 ? (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={updatingPopupStatus === booking.id}
                                              className="gap-1 font-semibold h-7 px-2"
                                              style={{
                                                backgroundColor: statusColor,
                                                color: status === "CO" || status === "BATAL" ? "#fff" : "#000",
                                                borderColor: statusColor,
                                              }}
                                            >
                                              {updatingPopupStatus === booking.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <>
                                                  {status}
                                                  <ChevronDown className="h-3 w-3" />
                                                </>
                                              )}
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="bg-popover z-[100]">
                                            {getPopupAvailableStatuses(status).map((newStatus) => (
                                              <DropdownMenuItem
                                                key={newStatus}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePopupStatusChange(booking.id, newStatus, booking);
                                                }}
                                                className={newStatus === "BATAL" ? "text-destructive" : ""}
                                              >
                                                <div
                                                  className="w-3 h-3 rounded-full mr-2"
                                                  style={{ backgroundColor: statusColors[newStatus] || "#ccc" }}
                                                />
                                                {getPopupStatusLabel(newStatus)}
                                              </DropdownMenuItem>
                                            ))}
                                            {userRole === "admin" && (
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePopupStatusChange(booking.id, "BO", booking);
                                                }}
                                                className="text-muted-foreground"
                                              >
                                                <Undo className="h-3 w-3 mr-2" />
                                                Reset ke Reservasi
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      ) : (
                                        <div 
                                          className="px-3 py-1 rounded-full text-xs font-bold"
                                          style={{
                                            backgroundColor: statusColor,
                                            color: status === "CO" || status === "BATAL" ? "#fff" : "#000"
                                          }}
                                        >
                                          {status}
                                        </div>
                                      )}
                                    </div>

                                    {/* BID */}
                                    {booking.bid && (
                                      <div className="bg-muted/50 px-3 py-2 rounded">
                                        <p className="text-xs text-muted-foreground">Booking ID</p>
                                        <div className="flex items-center justify-between">
                                          <p className="font-mono font-bold text-primary">{booking.bid}</p>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigator.clipboard.writeText(booking.bid || '');
                                              toast.success("BID berhasil disalin");
                                            }}
                                            title="Salin BID"
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Customer Information */}
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <User className="w-4 h-4 mt-0.5 text-primary" />
                                        <div className="flex-1">
                                          <p className="text-xs text-muted-foreground">Nama Pelanggan</p>
                                          <p className="font-semibold">{booking.customer_name}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        <Phone className="w-4 h-4 mt-0.5 text-primary" />
                                        <div className="flex-1">
                                          <p className="text-xs text-muted-foreground">No. Telepon</p>
                                          <p className="font-medium">{booking.phone || '-'}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        <Calendar className="w-4 h-4 mt-0.5 text-primary" />
                                        <div className="flex-1">
                                          <p className="text-xs text-muted-foreground">Referensi</p>
                                          <p className="font-medium">{booking.reference_no || '-'}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Time & Duration */}
                                    <div className="pt-2 border-t space-y-2">
                                      <div className="flex items-start gap-2">
                                        <Clock className="w-4 h-4 mt-0.5 text-primary" />
                                        <div className="flex-1">
                                          <p className="text-xs text-muted-foreground">Waktu & Durasi</p>
                                          <p className="font-semibold">{booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}</p>
                                          <p className="text-sm text-muted-foreground">{booking.duration} jam</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Payment Information */}
                                    <div className="pt-2 border-t space-y-2">
                                      <div className="flex items-start gap-2">
                                        <DollarSign className="w-4 h-4 mt-0.5 text-primary" />
                                        <div className="flex-1">
                                          <p className="text-xs text-muted-foreground">Rincian Pembayaran</p>
                                          
                                          {/* Room Subtotal Section */}
                                          <div className="mt-1 space-y-1">
                                            <div className="flex justify-between items-center">
                                              <span className="text-xs font-semibold">Harga Varian:</span>
                                              <span className="font-medium">Rp {(booking.room_subtotal || 0).toLocaleString('id-ID')}</span>
                                            </div>
                                            {booking.price && (
                                              <div className="mt-2 pt-2 border-t space-y-1">
                                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                  <span>{booking.payment_method || 'Cash'}</span>
                                                  <span>Rp {booking.price.toLocaleString('id-ID')}</span>
                                                </div>
                                                {booking.dual_payment && booking.price_2 && (
                                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                    <span>{booking.payment_method_2 || 'Cash'}</span>
                                                    <span>Rp {booking.price_2.toLocaleString('id-ID')}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {/* Products Section */}
                                          {productsTotal > 0 && (
                                            <div className="mt-2 pt-2 border-t space-y-1">
                                              <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold">Produk:</span>
                                                <span className="font-medium">Rp {productsTotal.toLocaleString('id-ID')}</span>
                                              </div>
                                            </div>
                                          )}

                                          {/* Discount Section */}
                                          {discount > 0 && (
                                            <div className="mt-2 pt-2 border-t space-y-1">
                                              <div className="flex justify-between items-center text-red-600">
                                                <span className="text-xs font-semibold">
                                                  Diskon ({booking.discount_applies_to === "variant" ? "Varian" : "Produk"}):
                                                </span>
                                                <span className="font-medium">- Rp {discount.toLocaleString('id-ID')}</span>
                                              </div>
                                            </div>
                                          )}

                                          {/* Grand Total */}
                                          <div className="flex justify-between items-center mt-2 pt-2 border-t font-bold text-lg">
                                            <span>Grand Total</span>
                                            <span className="text-primary">Rp {grandTotal.toLocaleString('id-ID')}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Notes */}
                                    {booking.note && (
                                      <div className="pt-2 border-t">
                                        <div className="flex items-start gap-2">
                                          <FileText className="w-4 h-4 mt-0.5 text-primary" />
                                          <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Catatan</p>
                                            <p className="text-sm italic">{booking.note}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Admin Tracking Info */}
                                    <div className="pt-2 border-t space-y-2">
                                      <p className="text-xs font-semibold text-muted-foreground mb-2">Riwayat Admin:</p>
                                      
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Dibuat oleh:</span>
                                        <span className="font-medium text-foreground">{booking.admin_name}</span>
                                      </div>
                                      
                                      {booking.confirmed_by_name && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Dikonfirmasi (BO) oleh:</span>
                                          <span className="font-medium text-foreground">{booking.confirmed_by_name}</span>
                                        </div>
                                      )}
                                      
                                      {booking.checked_in_by_name && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Check-in (CI) oleh:</span>
                                          <span className="font-medium text-foreground">{booking.checked_in_by_name}</span>
                                        </div>
                                      )}
                                      
                                      {booking.checked_out_by_name && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Check-out (CO) oleh:</span>
                                          <span className="font-medium text-foreground">{booking.checked_out_by_name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              
                              <div className={size.spacing}>
                                <div className={`font-medium ${size.fontSize}`} style={{ color: bookingTextColor }}>
                                  {booking.customer_name}
                                  {isBlocked && (
                                    <span className={`${size.fontSize} text-muted-foreground ml-1`}>
                                      (Ruangan nonaktif)
                                    </span>
                                  )}
                                </div>
                                <div className={`${size.fontSize} ${size.spacing}`} style={{ color: bookingTextColor }}>
                                  <div>{booking.duration} jam ({booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)})</div>
                                  <div>Total: Rp {grandTotal.toLocaleString('id-ID')}</div>
                                  <div>Admin: {booking.admin_name}</div>
                                  {booking.note && (
                                    <div className="italic">Catatan: {booking.note}</div>
                                  )}
                                </div>
                                
                                {/* Edit and Delete buttons */}
                                {(hasPermission("edit_bookings") || hasPermission("delete_bookings")) && (booking.status !== 'BATAL' || userRole === 'admin') && (
                                  <div className={`flex ${size.gapSize} pt-1.5`}>
                                    {hasPermission("edit_bookings") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`${size.buttonHeight2} ${size.buttonTextSize} ${size.buttonPadding}`}
                                        onClick={() => onEditBooking(booking)}
                                      >
                                        <Edit className={`${size.buttonIconSize} mr-0.5`} />
                                        Ubah
                                      </Button>
                                    )}
                                    {hasPermission("delete_bookings") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`${size.buttonHeight2} ${size.buttonTextSize} ${size.buttonPadding} text-destructive hover:text-destructive`}
                                        onClick={() => setDeleteBookingId(booking.id)}
                                      >
                                        <Trash2 className={`${size.buttonIconSize} mr-0.5`} />
                                        Hapus
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {booking.status === 'BATAL' && userRole !== 'admin' && (
                                  <div className="text-center text-xs text-muted-foreground py-1">
                                    Booking dibatalkan
                                  </div>
                                )}
                              </div>
                            </Card>
                          </td>
                        );
                      }

                      // Don't allow new bookings in blocked rooms
                      if (isBlocked) {
                        return (
                          <td key={room.id} className={`${size.cellPadding} border-r-2 border-border`}>
                            <div className={`w-full h-full ${size.buttonHeight} flex items-center justify-center bg-muted/20 rounded ${size.fontSize} text-muted-foreground`}>
                              Tidak tersedia
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={room.id} className={`${size.cellPadding} border-r-2 border-border`}>
                          <Button
                            variant="ghost"
                            className={`w-full h-full ${size.buttonHeight} hover:bg-accent transition-[var(--transition-smooth)] ${size.fontSize}`}
                            onClick={() => onAddBooking(room.id, time)}
                          >
                            <Plus className={`${size.iconSize} mr-0.5`} />
                            Tambah
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus booking ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBooking}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Housekeeping Confirmation Dialog */}
      <AlertDialog open={!!confirmReadyRoom} onOpenChange={() => setConfirmReadyRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Housekeeping</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin kamar <strong>{confirmReadyRoom?.roomName}</strong> sudah selesai di-housekeeping dan siap digunakan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tidak</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReady} className="bg-green-600 hover:bg-green-700">
              Ya, Sudah Ready
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Check-In Deposit Popup */}
      {checkInDepositPopup.bookingData && (
        <CheckInDepositPopup
          open={checkInDepositPopup.open}
          onClose={() => setCheckInDepositPopup({ open: false, bookingId: "", bookingData: null, onConfirmCallback: null })}
          onConfirm={async () => {
            if (checkInDepositPopup.onConfirmCallback) {
              await checkInDepositPopup.onConfirmCallback();
            }
          }}
          bookingData={{
            id: checkInDepositPopup.bookingData.id,
            room_id: checkInDepositPopup.bookingData.room_id,
            room_name: (checkInDepositPopup.bookingData as any).room_name,
            customer_name: checkInDepositPopup.bookingData.customer_name,
            store_id: currentStore?.id || "",
          }}
        />
      )}
    </>
  );
}
