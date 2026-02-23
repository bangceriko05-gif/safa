import { useEffect, useState, useMemo } from "react";
import BookingPopoverContent from "@/components/BookingPopoverContent";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, User, Phone, ChevronLeft, ChevronRight, Copy, Calendar as CalendarIcon, ChevronDown, XCircle, Undo, Loader2, Shield, Search, X } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CheckInDepositPopup from "@/components/deposit/CheckInDepositPopup";
import CheckOutDepositPopup from "@/components/deposit/CheckOutDepositPopup";
import DepositDetailPopup from "@/components/deposit/DepositDetailPopup";

interface PMSCalendarProps {
  selectedDate: Date;
  userRole: string | null;
  onAddBooking: (roomId: string, date: string) => void;
  onEditBooking: (booking: any) => void;
  onDateChange: (date: Date) => void;
  depositMode?: boolean;
  onDepositModeChange?: (mode: boolean) => void;
  onDepositRoomSelect?: (roomId: string) => void;
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
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  note?: string;
  created_by?: string;
  status?: string;
  bid?: string;
  check_in_date?: string;
  check_out_date?: string;
}

interface BookingWithAdmin extends Booking {
  admin_name?: string;
  nights?: number;
}

export default function PMSCalendar({
  selectedDate,
  userRole,
  onAddBooking,
  onEditBooking,
  onDateChange,
  depositMode = false,
  onDepositModeChange,
  onDepositRoomSelect,
}: PMSCalendarProps) {
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
  const [readyUsedColor, setReadyUsedColor] = useState<string>(() => {
    return localStorage.getItem("ready-used-color") || "#10B981";
  });
  // Date-specific room status (from room_daily_status table)
  const [roomDailyStatus, setRoomDailyStatus] = useState<Record<string, string>>({});
  const [roomDailyStatusData, setRoomDailyStatusData] = useState<Record<string, { status: string; updated_by_name?: string }>>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  // Room deposits - map roomId -> true if has active deposit
  const [roomDeposits, setRoomDeposits] = useState<Set<string>>(new Set());
  const [confirmReadyRoom, setConfirmReadyRoom] = useState<{ roomId: string; roomName: string; date: Date } | null>(null);
  
  // Check-in deposit popup state
  const [checkInDepositPopup, setCheckInDepositPopup] = useState<{
    open: boolean;
    bookingId: string;
    bookingData: BookingWithAdmin | null;
    onConfirmCallback: (() => Promise<void>) | null;
  }>({ open: false, bookingId: "", bookingData: null, onConfirmCallback: null });

  // Check-out deposit popup state
  const [checkOutDepositPopup, setCheckOutDepositPopup] = useState<{
    open: boolean;
    bookingId: string;
    bookingData: BookingWithAdmin | null;
    onConfirmCallback: (() => Promise<void>) | null;
  }>({ open: false, bookingId: "", bookingData: null, onConfirmCallback: null });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookingWithAdmin[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Deposit detail popup state
  const [depositDetailPopup, setDepositDetailPopup] = useState<{
    open: boolean;
    roomId: string | null;
    roomName: string;
  }>({ open: false, roomId: null, roomName: "" });

  // Calculate visible date range (14 days centered on selected date)
  const visibleDates = useMemo(() => {
    const start = addDays(selectedDate, -3);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const monthYear = format(selectedDate, "MMMM yyyy", { locale: idLocale });

  useEffect(() => {
    if (!currentStore) return;
    fetchRooms();
    fetchUserPermissions();
    fetchStatusColors();
    fetchRoomDeposits();

    // Listen for ready-used color changes
    const handleReadyUsedColorChange = () => {
      setReadyUsedColor(localStorage.getItem("ready-used-color") || "#10B981");
    };
    window.addEventListener("ready-used-color-changed", handleReadyUsedColorChange);

    // Realtime subscription for rooms
    const roomsChannel = supabase
      .channel(`pms-rooms-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    // Realtime subscription for deposits
    const depositsChannel = supabase
      .channel(`pms-deposits-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_deposits',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          fetchRoomDeposits();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("ready-used-color-changed", handleReadyUsedColorChange);
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(depositsChannel);
    };
  }, [currentStore]);

  // Fetch room daily status when visible dates change
  useEffect(() => {
    if (!currentStore) return;
    fetchRoomDailyStatus();

    // Realtime subscription for room_daily_status
    const dailyStatusChannel = supabase
      .channel(`pms-daily-status-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_daily_status',
        },
        () => {
          fetchRoomDailyStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dailyStatusChannel);
    };
  }, [currentStore, visibleDates]);

  useEffect(() => {
    if (!currentStore) return;
    setIsLoading(true);
    fetchBookings().finally(() => setIsLoading(false));

    // Realtime subscription
    let debounceTimer: NodeJS.Timeout;
    
    const channel = supabase
      .channel(`pms-bookings-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchBookings();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedDate, currentStore]);

  const fetchStatusColors = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("status_colors")
        .select("*")
        .eq("store_id", currentStore.id);

      if (error) throw error;

      if (data && data.length > 0) {
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

  const fetchRooms = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      
      const uniqueRooms = data ? data.filter((room, index, self) => 
        index === self.findIndex((r) => r.id === room.id)
      ) : [];
      
      setRooms(uniqueRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchRoomDeposits = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("room_deposits")
        .select("room_id")
        .eq("store_id", currentStore.id)
        .eq("status", "active");

      if (error) throw error;

      const depositSet = new Set(data?.map(d => d.room_id) || []);
      setRoomDeposits(depositSet);
    } catch (error) {
      console.error("Error fetching room deposits:", error);
    }
  };

  const fetchRoomDailyStatus = async () => {
    try {
      if (!currentStore) return;

      const startDate = format(visibleDates[0], "yyyy-MM-dd");
      const endDate = format(visibleDates[visibleDates.length - 1], "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("room_daily_status")
        .select("room_id, date, status, updated_by")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;

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

      // Create a map: "roomId-date" -> status
      const statusMap: Record<string, string> = {};
      const dataMap: Record<string, { status: string; updated_by_name?: string }> = {};
      data?.forEach((item) => {
        const key = `${item.room_id}-${item.date}`;
        statusMap[key] = item.status;
        dataMap[key] = {
          status: item.status,
          updated_by_name: item.updated_by ? userNames[item.updated_by] : undefined,
        };
      });
      setRoomDailyStatus(statusMap);
      setRoomDailyStatusData(dataMap);
    } catch (error) {
      console.error("Error fetching room daily status:", error);
    }
  };

  // Helper to get room status data for a specific date
  const getRoomStatusDataForDate = (roomId: string, date: Date): { status: string; updated_by_name?: string } | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return roomDailyStatusData[`${roomId}-${dateStr}`] || null;
  };

  // Helper to get room status for a specific date
  const getRoomStatusForDate = (roomId: string, date: Date): string | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return roomDailyStatus[`${roomId}-${dateStr}`] || null;
  };

  const fetchBookings = async () => {
    try {
      if (!currentStore) return;

      // Fetch bookings for the visible date range
      const startDate = format(visibleDates[0], "yyyy-MM-dd");
      const endDate = format(visibleDates[visibleDates.length - 1], "yyyy-MM-dd");

      // Calculate earliest possible start date for multi-night bookings
      // A booking starting 60 days before could still span into our view
      const earliestStartDate = format(addDays(visibleDates[0], -60), "yyyy-MM-dd");

      // Fetch bookings that:
      // 1. Start within the visible range, OR
      // 2. Start before the range but could span into it (multi-night bookings)
      // Exclude CO (checked-out) and BATAL bookings from calendar display
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*, bid")
        .eq("store_id", currentStore.id)
        .gte("date", earliestStartDate)
        .lte("date", endDate)
        .not("status", "in", "(CO,BATAL)");

      if (error) throw error;
      
      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // Filter to only include bookings that actually overlap with visible dates
      const visibleStartDate = startOfDay(visibleDates[0]);
      const visibleEndDate = startOfDay(visibleDates[visibleDates.length - 1]);
      
      const relevantBookings = bookingsData.filter(booking => {
        const bookingStart = startOfDay(new Date(booking.date));
        const nights = booking.duration || 1;
        const bookingEnd = addDays(bookingStart, nights - 1);
        
        // Booking overlaps with visible range if:
        // booking ends on or after visible start AND booking starts on or before visible end
        return bookingEnd >= visibleStartDate && bookingStart <= visibleEndDate;
      });

      if (relevantBookings.length === 0) {
        setBookings([]);
        return;
      }

      // Fetch admin names
      const allUserIds = [...new Set(relevantBookings.map(b => b.created_by).filter(Boolean))] as string[];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", allUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));

      const bookingsWithAdmin: BookingWithAdmin[] = relevantBookings.map(booking => ({
        ...booking,
        admin_name: profileMap.get(booking.created_by || "") || "Unknown",
        nights: booking.duration || 1,
      }));
      
      setBookings(bookingsWithAdmin);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const handleDeleteBooking = async () => {
    if (!deleteBookingId) return;

    try {
      const { data: bookingToDelete } = await supabase
        .from("bookings")
        .select(`customer_name, date, rooms (name)`)
        .eq("id", deleteBookingId)
        .single();

      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", deleteBookingId);

      if (error) throw error;

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

  const handleRoomStatusChange = async (roomId: string, newStatus: string, date: Date, skipConfirmation = false) => {
    // If changing to Ready/Aktif and not skipping confirmation, show dialog
    if (newStatus === 'Aktif' && !skipConfirmation) {
      const room = rooms.find(r => r.id === roomId);
      setConfirmReadyRoom({ roomId, roomName: room?.name || "Unknown", date });
      return;
    }
    
    try {
      const room = rooms.find(r => r.id === roomId);
      const dateStr = format(date, "yyyy-MM-dd");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (newStatus === 'Aktif') {
        // Instead of deleting, update with status Aktif to track who set it ready
        const { error } = await supabase
          .from("room_daily_status")
          .upsert({
            room_id: roomId,
            date: dateStr,
            status: "Aktif",
            updated_by: user?.id,
          }, { onConflict: 'room_id,date' });

        if (error) throw error;
      } else {
        // Insert or update the daily status
        const { error } = await supabase
          .from("room_daily_status")
          .upsert({
            room_id: roomId,
            date: dateStr,
            status: newStatus,
            updated_by: user?.id,
          }, { onConflict: 'room_id,date' });

        if (error) throw error;
      }

      await logActivity({
        actionType: 'updated',
        entityType: 'Room',
        entityId: roomId,
        description: `Mengubah status kamar ${room?.name || 'Unknown'} tanggal ${dateStr} menjadi ${newStatus === 'Aktif' ? 'Ready' : newStatus}`,
      });

      toast.success(`Kamar ${room?.name} tanggal ${format(date, "dd MMM", { locale: idLocale })} sudah ${newStatus === 'Aktif' ? 'Ready' : newStatus}`);
      fetchRoomDailyStatus();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal mengubah status kamar");
      console.error(error);
    }
  };

  const handleConfirmReady = async () => {
    if (!confirmReadyRoom) return;
    await handleRoomStatusChange(confirmReadyRoom.roomId, "Aktif", confirmReadyRoom.date, true);
    setConfirmReadyRoom(null);
  };

  const handleBookingStatusChange = async (bookingId: string, newStatus: string, bookingData: BookingWithAdmin) => {
    // If changing to Check In, show deposit popup only if no active deposit exists
    if (newStatus === "CI") {
      const hasActiveDeposit = roomDeposits.has(bookingData.room_id);
      
      // Skip deposit popup if room already has active deposit
      if (!hasActiveDeposit) {
        const room = rooms.find(r => r.id === bookingData.room_id);
        
        setCheckInDepositPopup({
          open: true,
          bookingId,
          bookingData: {
            ...bookingData,
            room_name: room?.name,
          } as any,
          onConfirmCallback: async () => {
            await executeBookingStatusChange(bookingId, newStatus, bookingData);
          },
        });
        return;
      }
    }
    
    // If changing to Check Out, check for active deposits first
    if (newStatus === "CO") {
      const room = rooms.find(r => r.id === bookingData.room_id);
      const hasActiveDeposit = roomDeposits.has(bookingData.room_id);
      
      if (hasActiveDeposit) {
        setCheckOutDepositPopup({
          open: true,
          bookingId,
          bookingData: {
            ...bookingData,
            room_name: room?.name,
          } as any,
          onConfirmCallback: async () => {
            await executeBookingStatusChange(bookingId, newStatus, bookingData);
          },
        });
        return;
      }
    }
    
    await executeBookingStatusChange(bookingId, newStatus, bookingData);
  };

  const executeBookingStatusChange = async (bookingId: string, newStatus: string, bookingData: BookingWithAdmin) => {
    setUpdatingStatus(bookingId);
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
      } else if (newStatus === "BO") {
        updateData.confirmed_by = user.id;
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === "BATAL" && bookingData.room_id) {
        // BATAL: Set room to ready (Aktif) directly, not Kotor
        await supabase
          .from("room_daily_status")
          .upsert({
            room_id: bookingData.room_id,
            date: bookingData.date,
            status: "Aktif",
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "room_id,date" });
        fetchRoomDailyStatus();
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

      // Update room_daily_status for CO status - use TODAY as the checkout date
      if (newStatus === "CO" && bookingData.room_id) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        await supabase
          .from("room_daily_status")
          .upsert({
            room_id: bookingData.room_id,
            date: todayStr,
            status: "Kotor",
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "room_id,date" });
        fetchRoomDailyStatus();
      }

      toast.success(`Status berhasil diubah ke ${statusLabels[newStatus] || newStatus}`);
      fetchBookings();
      fetchRoomDeposits(); // Refresh deposits after check-in
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Gagal mengubah status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getAvailableStatuses = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      BO: ["CI", "BATAL"],
      CI: ["CO", "BATAL"],
      CO: [],
      BATAL: [],
    };
    return transitions[currentStatus] || [];
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "BO": return "Reservasi";
      case "CI": return "Check In";
      case "CO": return "Check Out";
      case "BATAL": return "BATAL";
      default: return status;
    }
  };

  // Get booking for a specific room and date
  const getBookingForCell = (roomId: string, date: Date): BookingWithAdmin | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.find(b => b.room_id === roomId && b.date === dateStr) || null;
  };

  // Check if date is the start of a multi-night booking
  const isBookingStart = (roomId: string, date: Date): BookingWithAdmin | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.find(b => b.room_id === roomId && b.date === dateStr) || null;
  };

  // Check if date is occupied by an ongoing booking (not the start date)
  const isDateOccupied = (roomId: string, date: Date): boolean => {
    const dateToCheck = startOfDay(date);
    
    return bookings.some(b => {
      if (b.room_id !== roomId) return false;
      
      const bookingStart = startOfDay(new Date(b.date));
      const nights = b.duration || 1;
      const bookingEnd = addDays(bookingStart, nights - 1);
      
      // Check if date is after start but within the booking period
      return dateToCheck > bookingStart && dateToCheck <= bookingEnd;
    });
  };

  // Get booking that covers this date (for multi-night stays)
  const getOccupyingBooking = (roomId: string, date: Date): BookingWithAdmin | null => {
    const dateToCheck = startOfDay(date);
    
    return bookings.find(b => {
      if (b.room_id !== roomId) return false;
      
      const bookingStart = startOfDay(new Date(b.date));
      const nights = b.duration || 1;
      const bookingEnd = addDays(bookingStart, nights - 1);
      
      return dateToCheck >= bookingStart && dateToCheck <= bookingEnd;
    }) || null;
  };

  // Filter rooms
  const displayRooms = (userRole === "admin" || userRole === "leader")
    ? rooms
    : rooms.filter((room) => room.status === "Aktif");

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isSelected = (date: Date) => isSameDay(date, selectedDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(selectedDate);

  const handleYesterday = () => {
    onDateChange(subDays(new Date(), 1));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleTomorrow = () => {
    onDateChange(addDays(new Date(), 1));
  };

  const handlePrevWeek = () => {
    onDateChange(addDays(selectedDate, -7));
  };

  const handleNextWeek = () => {
    onDateChange(addDays(selectedDate, 7));
  };

  const handleDateClick = (date: Date) => {
    onDateChange(date);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setTempDate(date);
    }
  };
  
  // Search functionality - search across all bookings without date limit
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentStore) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      const searchTerm = searchQuery.trim().toLowerCase();
      
      // Search bookings by BID, customer_name, or phone - no date restriction
      const { data: searchData, error } = await supabase
        .from("bookings")
        .select("*, bid, rooms (name)")
        .eq("store_id", currentStore.id)
        .or(`bid.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order("date", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Fetch admin names
      const userIds = [...new Set((searchData || []).map(b => b.created_by).filter(Boolean))] as string[];
      let profileMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        
        profileMap = new Map((profiles || []).map(p => [p.id, p.name]));
      }
      
      const resultsWithAdmin: BookingWithAdmin[] = (searchData || []).map(booking => ({
        ...booking,
        admin_name: profileMap.get(booking.created_by || "") || "Unknown",
        nights: booking.duration || 1,
      }));
      
      setSearchResults(resultsWithAdmin);
    } catch (error) {
      console.error("Error searching bookings:", error);
      toast.error("Gagal mencari booking");
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };
  
  const handleSearchResultClick = (booking: BookingWithAdmin) => {
    // Navigate to the booking date and close search
    const bookingDate = new Date(booking.date);
    onDateChange(bookingDate);
    setShowSearchResults(false);
    
    // Optionally show booking details via edit
    onEditBooking(booking);
  };

  const handleCalendarConfirm = () => {
    onDateChange(tempDate);
    setCalendarOpen(false);
  };

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
        <div className="bg-card rounded-xl shadow-[var(--shadow-card)] overflow-hidden border-2 border-border max-h-[calc(100vh-200px)] flex flex-col">
          {/* Date Navigation Bar with Search - Sticky */}
          <div className="flex flex-col gap-2 p-3 md:p-4 border-b-2 border-border bg-muted/50 sticky top-0 z-30">
            {/* Row 1: Search and Date Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search Input - Compact */}
              <div className="relative flex-1 sm:max-w-[240px] md:max-w-[280px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari BID, nama, HP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="h-8 pl-8 pr-16 text-sm"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleClearSearch}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Date Navigation - Compact */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <div className="flex items-center bg-background rounded-md border border-border overflow-hidden">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleYesterday}
                    className="rounded-none border-r border-border h-8 px-2 md:px-3 text-xs hover:bg-muted"
                  >
                    <ChevronLeft className="h-3 w-3 md:mr-1" />
                    <span className="hidden md:inline">Kemarin</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleToday}
                    className={cn(
                      "rounded-none border-r border-border h-8 px-2 md:px-3 text-xs hover:bg-muted",
                      isSameDay(selectedDate, new Date()) && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    Hari Ini
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleTomorrow}
                    className="rounded-none h-8 px-2 md:px-3 text-xs hover:bg-muted"
                  >
                    <span className="hidden md:inline">Besok</span>
                    <ChevronRight className="h-3 w-3 md:ml-1" />
                  </Button>
                </div>

                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 gap-1.5 px-2 md:px-3 text-xs"
                      onClick={() => setTempDate(selectedDate)}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="hidden xs:inline">{format(selectedDate, "d MMM yyyy", { locale: idLocale })}</span>
                      <span className="xs:hidden">{format(selectedDate, "d/M", { locale: idLocale })}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <div className="p-3 space-y-3">
                      <Calendar
                        mode="single"
                        selected={tempDate}
                        onSelect={handleCalendarSelect}
                        initialFocus
                        locale={idLocale}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setCalendarOpen(false)}
                        >
                          Batal
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleCalendarConfirm}
                        >
                          OK
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* Search Results - Below navigation */}
            {showSearchResults && (
              <div className="bg-background rounded-lg border border-border max-h-48 md:max-h-64 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    <span className="text-xs">Mencari...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground text-xs">
                    Tidak ada hasil untuk "{searchQuery}"
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <div className="px-2 py-1.5 bg-muted/50 text-[10px] text-muted-foreground font-medium">
                      {searchResults.length} hasil
                    </div>
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSearchResultClick(result)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs truncate">{result.customer_name}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-primary">{result.bid}</span>
                              {result.phone && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <Phone className="h-2.5 w-2.5" />
                                    {result.phone}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-muted-foreground">
                              {format(new Date(result.date), "dd/MM/yy", { locale: idLocale })}
                            </div>
                            <div
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5"
                              style={{
                                backgroundColor: statusColors[result.status || 'BO'] || '#3B82F6',
                                color: result.status === 'CO' || result.status === 'BATAL' ? '#fff' : '#000',
                              }}
                            >
                              {result.status || 'BO'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full border-collapse min-w-max">
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-border bg-muted">
                  <th className="p-3 text-left font-semibold text-sm sticky left-0 bg-muted z-30 border-r-2 border-border min-w-[150px]">
                    Kamar
                  </th>
                  {visibleDates.map((date) => {
                    const dayName = format(date, "EEE", { locale: idLocale });
                    const dayNum = format(date, "d");
                    const today = isToday(date);
                    const selected = isSelected(date);
                    
                    return (
                      <th 
                        key={date.toISOString()} 
                        className={cn(
                          "p-2 text-center font-medium text-xs min-w-[80px] border-r border-border cursor-pointer transition-colors hover:bg-primary/10 bg-muted",
                          today && "bg-primary/20",
                          selected && "ring-2 ring-primary ring-inset"
                        )}
                        onClick={() => handleDateClick(date)}
                      >
                        <div className={`text-xs uppercase ${today ? "text-primary font-bold" : "text-muted-foreground"}`}>
                          {dayName}
                        </div>
                        <div className={`text-lg ${today ? "text-primary font-bold" : ""}`}>
                          {dayNum}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
              {displayRooms.map((room) => {
                  const isBlocked = room.status !== "Aktif";
                  const hasDeposit = roomDeposits.has(room.id);
                  const canSelectForDeposit = depositMode && !hasDeposit && !isBlocked;
                  
                  return (
                    <tr 
                      key={room.id} 
                      className={cn(
                        "border-b border-border hover:bg-muted/20 transition-colors",
                        depositMode && canSelectForDeposit && "cursor-pointer hover:bg-amber-50",
                        depositMode && hasDeposit && "bg-amber-50/50"
                      )}
                      onClick={canSelectForDeposit ? () => onDepositRoomSelect?.(room.id) : undefined}
                    >
                      <td className={cn(
                        "p-3 text-sm font-medium sticky left-0 bg-card border-r-2 border-border z-10",
                        isBlocked && "opacity-50",
                        depositMode && canSelectForDeposit && "bg-amber-50/50",
                        depositMode && hasDeposit && "bg-amber-100/50"
                      )}>
                          <div className="flex items-center gap-2">
                            {depositMode && (
                              <div className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                hasDeposit ? "bg-amber-500 border-amber-500" : "border-muted-foreground/30"
                              )}>
                                {hasDeposit && <Shield className="w-3 h-3 text-white" />}
                              </div>
                            )}
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: isBlocked ? "#9CA3AF" : "#3B82F6" }}
                            />
                            {room.name}
                            {!depositMode && hasDeposit && (
                              <div 
                                className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 border border-amber-300 cursor-pointer hover:bg-amber-200 transition-colors" 
                                title="Klik untuk lihat deposit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDepositDetailPopup({ open: true, roomId: room.id, roomName: room.name });
                                }}
                              >
                                <Shield className="w-3 h-3 text-amber-600" />
                              </div>
                            )}
                            {depositMode && hasDeposit && (
                              <span className="text-xs text-amber-600 font-medium">Sudah ada deposit</span>
                            )}
                            {depositMode && canSelectForDeposit && (
                              <span className="text-xs text-muted-foreground">Klik untuk pilih</span>
                            )}
                            {isBlocked && <span className="text-xs text-muted-foreground">({room.status})</span>}
                          </div>
                        </td>
                        {visibleDates.map((date, dateIndex) => {
                          const bookingStart = isBookingStart(room.id, date);
                          const isOccupied = isDateOccupied(room.id, date);
                          const dateStr = format(date, "yyyy-MM-dd");
                          const occupyingBooking = getOccupyingBooking(room.id, date);
                          
                          // Check if booking started before visible range and this is the first visible date of that booking
                          const isFirstVisibleDateOfOngoingBooking = dateIndex === 0 && isOccupied && occupyingBooking;
                          
                          // If this date is occupied by an ongoing booking and NOT the first visible date, skip rendering
                          if (isOccupied && !isFirstVisibleDateOfOngoingBooking) {
                            return null;
                          }
                          
                          // Determine which booking to show (either starts here or continues from before)
                          const booking = bookingStart || (isFirstVisibleDateOfOngoingBooking ? occupyingBooking : null);
                          
                          if (booking) {
                            const status = booking.status || 'BO';
                            const statusColor = statusColors[status] || '#3B82F6';
                            const isBatal = status === 'BATAL';
                            const bgColor = isBatal ? `${statusColor}40` : `${statusColor}80`;
                            const nights = booking.duration || 1;
                            
                            // Check if room has active deposit
                            const hasActiveDeposit = roomDeposits.has(room.id);
                            
                            // Calculate colSpan: how many visible dates this booking covers
                            const bookingStartDate = startOfDay(new Date(booking.date));
                            const bookingEndDate = addDays(bookingStartDate, nights - 1);
                            const visibleStartIndex = bookingStart ? dateIndex : 0;
                            let colspan = 0;
                            for (let i = visibleStartIndex; i < visibleDates.length; i++) {
                              const checkDate = startOfDay(visibleDates[i]);
                              if (checkDate <= bookingEndDate) {
                                colspan++;
                              } else {
                                break;
                              }
                            }
                            
                            return (
                              <td 
                                key={date.toISOString()} 
                                className={cn(
                                  "p-1 align-top border-r border-border",
                                  isBatal && "opacity-60"
                                )}
                                colSpan={colspan}
                              >
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Card
                                      className="p-2 h-full cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg relative min-h-[60px]"
                                      style={{
                                        backgroundColor: bgColor,
                                        borderLeft: `4px solid ${statusColor}`,
                                      }}
                                    >
                                      {/* Deposit Badge on booking cell */}
                                      {hasActiveDeposit && (
                                        <div 
                                          className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 border border-amber-300 shadow-sm cursor-pointer hover:bg-amber-200 transition-colors z-10" 
                                          title="Klik untuk lihat deposit"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setDepositDetailPopup({ open: true, roomId: room.id, roomName: room.name });
                                          }}
                                        >
                                          <Shield className="w-3 h-3 text-amber-600" />
                                        </div>
                                      )}
                                      <div className="absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: statusColor, color: '#000' }}>
                                        {status}
                                      </div>
                                      <div className={cn("text-xs font-semibold truncate pr-8", hasActiveDeposit && "pl-6")}>{booking.customer_name}</div>
                                      <div className="text-[11px] font-medium truncate">
                                        {nights} malam {' '}
                                        <span className={cn(
                                          "font-bold",
                                          (booking as any).payment_status === "lunas" 
                                            ? "text-emerald-700" 
                                            : "text-red-600"
                                        )}>
                                          ({(booking as any).payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS"})
                                        </span>
                                      </div>
                                      {booking.phone && (
                                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                          <Phone className="w-2 h-2" />
                                          {booking.phone}
                                        </div>
                                      )}
                                    </Card>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-4 bg-card border-2 shadow-xl z-50" side="right" align="start">
                                    <BookingPopoverContent
                                      booking={booking}
                                      nights={nights}
                                      status={status}
                                      statusColor={statusColor}
                                      statusColors={statusColors}
                                      updatingStatus={updatingStatus}
                                      userRole={userRole}
                                      hasPermission={hasPermission}
                                      getStatusLabel={getStatusLabel}
                                      getAvailableStatuses={getAvailableStatuses}
                                      onStatusChange={handleBookingStatusChange}
                                      onEditBooking={onEditBooking}
                                      onDeleteBooking={setDeleteBookingId}
                                      addDays={addDays}
                                    />
                                  </PopoverContent>
                                </Popover>
                              </td>
                            );
                          }

                          // Empty cell - show based on date-specific room status
                          const dailyStatus = getRoomStatusForDate(room.id, date);
                          const dailyStatusData = getRoomStatusDataForDate(room.id, date);
                          const isKotor = dailyStatus === "Kotor";
                          const isReady = dailyStatus === "Aktif";
                          
                          return (
                            <td 
                              key={date.toISOString()} 
                              className={`p-1 align-top border-r border-border ${isBlocked && !isKotor ? "bg-muted/30" : ""}`}
                            >
                              {isKotor ? (
                                // Room is dirty on this date - show "Kotor" with option to set Ready
                                <Button
                                  variant="ghost"
                                  className="w-full h-full min-h-[60px] bg-destructive/10 hover:bg-primary/10 border border-destructive/30 hover:border-primary/40 transition-all group"
                                  onClick={() => handleRoomStatusChange(room.id, "Aktif", date)}
                                  title="Klik untuk set Ready"
                                >
                                  <span className="text-destructive font-semibold text-xs group-hover:hidden">Kotor</span>
                                  <span className="text-primary font-semibold text-xs hidden group-hover:inline">Set Ready</span>
                                </Button>
                              ) : !isBlocked && hasPermission("create_bookings") ? (
                                // Room is available - show "Ready" button to add booking
                                <Button
                                  variant="ghost"
                                  className={cn(
                                    "w-full h-full min-h-[60px] border transition-all flex flex-col items-center justify-center gap-0.5",
                                    !(isReady && dailyStatusData?.updated_by_name) && "bg-primary/5 hover:bg-primary/10 border-dashed border-primary/30 hover:border-primary"
                                  )}
                                  style={isReady && dailyStatusData?.updated_by_name ? {
                                    backgroundColor: `${readyUsedColor}15`,
                                    borderColor: `${readyUsedColor}60`,
                                    borderStyle: 'solid',
                                  } : undefined}
                                  onClick={() => onAddBooking(room.id, dateStr)}
                                  title={isReady && dailyStatusData?.updated_by_name ? `Direadykan oleh: ${dailyStatusData.updated_by_name}` : undefined}
                                >
                                  <span 
                                    className={cn(
                                      "font-semibold text-xs",
                                      !(isReady && dailyStatusData?.updated_by_name) && "text-primary"
                                    )}
                                    style={isReady && dailyStatusData?.updated_by_name ? { color: readyUsedColor } : undefined}
                                  >Ready</span>
                                  {isReady && dailyStatusData?.updated_by_name && (
                                    <span 
                                      className="text-[9px] truncate max-w-full px-1"
                                      style={{ color: `${readyUsedColor}BB` }}
                                    >
                                      {dailyStatusData.updated_by_name}
                                    </span>
                                  )}
                                </Button>
                              ) : (
                                <div className="w-full h-full min-h-[60px] flex items-center justify-center text-xs text-muted-foreground">
                                  {isBlocked ? room.status : "-"}
                                </div>
                              )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus booking ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
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

      {/* Check-Out Deposit Popup */}
      {checkOutDepositPopup.bookingData && (
        <CheckOutDepositPopup
          open={checkOutDepositPopup.open}
          onClose={() => setCheckOutDepositPopup({ open: false, bookingId: "", bookingData: null, onConfirmCallback: null })}
          onConfirm={async () => {
            if (checkOutDepositPopup.onConfirmCallback) {
              await checkOutDepositPopup.onConfirmCallback();
            }
          }}
          bookingData={{
            id: checkOutDepositPopup.bookingData.id,
            room_id: checkOutDepositPopup.bookingData.room_id,
            room_name: (checkOutDepositPopup.bookingData as any).room_name,
            customer_name: checkOutDepositPopup.bookingData.customer_name,
            store_id: currentStore?.id || "",
          }}
        />
      )}

      {/* Deposit Detail Popup */}
      <DepositDetailPopup
        open={depositDetailPopup.open}
        roomId={depositDetailPopup.roomId}
        roomName={depositDetailPopup.roomName}
        onClose={() => setDepositDetailPopup({ open: false, roomId: null, roomName: "" })}
        onSuccess={() => fetchRoomDeposits()}
      />
    </>
  );
}
