import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, LogIn, LogOut, AlertTriangle, CheckCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { toast } from "sonner";
import { logActivity } from "@/utils/activityLogger";

interface RoomSummaryProps {
  selectedDate: Date;
}

interface BookingData {
  id: string;
  bid: string | null;
  customer_name: string;
  phone: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  status: string | null;
  room_id: string;
  room_name: string;
}

interface RoomData {
  id: string;
  name: string;
  status: string;
}

type InfoCardType = "total" | "bo" | "ci" | "co" | "kotor" | "available";

export default function RoomSummary({ selectedDate }: RoomSummaryProps) {
  const { currentStore } = useStore();
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<InfoCardType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));

    // Realtime subscription
    let debounceTimer: NodeJS.Timeout;
    
    const bookingsChannel = supabase
      .channel(`room-summary-bookings-${currentStore.id}-${format(selectedDate, "yyyy-MM-dd")}`)
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
          debounceTimer = setTimeout(() => fetchData(), 500);
        }
      )
      .subscribe();

    const roomsChannel = supabase
      .channel(`room-summary-rooms-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchData(), 500);
        }
      )
      .subscribe();

    const handleBookingChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 300);
    };
    window.addEventListener("booking-changed", handleBookingChange);

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(roomsChannel);
      window.removeEventListener("booking-changed", handleBookingChange);
    };
  }, [selectedDate, currentStore]);

  const fetchData = async () => {
    try {
      if (!currentStore) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const [
        { data: bookingsData, error: bookingsError },
        { data: roomsData, error: roomsError }
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(`
            id, bid, customer_name, phone, start_time, end_time, 
            duration, price, status, room_id,
            rooms (name)
          `)
          .eq("date", dateStr)
          .eq("store_id", currentStore.id),
        supabase
          .from("rooms")
          .select("id, name, status")
          .eq("store_id", currentStore.id)
          .order("name")
      ]);

      if (bookingsError) throw bookingsError;
      if (roomsError) throw roomsError;

      const mappedBookings: BookingData[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        bid: b.bid,
        customer_name: b.customer_name,
        phone: b.phone,
        start_time: b.start_time,
        end_time: b.end_time,
        duration: b.duration,
        price: b.price,
        status: b.status,
        room_id: b.room_id,
        room_name: b.rooms?.name || "Unknown",
      }));

      setBookings(mappedBookings);
      setRooms(roomsData || []);
    } catch (error) {
      console.error("Error fetching room summary data:", error);
    }
  };

  // Calculate statistics
  const totalReservations = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

  const boBookings = bookings.filter(b => b.status === "BO" || !b.status);
  const boRevenue = boBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  const ciBookings = bookings.filter(b => b.status === "CI");
  const ciRevenue = ciBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  const coBookings = bookings.filter(b => b.status === "CO");
  const coRevenue = coBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  const kotorRooms = rooms.filter(r => r.status === "Kotor");
  const availableRooms = rooms.filter(r => r.status === "Aktif");

  const handleCardClick = (cardType: InfoCardType) => {
    setSelectedCard(cardType);
    setDialogOpen(true);
  };

  const handleSetRoomReady = async (roomId: string, roomName: string) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ status: "Aktif" })
        .eq("id", roomId);

      if (error) throw error;

      await logActivity({
        actionType: 'updated',
        entityType: 'Room',
        entityId: roomId,
        description: `Mengubah status kamar ${roomName} menjadi Ready/Aktif`,
      });

      toast.success(`Kamar ${roomName} sudah Ready`);
      fetchData();
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error("Gagal mengubah status kamar");
      console.error(error);
    }
  };

  const getDialogTitle = () => {
    switch (selectedCard) {
      case "total": return "Total Reservasi Hari Ini";
      case "bo": return "Tamu Belum Check In (Reservasi)";
      case "ci": return "Tamu Sudah Check In";
      case "co": return "Tamu Sudah Check Out";
      case "kotor": return "Kamar Kotor";
      case "available": return "Kamar Available";
      default: return "";
    }
  };

  const getDialogData = () => {
    switch (selectedCard) {
      case "total": return bookings;
      case "bo": return boBookings;
      case "ci": return ciBookings;
      case "co": return coBookings;
      case "kotor": return kotorRooms;
      case "available": return availableRooms;
      default: return [];
    }
  };

  const isRoomData = selectedCard === "kotor" || selectedCard === "available";

  return (
    <>
      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm">Memuat ringkasan...</span>
          </div>
        </div>
      )}
      
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Box 1: Total Reservasi */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("total")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Total Reservasi</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{totalReservations}</div>
                <div className="text-sm opacity-90">Rp {totalRevenue.toLocaleString('id-ID')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Box 2: Reservasi (BO) */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("bo")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Reservasi</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{boBookings.length}</div>
                <div className="text-sm opacity-90">Rp {boRevenue.toLocaleString('id-ID')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Box 3: Check In (CI) */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("ci")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Check In</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{ciBookings.length}</div>
                <div className="text-sm opacity-90">Rp {ciRevenue.toLocaleString('id-ID')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Box 4: Check Out (CO) */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("co")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Check Out</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{coBookings.length}</div>
                <div className="text-sm opacity-90">Rp {coRevenue.toLocaleString('id-ID')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Box 5: Kamar Kotor */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("kotor")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Kamar Kotor</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{kotorRooms.length}</div>
                <div className="text-sm opacity-90">Perlu dibersihkan</div>
              </div>
            </CardContent>
          </Card>

          {/* Box 6: Kamar Available */}
          <Card 
            className="cursor-pointer bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            onClick={() => handleCardClick("available")}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Kamar Available</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{availableRooms.length}</div>
                <div className="text-sm opacity-90">Siap digunakan</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {getDialogData().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada data
              </div>
            ) : isRoomData ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Kamar</TableHead>
                    <TableHead>Status</TableHead>
                    {selectedCard === "kotor" && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(getDialogData() as RoomData[]).map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={room.status === "Aktif" ? "default" : "destructive"}
                          className={room.status === "Aktif" ? "bg-green-500" : "bg-red-500"}
                        >
                          {room.status}
                        </Badge>
                      </TableCell>
                      {selectedCard === "kotor" && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleSetRoomReady(room.id, room.name)}
                          >
                            Set Ready
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BID</TableHead>
                    <TableHead>Nama Customer</TableHead>
                    <TableHead>Kamar</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(getDialogData() as BookingData[]).map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-sm">{booking.bid || "-"}</TableCell>
                      <TableCell className="font-medium">{booking.customer_name}</TableCell>
                      <TableCell>{booking.room_name}</TableCell>
                      <TableCell>{booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}</TableCell>
                      <TableCell>{booking.duration} jam</TableCell>
                      <TableCell className="text-right">Rp {(booking.price || 0).toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          
          {!isRoomData && getDialogData().length > 0 && (
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-medium">Total:</span>
              <span className="text-lg font-bold">
                Rp {(getDialogData() as BookingData[]).reduce((sum, b) => sum + (b.price || 0), 0).toLocaleString('id-ID')}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
