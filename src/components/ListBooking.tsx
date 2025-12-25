import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarIcon, MoreHorizontal, Eye, Edit, XCircle, LogIn, LogOut, Trash2, Undo } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { cn } from "@/lib/utils";

interface ListBookingProps {
  userRole: string | null;
  onEditBooking: (booking: any) => void;
}

interface BookingWithRoom {
  id: string;
  bid: string | null;
  customer_name: string;
  phone: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: string | null;
  room_id: string;
  room_name: string;
  price: number;
  created_at: string;
}

export default function ListBooking({ userRole, onEditBooking }: ListBookingProps) {
  const { currentStore } = useStore();
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(new Date());
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [statusColors, setStatusColors] = useState<Record<string, string>>({
    BO: "#87CEEB",
    CI: "#90EE90",
    CO: "#6B7280",
    BATAL: "#9CA3AF",
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchStatusColors();
    fetchUserPermissions();
  }, [currentStore]);

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
    fetchBookings();

    // Realtime subscription
    const channel = supabase
      .channel(`list-bookings-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    // Listen for booking changes
    const handleBookingChange = () => fetchBookings();
    window.addEventListener("booking-changed", handleBookingChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("booking-changed", handleBookingChange);
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
        setStatusColors((prev) => ({ ...prev, ...colors }));
      }
    } catch (error) {
      console.error("Error fetching status colors:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      if (!currentStore) return;
      setIsLoading(true);

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          bid,
          customer_name,
          phone,
          date,
          start_time,
          end_time,
          duration,
          status,
          room_id,
          price,
          created_at,
          rooms (name)
        `)
        .eq("date", dateStr)
        .eq("store_id", currentStore.id)
        .order("start_time");

      if (error) throw error;

      const mappedBookings: BookingWithRoom[] = (data || []).map((b: any) => ({
        id: b.id,
        bid: b.bid,
        customer_name: b.customer_name,
        phone: b.phone,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        duration: b.duration,
        status: b.status,
        room_id: b.room_id,
        room_name: b.rooms?.name || "Unknown",
        price: b.price,
        created_at: b.created_at,
      }));

      setBookings(mappedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Gagal memuat data booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleYesterday = () => {
    setSelectedDate(subDays(new Date(), 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleTomorrow = () => {
    setSelectedDate(addDays(new Date(), 1));
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setTempDate(date);
  };

  const handleCalendarConfirm = () => {
    if (tempDate) {
      setSelectedDate(tempDate);
    }
    setCalendarOpen(false);
  };

  const handleStatusChange = async (bookingId: string, newStatus: string, currentStatus: string | null) => {
    try {
      // Check permission first
      if (!hasPermission("edit_bookings")) {
        toast.error("Anda tidak memiliki izin untuk mengubah status booking");
        return;
      }

      // Check if user is trying to change to/from BATAL
      if ((currentStatus === "BATAL" || newStatus === "BATAL") && userRole !== "admin") {
        toast.error("Hanya Admin yang dapat mengubah status BATAL");
        return;
      }

      // Get booking details for logging
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(`
          customer_name,
          rooms (name)
        `)
        .eq("id", bookingId)
        .single();

      // Prepare update data
      const updateData: any = { status: newStatus };

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get room_id from booking for room status update
      const { data: bookingForRoom } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("id", bookingId)
        .single();

      if (newStatus === "CI") {
        updateData.checked_in_by = user?.id;
        updateData.checked_in_at = new Date().toISOString();
      } else if (newStatus === "CO") {
        updateData.checked_out_by = user?.id;
        updateData.checked_out_at = new Date().toISOString();

        // Mark room as "Kotor" ONLY for this booking date (date-specific)
        if (bookingForRoom?.room_id) {
          const dateStr = format(selectedDate, "yyyy-MM-dd");

          const { error: dailyError } = await supabase
            .from("room_daily_status")
            .upsert(
              {
                room_id: bookingForRoom.room_id,
                date: dateStr,
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
        await logActivity({
          actionType: 'updated',
          entityType: 'Booking',
          entityId: bookingId,
          description: `Mengubah status booking ${bookingData.customer_name} di kamar ${roomName} dari ${currentStatus || 'BO'} menjadi ${newStatus}`,
        });
      }

      toast.success(`Status berhasil diubah ke ${getStatusLabel(newStatus)}`);
      fetchBookings();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal mengubah status");
      console.error(error);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      // Check permission first
      if (!hasPermission("delete_bookings")) {
        toast.error("Anda tidak memiliki izin untuk menghapus booking");
        return;
      }

      // Get booking details for logging
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(`
          customer_name,
          bid,
          rooms (name)
        `)
        .eq("id", bookingId)
        .single();

      // Delete booking products first
      await supabase
        .from("booking_products")
        .delete()
        .eq("booking_id", bookingId);

      // Delete the booking
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (error) throw error;

      if (bookingData) {
        const roomName = (bookingData as any).rooms?.name || 'Unknown';
        await logActivity({
          actionType: 'deleted',
          entityType: 'Booking',
          entityId: bookingId,
          description: `Menghapus booking ${bookingData.bid || ''} - ${bookingData.customer_name} di kamar ${roomName}`,
        });
      }

      toast.success("Booking berhasil dihapus");
      fetchBookings();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal menghapus booking");
      console.error(error);
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
    const color = statusColors[status || "BO"] || "#87CEEB";
    return color;
  };

  const isStatusBatal = (status: string | null) => status === "BATAL";

  const canChangeStatus = (booking: BookingWithRoom) => {
    // If status is BATAL and user is not admin, cannot change
    if (isStatusBatal(booking.status) && userRole !== "admin") {
      return false;
    }
    return true;
  };

  const canEdit = (booking: BookingWithRoom) => {
    // If status is BATAL and user is not admin, cannot edit
    if (isStatusBatal(booking.status) && userRole !== "admin") {
      return false;
    }
    return true;
  };

  const isPMSMode = currentStore?.name?.toLowerCase().includes("safa");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          List Booking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleYesterday}
              className={cn(
                format(selectedDate, "yyyy-MM-dd") === format(subDays(new Date(), 1), "yyyy-MM-dd") && "bg-primary text-primary-foreground"
              )}
            >
              Kemarin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className={cn(
                format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-primary text-primary-foreground"
              )}
            >
              Hari Ini
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTomorrow}
              className={cn(
                format(selectedDate, "yyyy-MM-dd") === format(addDays(new Date(), 1), "yyyy-MM-dd") && "bg-primary text-primary-foreground"
              )}
            >
              Besok
            </Button>
          </div>
          
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "d MMMM yyyy", { locale: idLocale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={handleCalendarSelect}
                initialFocus
                locale={idLocale}
              />
              <div className="flex justify-end gap-2 p-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleCalendarConfirm}>
                  OK
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Booking Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada booking untuk tanggal ini
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BID</TableHead>
                  <TableHead>Nama Customer</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>{isPMSMode ? "Durasi" : "Jam"}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow 
                    key={booking.id}
                    className={cn(
                      isStatusBatal(booking.status) && "opacity-60 bg-muted/30"
                    )}
                  >
                    <TableCell className="font-mono text-sm">
                      {booking.bid || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.customer_name}
                    </TableCell>
                    <TableCell>{booking.room_name}</TableCell>
                    <TableCell>
                      {format(new Date(booking.date), "d MMM yyyy", { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      {isPMSMode 
                        ? `${booking.duration} malam`
                        : `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
                      }
                    </TableCell>
                    <TableCell>
                      <Badge 
                        style={{ 
                          backgroundColor: getStatusColor(booking.status),
                          color: booking.status === "CO" || booking.status === "BATAL" ? "#fff" : "#1F2937"
                        }}
                      >
                        {getStatusLabel(booking.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Edit Button */}
                          {hasPermission("edit_bookings") && (
                            <DropdownMenuItem 
                              onClick={() => onEditBooking(booking)}
                              disabled={!canEdit(booking)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          
                          {/* Status Change Options - requires edit_bookings permission */}
                          {hasPermission("edit_bookings") && canChangeStatus(booking) && booking.status !== "BO" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "BO", booking.status)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Reservasi
                            </DropdownMenuItem>
                          )}
                          
                          {hasPermission("edit_bookings") && canChangeStatus(booking) && booking.status !== "CI" && !isStatusBatal(booking.status) && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "CI", booking.status)}>
                              <LogIn className="mr-2 h-4 w-4" />
                              Check In
                            </DropdownMenuItem>
                          )}
                          
                          {hasPermission("edit_bookings") && canChangeStatus(booking) && booking.status !== "CO" && !isStatusBatal(booking.status) && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "CO", booking.status)}>
                              <LogOut className="mr-2 h-4 w-4" />
                              Check Out
                            </DropdownMenuItem>
                          )}
                          
                          {/* BATAL option - for admin or users with cancel_checkout_bookings permission for CO status */}
                          {(userRole === "admin" || (hasPermission("cancel_checkout_bookings") && booking.status === "CO")) && 
                            booking.status !== "BATAL" && (
                            <DropdownMenuItem 
                              onClick={() => handleStatusChange(booking.id, "BATAL", booking.status)}
                              className="text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Batalkan
                            </DropdownMenuItem>
                          )}
                          
                          {/* Restore from BATAL - only for admin */}
                          {userRole === "admin" && booking.status === "BATAL" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "BO", booking.status)}>
                              <Undo className="mr-2 h-4 w-4" />
                              Pulihkan ke Reservasi
                            </DropdownMenuItem>
                          )}

                          {/* Delete option - for users with delete_bookings permission */}
                          {hasPermission("delete_bookings") && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
