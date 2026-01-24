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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Eye, Edit, XCircle, LogIn, LogOut, Trash2, Undo, ChevronDown, List, Printer, ImageIcon } from "lucide-react";
import { format, addDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { cn } from "@/lib/utils";
import BookingDetailPopup from "./BookingDetailPopup";
import CancelledBookings from "./CancelledBookings";

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
  payment_proof_url: string | null;
}

export default function ListBooking({ userRole, onEditBooking }: ListBookingProps) {
  const { currentStore } = useStore();
  const [activeSubTab, setActiveSubTab] = useState("active");
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "thisMonth" | "custom">("today");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>(undefined);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [statusColors, setStatusColors] = useState<Record<string, string>>({
    BO: "#87CEEB",
    CI: "#90EE90",
    CO: "#6B7280",
    BATAL: "#9CA3AF",
  });
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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
  }, [selectedDate, dateFilter, customDateRange, currentStore]);

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

      let query = supabase
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
          payment_proof_url,
          rooms (name)
        `)
        .eq("store_id", currentStore.id);

      // Apply date filter based on current filter type
      if (dateFilter === "today" || dateFilter === "yesterday") {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      } else if (dateFilter === "thisMonth") {
        const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
        query = query.gte("date", monthStart).lte("date", monthEnd);
      } else if (dateFilter === "custom" && customDateRange?.from) {
        const startDate = format(customDateRange.from, "yyyy-MM-dd");
        const endDate = format(customDateRange.to || customDateRange.from, "yyyy-MM-dd");
        query = query.gte("date", startDate).lte("date", endDate);
      } else {
        // Default to today if no filter
        const dateStr = format(new Date(), "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      }

      const { data, error } = await query.order("date", { ascending: false }).order("start_time");

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
        payment_proof_url: b.payment_proof_url,
      }));

      setBookings(mappedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Gagal memuat data booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateFilterChange = (filter: "today" | "yesterday" | "thisMonth" | "custom") => {
    setDateFilter(filter);
    if (filter === "today") {
      setSelectedDate(new Date());
    } else if (filter === "yesterday") {
      setSelectedDate(subDays(new Date(), 1));
    } else if (filter === "thisMonth") {
      setSelectedDate(new Date());
    } else if (filter === "custom") {
      setPendingDateRange(customDateRange);
      setCalendarOpen(true);
    }
  };

  const handleCustomDateConfirm = () => {
    if (pendingDateRange?.from) {
      setCustomDateRange(pendingDateRange);
      setSelectedDate(pendingDateRange.from);
      setCalendarOpen(false);
    } else {
      toast.error("Pilih tanggal terlebih dahulu");
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string, currentStatus: string | null) => {
    try {
      // Check permission first (for non-BATAL status changes)
      if (newStatus !== "BATAL" && !hasPermission("edit_bookings")) {
        toast.error("Anda tidak memiliki izin untuk mengubah status booking");
        return;
      }

      // Check if user is trying to restore from BATAL - requires admin only
      if (currentStatus === "BATAL" && userRole !== "admin") {
        toast.error("Hanya Admin yang dapat memulihkan booking yang dibatalkan");
        return;
      }
      
      // All users can cancel bookings - no permission check for BATAL

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

        // Mark room as "Kotor" for TODAY (the actual checkout date)
        if (bookingForRoom?.room_id) {
          const todayStr = format(new Date(), "yyyy-MM-dd");

          const { error: dailyError } = await supabase
            .from("room_daily_status")
            .upsert(
              {
                room_id: bookingForRoom.room_id,
                date: todayStr,
                status: "Kotor",
                updated_by: user?.id,
              },
              { onConflict: "room_id,date" }
            );

          if (dailyError) throw dailyError;
        }
      } else if (newStatus === "BATAL") {
        // BATAL: Set room to ready (Aktif) directly, not Kotor
        if (bookingForRoom?.room_id) {
          const dateStr = format(selectedDate, "yyyy-MM-dd");

          await supabase
            .from("room_daily_status")
            .upsert(
              {
                room_id: bookingForRoom.room_id,
                date: dateStr,
                status: "Aktif",
                updated_by: user?.id,
              },
              { onConflict: "room_id,date" }
            );
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
          description: `Mengubah status booking ${bookingData.customer_name} di kamar ${roomName} dari ${currentStatus || 'BO'} menjadi ${newStatus}`,
          storeId: currentStore?.id,
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

  const isPMSMode = (currentStore as any)?.calendar_type === "pms";

  // Filter out BATAL status from active bookings list
  const activeBookings = bookings.filter(b => b.status !== "BATAL");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="gap-2">
            <List className="h-4 w-4" />
            Aktif
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2">
            <XCircle className="h-4 w-4" />
            Batal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                List Booking Aktif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateFilterChange("today")}
              className={cn(
                dateFilter === "today" && "bg-primary text-primary-foreground"
              )}
            >
              Hari Ini
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateFilterChange("yesterday")}
              className={cn(
                dateFilter === "yesterday" && "bg-primary text-primary-foreground"
              )}
            >
              Kemarin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateFilterChange("thisMonth")}
              className={cn(
                dateFilter === "thisMonth" && "bg-primary text-primary-foreground"
              )}
            >
              Bulan Ini
            </Button>
          </div>
          
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                  "gap-2",
                  dateFilter === "custom" && "bg-primary text-primary-foreground"
                )}
                onClick={() => handleDateFilterChange("custom")}
              >
                <CalendarIcon className="h-4 w-4" />
                {dateFilter === "custom" && customDateRange?.from ? (
                  customDateRange.to ? (
                    <>
                      {format(customDateRange.from, "d MMM", { locale: idLocale })} -{" "}
                      {format(customDateRange.to, "d MMM yyyy", { locale: idLocale })}
                    </>
                  ) : (
                    format(customDateRange.from, "d MMMM yyyy", { locale: idLocale })
                  )
                ) : (
                  "Custom Tanggal"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={pendingDateRange}
                onSelect={(range) => setPendingDateRange(range)}
                defaultMonth={pendingDateRange?.from || new Date()}
                initialFocus
                numberOfMonths={2}
                locale={idLocale}
                className="pointer-events-auto"
              />
              <div className="flex justify-end gap-2 p-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleCustomDateConfirm} disabled={!pendingDateRange?.from}>
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
        ) : activeBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada booking untuk tanggal ini
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>BID</TableHead>
                  <TableHead>Nama Customer</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>{isPMSMode ? "Durasi" : "Jam"}</TableHead>
                  <TableHead>Bukti Bayar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBookings.map((booking) => (
                  <TableRow 
                    key={booking.id}
                    className={cn(
                      isStatusBatal(booking.status) && "opacity-60 bg-muted/30"
                    )}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBookingId(booking.id);
                          setDetailPopupOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
                      {booking.payment_proof_url ? (
                        <a
                          href={booking.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
                          title="Lihat Bukti Bayar"
                        >
                          <img
                            src={booking.payment_proof_url}
                            alt="Bukti Bayar"
                            className="w-6 h-6 rounded object-cover border"
                          />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="gap-1 h-7 px-2"
                            disabled={!canChangeStatus(booking) && !hasPermission("edit_bookings")}
                          >
                            <Badge 
                              style={{ 
                                backgroundColor: getStatusColor(booking.status),
                                color: booking.status === "CO" || booking.status === "BATAL" ? "#fff" : "#1F2937"
                              }}
                            >
                              {getStatusLabel(booking.status)}
                            </Badge>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
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
                              <Badge 
                                className="mr-2"
                                style={{ 
                                  backgroundColor: statusColors.BO,
                                  color: "#1F2937"
                                }}
                              >
                                BO
                              </Badge>
                              Reservasi
                            </DropdownMenuItem>
                          )}
                          
                          {hasPermission("edit_bookings") && canChangeStatus(booking) && booking.status !== "CI" && !isStatusBatal(booking.status) && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "CI", booking.status)}>
                              <Badge 
                                className="mr-2"
                                style={{ 
                                  backgroundColor: statusColors.CI,
                                  color: "#1F2937"
                                }}
                              >
                                CI
                              </Badge>
                              Check In
                            </DropdownMenuItem>
                          )}
                          
                          {hasPermission("edit_bookings") && canChangeStatus(booking) && booking.status !== "CO" && !isStatusBatal(booking.status) && (
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "CO", booking.status)}>
                              <Badge 
                                className="mr-2"
                                style={{ 
                                  backgroundColor: statusColors.CO,
                                  color: "#fff"
                                }}
                              >
                                CO
                              </Badge>
                              Check Out
                            </DropdownMenuItem>
                          )}
                          
                          {/* BATAL option - for admin, users with cancel_bookings, or cancel_checkout_bookings for CO status */}
                          {(userRole === "admin" || hasPermission("cancel_bookings") || (hasPermission("cancel_checkout_bookings") && booking.status === "CO")) && 
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/receipt?id=${booking.id}`, '_blank')}
                        title="Print Nota"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

            {/* Booking Detail Popup */}
            <BookingDetailPopup
              isOpen={detailPopupOpen}
              onClose={() => {
                setDetailPopupOpen(false);
                setSelectedBookingId(null);
              }}
              bookingId={selectedBookingId}
              statusColors={statusColors}
              onStatusChange={() => fetchBookings()}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cancelled" className="mt-4">
        <CancelledBookings userRole={userRole} onEditBooking={onEditBooking} />
      </TabsContent>
    </Tabs>
  </div>
  );
}
