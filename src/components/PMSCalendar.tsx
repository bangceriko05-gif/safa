import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit, Trash2, User, Phone, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays, startOfDay } from "date-fns";
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

interface PMSCalendarProps {
  selectedDate: Date;
  userRole: string | null;
  onAddBooking: (roomId: string, date: string) => void;
  onEditBooking: (booking: any) => void;
  onDateChange: (date: Date) => void;
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
  });

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
  }, [currentStore]);

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

  const fetchBookings = async () => {
    try {
      if (!currentStore) return;

      // Fetch bookings for the visible date range
      const startDate = format(visibleDates[0], "yyyy-MM-dd");
      const endDate = format(visibleDates[visibleDates.length - 1], "yyyy-MM-dd");

      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*, bid")
        .eq("store_id", currentStore.id)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;
      
      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // Fetch admin names
      const allUserIds = [...new Set(bookingsData.map(b => b.created_by).filter(Boolean))] as string[];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", allUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));

      const bookingsWithAdmin: BookingWithAdmin[] = bookingsData.map(booking => ({
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

  const handlePrevWeek = () => {
    onDateChange(addDays(selectedDate, -7));
  };

  const handleNextWeek = () => {
    onDateChange(addDays(selectedDate, 7));
  };

  const handleDateClick = (date: Date) => {
    onDateChange(date);
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
        <div className="bg-card rounded-xl shadow-[var(--shadow-card)] overflow-hidden border-2 border-border">
          {/* Header with navigation */}
          <div className="flex items-center justify-between p-4 border-b-2 border-border bg-muted/50">
            <Button variant="outline" size="sm" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
              Minggu Sebelumnya
            </Button>
            <h2 className="text-lg font-semibold capitalize">{monthYear}</h2>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
              Minggu Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="w-full">
            <div className="min-w-max">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/30">
                    <th className="p-3 text-left font-semibold text-sm sticky left-0 bg-muted/30 z-20 border-r-2 border-border min-w-[150px]">
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
                          className={`p-2 text-center font-medium text-xs min-w-[80px] border-r border-border cursor-pointer transition-colors hover:bg-primary/10 ${
                            today ? "bg-primary/20" : ""
                          } ${selected ? "ring-2 ring-primary ring-inset" : ""}`}
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
                    
                    return (
                      <tr key={room.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className={`p-3 text-sm font-medium sticky left-0 bg-card border-r-2 border-border z-10 ${isBlocked ? "opacity-50" : ""}`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: isBlocked ? "#9CA3AF" : "#3B82F6" }}
                            />
                            {room.name}
                            {isBlocked && <span className="text-xs text-muted-foreground">({room.status})</span>}
                          </div>
                        </td>
                        {visibleDates.map((date) => {
                          const booking = isBookingStart(room.id, date);
                          const isOccupied = isDateOccupied(room.id, date);
                          const dateStr = format(date, "yyyy-MM-dd");
                          
                          // If this date is occupied by an ongoing booking, don't render a cell
                          if (isOccupied) {
                            return null;
                          }
                          
                          if (booking) {
                            const status = booking.status || 'BO';
                            const statusColor = statusColors[status] || '#3B82F6';
                            const bgColor = `${statusColor}80`;
                            const nights = booking.duration || 1;
                            
                            return (
                              <td 
                                key={date.toISOString()} 
                                className="p-1 align-top border-r border-border"
                                colSpan={Math.min(nights, visibleDates.length - visibleDates.findIndex(d => isSameDay(d, date)))}
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
                                      <div className="absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: statusColor, color: '#000' }}>
                                        {status}
                                      </div>
                                      <div className="text-xs font-semibold truncate pr-8">{booking.customer_name}</div>
                                      <div className="text-[10px] text-muted-foreground truncate">
                                        {nights} malam
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
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between pb-2 border-b">
                                        <h3 className="font-bold text-lg">Detail Booking</h3>
                                        <div 
                                          className="px-3 py-1 rounded-full text-xs font-bold"
                                          style={{ backgroundColor: statusColor, color: '#000' }}
                                        >
                                          {status}
                                        </div>
                                      </div>

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
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                      <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                          <User className="w-4 h-4 mt-0.5 text-primary" />
                                          <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Nama Tamu</p>
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

                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-xs text-muted-foreground">Check-in</p>
                                            <p className="font-medium text-sm">{format(new Date(booking.date), "dd MMM yyyy", { locale: idLocale })}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Check-out</p>
                                            <p className="font-medium text-sm">{format(addDays(new Date(booking.date), nights), "dd MMM yyyy", { locale: idLocale })}</p>
                                          </div>
                                        </div>

                                        <div>
                                          <p className="text-xs text-muted-foreground">Durasi</p>
                                          <p className="font-medium">{nights} malam</p>
                                        </div>

                                        {booking.note && (
                                          <div>
                                            <p className="text-xs text-muted-foreground">Catatan</p>
                                            <p className="font-medium text-sm">{booking.note}</p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex gap-2 pt-2 border-t">
                                        {hasPermission("edit_bookings") && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => onEditBooking(booking)}
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                        )}
                                        {hasPermission("delete_bookings") && (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={() => setDeleteBookingId(booking.id)}
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Hapus
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </td>
                            );
                          }

                          // Empty cell - can add booking
                          return (
                            <td 
                              key={date.toISOString()} 
                              className={`p-1 align-top border-r border-border ${isBlocked ? "bg-muted/30" : ""}`}
                            >
                              {!isBlocked && hasPermission("create_bookings") ? (
                                <Button
                                  variant="ghost"
                                  className="w-full h-full min-h-[60px] border border-dashed border-border/50 hover:border-primary hover:bg-primary/5 transition-all"
                                  onClick={() => onAddBooking(room.id, dateStr)}
                                >
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              ) : (
                                <div className="w-full h-full min-h-[60px] flex items-center justify-center text-xs text-muted-foreground">
                                  {isBlocked ? "Tidak tersedia" : "-"}
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
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
    </>
  );
}
