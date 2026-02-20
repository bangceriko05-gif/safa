import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/contexts/StoreContext";
import { format, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Building2 } from "lucide-react";

interface OccupancyChartProps {
  startDate: Date;
  endDate: Date;
}

interface DailyOccupancy {
  date: string;
  dateLabel: string;
  occupied: number;
  totalRooms: number;
  percentage: number;
}

export default function OccupancyChart({ startDate, endDate }: OccupancyChartProps) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DailyOccupancy[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);

  useEffect(() => {
    if (!currentStore) return;
    fetchOccupancyData();
  }, [currentStore, startDate, endDate]);

  const fetchOccupancyData = async () => {
    if (!currentStore) return;
    setLoading(true);

    try {
      // Get all active rooms for this store
      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif");

      if (roomsError) throw roomsError;

      const activeRoomIds = (rooms || []).map((r) => r.id);
      const activeRoomCount = activeRoomIds.length;
      setTotalRooms(activeRoomCount);

      if (activeRoomCount === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get all days in the range
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch bookings with BO or CI status in this date range
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, room_id, date, status")
        .eq("store_id", currentStore.id)
        .in("room_id", activeRoomIds)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("status", ["BO", "CI", "CO"]);

      if (bookingsError) throw bookingsError;

      // Also check room_daily_status for dirty/maintenance rooms
      const { data: dailyStatuses, error: statusError } = await supabase
        .from("room_daily_status")
        .select("room_id, date, status")
        .in("room_id", activeRoomIds)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (statusError) throw statusError;

      // Build occupancy per day
      const occupancyData: DailyOccupancy[] = days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");

        // Count unique rooms occupied (BO or CI) on this date
        const occupiedRoomIds = new Set(
          (bookings || [])
            .filter((b) => b.date === dateStr)
            .map((b) => b.room_id)
        );

        const occupiedCount = occupiedRoomIds.size;
        const percentage = activeRoomCount > 0 ? Math.round((occupiedCount / activeRoomCount) * 100) : 0;

        return {
          date: dateStr,
          dateLabel: format(day, "d MMM", { locale: localeId }),
          occupied: occupiedCount,
          totalRooms: activeRoomCount,
          percentage,
        };
      });

      setData(occupancyData);
    } catch (error) {
      console.error("Error fetching occupancy data:", error);
    } finally {
      setLoading(false);
    }
  };

  const averageOccupancy = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.round(data.reduce((sum, d) => sum + d.percentage, 0) / data.length);
  }, [data]);

  const maxOccupancy = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map((d) => d.percentage));
  }, [data]);

  const minOccupancy = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.min(...data.map((d) => d.percentage));
  }, [data]);

  const getBarColor = (percentage: number) => {
    if (percentage >= 80) return "hsl(142, 76%, 36%)"; // green
    if (percentage >= 50) return "hsl(48, 96%, 53%)"; // yellow
    if (percentage > 0) return "hsl(25, 95%, 53%)"; // orange
    return "hsl(0, 0%, 80%)"; // gray
  };

  const chartConfig = {
    percentage: {
      label: "Okupansi",
      color: "hsl(var(--primary))",
    },
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Grafik Okupansi Kamar</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada data okupansi untuk periode ini
          </p>
        </CardContent>
      </Card>
    );
  }

  const isSingleDay = data.length === 1;

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Grafik Okupansi Kamar</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totalRooms} kamar aktif • Rata-rata {averageOccupancy}%
          </p>
        </div>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-primary">{averageOccupancy}%</div>
            <div className="text-[10px] text-muted-foreground">Rata-rata</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-green-600">{maxOccupancy}%</div>
            <div className="text-[10px] text-muted-foreground">Tertinggi</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-orange-500">{minOccupancy}%</div>
            <div className="text-[10px] text-muted-foreground">Terendah</div>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as DailyOccupancy;
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
                    <div className="font-medium mb-1">{format(new Date(item.date), "d MMMM yyyy", { locale: localeId })}</div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Terisi:</span>
                      <span className="font-bold">{item.occupied} / {item.totalRooms} kamar</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Okupansi:</span>
                      <span className="font-bold" style={{ color: getBarColor(item.percentage) }}>
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={averageOccupancy}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={isSingleDay ? 80 : 50}>
              <LabelList
                dataKey="percentage"
                position="top"
                formatter={(value: number) => `${value}%`}
                style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }}
              />
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 justify-center mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
            <span>≥ 80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(48, 96%, 53%)" }} />
            <span>50-79%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(25, 95%, 53%)" }} />
            <span>1-49%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(0, 0%, 80%)" }} />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: "hsl(var(--primary))" }} />
            <span>Rata-rata</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
