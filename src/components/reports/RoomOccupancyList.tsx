import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/contexts/StoreContext";
import { format } from "date-fns";
import { BedDouble } from "lucide-react";

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

const ROOM_COLORS = [
  "hsl(217, 91%, 60%)",   // blue
  "hsl(0, 72%, 51%)",     // red
  "hsl(271, 91%, 65%)",   // purple
  "hsl(217, 91%, 60%)",   // blue light
  "hsl(174, 72%, 56%)",   // cyan
  "hsl(330, 81%, 60%)",   // pink
  "hsl(142, 71%, 45%)",   // green
  "hsl(32, 95%, 54%)",    // orange
  "hsl(48, 96%, 53%)",    // yellow
  "hsl(199, 89%, 48%)",   // sky
  "hsl(262, 83%, 58%)",   // violet
  "hsl(12, 76%, 61%)",    // coral
];

export default function RoomOccupancyList({ startDate, endDate }: RoomOccupancyListProps) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RoomOccupancyData[]>([]);

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

      // Get active rooms
      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif");

      if (roomsError) throw roomsError;
      if (!rooms?.length) { setData([]); setLoading(false); return; }

      // Get bookings in range
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

  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.totalRevenue, 0), [data]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="col-span-full">
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
    <Card className="col-span-full">
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
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
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
                <div className="text-sm font-semibold text-right whitespace-nowrap">
                  {formatCurrency(room.totalRevenue)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
