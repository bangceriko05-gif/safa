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
import { CalendarIcon, Eye, Undo, Trash2, ChevronDown, XCircle, Search, ImageIcon, Copy, Infinity } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { cn } from "@/lib/utils";
import BookingDetailPopup from "./BookingDetailPopup";
import { Input } from "@/components/ui/input";

interface CancelledBookingsProps {
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
  updated_at: string;
  payment_proof_url: string | null;
  payment_status: string;
}

export default function CancelledBookings({ userRole, onEditBooking }: CancelledBookingsProps) {
  const { currentStore } = useStore();
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "thisMonth" | "lastMonth" | "allTime" | "custom">("thisMonth");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
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
  }, [currentStore]);

  useEffect(() => {
    if (!currentStore) return;
    fetchBookings();

    // Realtime subscription
    const channel = supabase
      .channel(`cancelled-bookings-${currentStore.id}`)
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
  }, [dateFilter, customDateRange, currentStore]);

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
          updated_at,
          payment_proof_url,
          rooms (name)
        `)
        .eq("status", "BATAL")
        .eq("store_id", currentStore.id);

      // Apply date filter
      if (dateFilter === "today") {
        const dateStr = format(new Date(), "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      } else if (dateFilter === "yesterday") {
        const dateStr = format(subDays(new Date(), 1), "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      } else if (dateFilter === "thisMonth") {
        const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
        query = query.gte("date", monthStart).lte("date", monthEnd);
      } else if (dateFilter === "lastMonth") {
        const lastMonth = subMonths(new Date(), 1);
        const monthStart = format(startOfMonth(lastMonth), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(lastMonth), "yyyy-MM-dd");
        query = query.gte("date", monthStart).lte("date", monthEnd);
      } else if (dateFilter === "allTime") {
        // No date filter - fetch all
      } else if (dateFilter === "custom" && customDateRange?.from) {
        const startStr = format(customDateRange.from, "yyyy-MM-dd");
        const endStr = format(customDateRange.to || customDateRange.from, "yyyy-MM-dd");
        query = query.gte("date", startStr).lte("date", endStr);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });

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
        updated_at: b.updated_at,
        payment_proof_url: b.payment_proof_url,
        payment_status: b.payment_status || "belum_lunas",
      }));

      setBookings(mappedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Gagal memuat data booking batal");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBooking = async (bookingId: string) => {
    try {
      if (userRole !== "admin") {
        toast.error("Hanya Admin yang dapat memulihkan booking yang dibatalkan");
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

      const { error } = await supabase
        .from("bookings")
        .update({ status: "BO" })
        .eq("id", bookingId);

      if (error) throw error;

      if (bookingData) {
        const roomName = (bookingData as any).rooms?.name || 'Unknown';
        await logActivity({
          actionType: 'updated',
          entityType: 'Booking',
          entityId: bookingId,
          description: `Memulihkan booking ${bookingData.customer_name} di kamar ${roomName} dari BATAL ke Reservasi`,
        });
      }

      toast.success("Booking berhasil dipulihkan ke Reservasi");
      fetchBookings();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal memulihkan booking");
      console.error(error);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      if (userRole !== "admin") {
        toast.error("Hanya Admin yang dapat menghapus permanen booking");
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
          description: `Menghapus permanen booking ${bookingData.bid || ''} - ${bookingData.customer_name} di kamar ${roomName}`,
        });
      }

      toast.success("Booking berhasil dihapus permanen");
      fetchBookings();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal menghapus booking");
      console.error(error);
    }
  };

  const handleDateFilterChange = (filter: "today" | "yesterday" | "thisMonth" | "lastMonth" | "allTime" | "custom") => {
    setDateFilter(filter);
    if (filter === "custom") {
      setPendingDateRange(customDateRange);
      setCalendarOpen(true);
    }
  };

  const handleCustomDateConfirm = () => {
    if (pendingDateRange?.from) {
      setCustomDateRange(pendingDateRange);
      setCalendarOpen(false);
    } else {
      toast.error("Pilih tanggal terlebih dahulu");
    }
  };

  const handleCopyBid = (bid: string | null) => {
    if (!bid) return;
    navigator.clipboard.writeText(bid);
    toast.success("BID berhasil disalin");
  };

  const isPMSMode = (currentStore as any)?.calendar_type === "pms";

  const filteredBookings = bookings.filter((booking) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      booking.customer_name.toLowerCase().includes(query) ||
      booking.phone.includes(query) ||
      booking.bid?.toLowerCase().includes(query) ||
      booking.room_name.toLowerCase().includes(query)
    );
  });

  

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          Booking Dibatalkan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 flex-wrap">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateFilterChange("lastMonth")}
              className={cn(
                dateFilter === "lastMonth" && "bg-primary text-primary-foreground"
              )}
            >
              Bulan Lalu
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateFilterChange("allTime")}
              className={cn(
                "gap-1",
                dateFilter === "allTime" && "bg-primary text-primary-foreground"
              )}
            >
              <Infinity className="h-3 w-3" />
              All Time
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

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, telepon, BID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Booking Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada booking yang dibatalkan dalam periode ini
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
                  <TableHead>Tanggal Booking</TableHead>
                  <TableHead>{isPMSMode ? "Durasi" : "Jam"}</TableHead>
                  <TableHead>Bukti Bayar</TableHead>
                  <TableHead>Dibatalkan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <TableRow 
                    key={booking.id}
                    className="opacity-70 bg-muted/30"
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {booking.bid ? (
                          <>
                            <span className="font-mono text-sm">{booking.bid}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyBid(booking.bid)}
                              title="Salin BID"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.customer_name}
                    </TableCell>
                    <TableCell>{booking.room_name}</TableCell>
                    <TableCell>
                      {format(new Date(booking.date), "d MMM yyyy", { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      <div>
                        {isPMSMode 
                          ? `${booking.duration} malam`
                          : `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
                        }
                        {' '}
                        <span className={`font-bold text-xs ${booking.payment_status === "lunas" ? "text-emerald-700" : "text-red-600"}`}>
                          ({booking.payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS"})
                        </span>
                      </div>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(booking.updated_at), "d MMM yyyy HH:mm", { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      {userRole === "admin" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1">
                              <Badge variant="secondary">BATAL</Badge>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleRestoreBooking(booking.id)}>
                              <Undo className="mr-2 h-4 w-4" />
                              Pulihkan ke Reservasi
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus Permanen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {userRole !== "admin" && (
                        <Badge variant="secondary">BATAL</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary */}
        <div className="text-sm text-muted-foreground">
          Total: {filteredBookings.length} booking dibatalkan
        </div>

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
  );
}
