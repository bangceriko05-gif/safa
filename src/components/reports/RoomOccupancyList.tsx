import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/contexts/StoreContext";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { BedDouble, ChevronRight } from "lucide-react";

interface RoomOccupancyListProps {
  startDate: Date;
  endDate: Date;
}

interface RoomOccupancyData {
  roomId: string;
  roomName: string;
  bookingCount: number;
  totalRevenue: number;
}

interface BookingDetail {
  id: string;
  bid: string | null;
  date: string;
  customer_name: string;
  status: string | null;
  price: number;
  start_time: string;
  end_time: string;
  duration: number;
}

const ROOM_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(271, 91%, 65%)",
  "hsl(217, 91%, 60%)",
  "hsl(174, 72%, 56%)",
  "hsl(330, 81%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(32, 95%, 54%)",
  "hsl(48, 96%, 53%)",
  "hsl(199, 89%, 48%)",
  "hsl(262, 83%, 58%)",
  "hsl(12, 76%, 61%)",
];

export default function RoomOccupancyList({ startDate, endDate }: RoomOccupancyListProps) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RoomOccupancyData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomOccupancyData | null>(null);
  const [roomBookings, setRoomBookings] = useState<BookingDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, startDate, endDate]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);

    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif");

      if (roomsError) throw roomsError;
      if (!rooms?.length) { setData([]); setLoading(false); return; }

      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("room_id, price")
        .eq("store_id", currentStore.id)
        .in("room_id", rooms.map(r => r.id))
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("status", ["BO", "CI", "CO"]);

      if (bookingsError) throw bookingsError;

      const roomMap = new Map<string, { name: string; count: number; revenue: number }>();
      rooms.forEach(r => roomMap.set(r.id, { name: r.name, count: 0, revenue: 0 }));

      (bookings || []).forEach(b => {
        const room = roomMap.get(b.room_id);
        if (room) {
          room.count += 1;
          room.revenue += (b.price || 0);
        }
      });

      const result: RoomOccupancyData[] = Array.from(roomMap.entries())
        .map(([id, val]) => ({
          roomId: id,
          roomName: val.name,
          bookingCount: val.count,
          totalRevenue: val.revenue,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      setData(result);
    } catch (error) {
      console.error("Error fetching room occupancy:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomClick = async (room: RoomOccupancyData) => {
    setSelectedRoom(room);
    setLoadingDetail(true);
    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, bid, date, customer_name, status, price, start_time, end_time, duration")
        .eq("store_id", currentStore!.id)
        .eq("room_id", room.roomId)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("status", ["BO", "CI", "CO"])
        .order("date", { ascending: false });

      if (error) throw error;
      setRoomBookings(bookings || []);
    } catch (error) {
      console.error("Error fetching room bookings:", error);
      setRoomBookings([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.totalRevenue, 0), [data]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const getStatusBadge = (status: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      BO: { label: "Booked", className: "bg-blue-100 text-blue-700" },
      CI: { label: "Check In", className: "bg-green-100 text-green-700" },
      CO: { label: "Check Out", className: "bg-muted text-muted-foreground" },
    };
    const s = map[status || ""] || { label: status || "-", className: "bg-muted text-muted-foreground" };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.className}`}>{s.label}</span>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Okupansi Per Kamar</CardTitle>
          <BedDouble className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada data untuk periode ini
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium">Okupansi Per Kamar</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {formatCurrency(totalRevenue)}
            </p>
          </div>
          <BedDouble className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-2">
          <ScrollArea className="h-[350px] pr-3">
            <div className="space-y-1">
              {data.map((room, index) => (
                <div
                  key={room.roomId}
                  onClick={() => handleRoomClick(room)}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ROOM_COLORS[index % ROOM_COLORS.length] }}
                    />
                    <div>
                      <div className="text-sm font-medium">{room.roomName}</div>
                      <div className="text-xs text-muted-foreground">
                        {room.bookingCount} booking
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-sm font-semibold text-right whitespace-nowrap">
                      {formatCurrency(room.totalRevenue)}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedRoom?.roomName}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {selectedRoom?.bookingCount} booking • {formatCurrency(selectedRoom?.totalRevenue || 0)}
            </p>
          </DialogHeader>
          {loadingDetail ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : roomBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada data booking</p>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-2 pr-3">
                {roomBookings.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg bg-muted/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-primary">{b.bid || "-"}</span>
                      {getStatusBadge(b.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{b.customer_name}</span>
                      <span className="text-sm font-semibold">{formatCurrency(b.price)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(b.date), "d MMM yyyy", { locale: localeId })} • {b.start_time} - {b.end_time} ({b.duration} jam)
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
