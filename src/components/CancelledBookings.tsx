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
import { CalendarIcon, Eye, Undo, Trash2, ChevronDown, XCircle, Search, ImageIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
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
}

export default function CancelledBookings({ userRole, onEditBooking }: CancelledBookingsProps) {
  const { currentStore } = useStore();
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
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
  }, [startDate, endDate, currentStore]);

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

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

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
          updated_at,
          payment_proof_url,
          rooms (name)
        `)
        .eq("status", "BATAL")
        .eq("store_id", currentStore.id)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("updated_at", { ascending: false });

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
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Dari:</span>
            <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(startDate, "d MMM yyyy", { locale: idLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      setStartCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  locale={idLocale}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sampai:</span>
            <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(endDate, "d MMM yyyy", { locale: idLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    if (date) {
                      setEndDate(date);
                      setEndCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  locale={idLocale}
                />
              </PopoverContent>
            </Popover>
          </div>

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
