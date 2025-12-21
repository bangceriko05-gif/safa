import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useStore } from "@/contexts/StoreContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoomSummaryProps {
  selectedDate: Date;
}

interface RoomStats {
  id: string;
  name: string;
  revenue: number;
  hours: number;
  status: string;
}

export default function RoomSummary({ selectedDate }: RoomSummaryProps) {
  const { currentStore } = useStore();
  const [roomStats, setRoomStats] = useState<RoomStats[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) return;
    setIsLoading(true);
    fetchRoomStats().finally(() => setIsLoading(false));

    // **OPTIMIZED REALTIME: Debounced updates**
    let debounceTimer: NodeJS.Timeout;
    
    const channel = supabase
      .channel(`room-stats-${currentStore.id}-${format(selectedDate, "yyyy-MM-dd")}`)
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
            fetchRoomStats();
          }, 500);
        }
      )
      .subscribe();

    // Listen for booking changes
    const handleBookingChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchRoomStats();
      }, 300);
    };
    window.addEventListener("booking-changed", handleBookingChange);

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
      window.removeEventListener("booking-changed", handleBookingChange);
    };
  }, [selectedDate, currentStore]);

  const fetchRoomStats = async () => {
    try {
      if (!currentStore) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // **OPTIMIZED: Fetch rooms and bookings in parallel**
      const [
        { data: rooms, error: roomsError },
        { data: bookings, error: bookingsError }
      ] = await Promise.all([
        supabase
          .from("rooms")
          .select("*")
          .eq("store_id", currentStore.id)
          .order("name"),
        supabase
          .from("bookings")
          .select("room_id, variant_id, duration, discount_type, discount_value, discount_applies_to")
          .eq("date", dateStr)
          .eq("store_id", currentStore.id)
      ]);

      if (roomsError) throw roomsError;
      if (bookingsError) throw bookingsError;

      // Fetch all variants for price calculation
      const variantIds = [...new Set((bookings || []).map(b => b.variant_id).filter(Boolean))];
      const { data: variants } = variantIds.length > 0 
        ? await supabase.from("room_variants").select("id, price, duration").in("id", variantIds)
        : { data: [] as any[] };

      const variantMap = new Map((variants || []).map((v: any) => [v.id, v] as const));

      const stats = (rooms || []).map((room) => {
        const roomBookings = (bookings || []).filter((b) => b.room_id === room.id);
        const revenue = roomBookings.reduce((sum, booking) => {
          // Calculate room subtotal (variant price only)
          const variant = booking.variant_id ? variantMap.get(booking.variant_id) : null;
          if (!variant) return sum;

          const pricePerHour = Number(variant.price) / Number(variant.duration);
          const bookingDuration = Number(booking.duration) || 0;
          let roomSubtotal = pricePerHour * bookingDuration;

          // Apply discount if applies to room
          if (booking.discount_applies_to === "room" || booking.discount_applies_to === "both") {
            const discountValue = Number(booking.discount_value) || 0;
            if (booking.discount_type === "percentage") {
              roomSubtotal = roomSubtotal - (roomSubtotal * discountValue / 100);
            } else if (booking.discount_type === "fixed") {
              roomSubtotal = roomSubtotal - discountValue;
            }
          }

          return sum + roomSubtotal;
        }, 0);
        const hours = roomBookings.reduce((sum, b) => sum + Number(b.duration), 0);

        return {
          id: room.id,
          name: room.name,
          revenue,
          hours,
          status: room.status || "Aktif",
        };
      });

      setRoomStats(stats);

      // Only count active rooms in totals
      const activeStats = stats.filter(s => s.status === "Aktif");
      const totalRev = activeStats.reduce((sum, s) => sum + s.revenue, 0);
      const totalHrs = activeStats.reduce((sum, s) => sum + s.hours, 0);
      setTotalRevenue(totalRev);
      setTotalHours(totalHrs);
    } catch (error) {
      console.error("Error fetching room stats:", error);
    }
  };

  const blockedRoomsCount = roomStats.filter(r => r.status !== "Aktif").length;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm">Memuat ringkasan...</span>
            </div>
          </div>
        )}
        
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2">
          {/* Total Summary */}
          <Card className="bg-primary text-primary-foreground shadow-[var(--shadow-card)] transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-hover)]">
            <CardHeader className="pb-1.5 pt-2 px-2.5">
              <CardTitle className="text-[10px] font-medium">Semua Ruangan</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5">
              <div className="space-y-0.5">
                <div className="text-lg font-bold">{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} jam</div>
                <div className="text-sm opacity-90">Rp {totalRevenue.toLocaleString('id-ID')}</div>
                {blockedRoomsCount > 0 && (
                  <div className="text-[9px] opacity-80 mt-1">
                    {blockedRoomsCount} kamar diblokir
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Individual Rooms */}
          {roomStats.map((room) => {
            const isBlocked = room.status !== "Aktif";
            
            return (
              <Tooltip key={room.id}>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-[var(--shadow-card)] transition-[var(--transition-smooth)] ${
                      isBlocked 
                        ? "opacity-60 bg-muted/50" 
                        : "hover:shadow-[var(--shadow-hover)]"
                    }`}
                  >
                    <CardHeader className="pb-1.5 pt-2 px-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <CardTitle className="text-[10px] font-medium truncate">{room.name}</CardTitle>
                        {isBlocked && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 px-0.5 py-0 h-4">
                            <AlertTriangle className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-2.5 pb-2.5">
                      <div className="space-y-0.5">
                        <div className={`text-lg font-bold ${isBlocked ? "text-muted-foreground" : ""}`}>
                          {isBlocked ? "0" : (room.hours % 1 === 0 ? room.hours : room.hours.toFixed(1))} jam
                        </div>
                        <div className={`text-sm ${isBlocked ? "text-muted-foreground" : "text-muted-foreground"}`}>
                          {isBlocked ? "Rp 0" : `Rp ${room.revenue.toLocaleString('id-ID')}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                {isBlocked && (
                  <TooltipContent>
                    <p>Kamar sedang tidak dapat digunakan</p>
                    <p className="text-xs text-muted-foreground">Status: {room.status}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
        )}
      </div>
    </TooltipProvider>
  );
}
