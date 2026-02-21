import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";
import { format, eachDayOfInterval } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Building2, Download } from "lucide-react";
import * as XLSX from "xlsx";

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
  room_id: string;
}

export default function OccupancyChart({ startDate, endDate }: OccupancyChartProps) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DailyOccupancy[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [selectedDate, setSelectedDate] = useState<DailyOccupancy | null>(null);
  const [dateBookings, setDateBookings] = useState<(BookingDetail & { roomName?: string })[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [roomNames, setRoomNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!currentStore) return;
    fetchOccupancyData();
  }, [currentStore, startDate, endDate]);

  const fetchOccupancyData = async () => {
    if (!currentStore) return;
    setLoading(true);

    try {
      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif");

      if (roomsError) throw roomsError;

      const activeRooms = rooms || [];
      const activeRoomIds = activeRooms.map((r) => r.id);
      const activeRoomCount = activeRoomIds.length;
      setTotalRooms(activeRoomCount);

      const nameMap = new Map<string, string>();
      activeRooms.forEach(r => nameMap.set(r.id, r.name));
      setRoomNames(nameMap);

      if (activeRoomCount === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, room_id, date, status")
        .eq("store_id", currentStore.id)
        .in("room_id", activeRoomIds)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .in("status", ["BO", "CI", "CO"]);

      if (bookingsError) throw bookingsError;

      const occupancyData: DailyOccupancy[] = days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const occupiedRoomIds = new Set(
          (bookings || []).filter((b) => b.date === dateStr).map((b) => b.room_id)
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

  const handleBarClick = async (dateItem: DailyOccupancy) => {
    if (dateItem.occupied === 0) return;
    setSelectedDate(dateItem);
    setLoadingDetail(true);
    try {
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, bid, date, customer_name, status, price, start_time, end_time, duration, room_id")
        .eq("store_id", currentStore!.id)
        .eq("date", dateItem.date)
        .in("status", ["BO", "CI", "CO"])
        .order("start_time", { ascending: true });

      if (error) throw error;
      setDateBookings(
        (bookings || []).map(b => ({ ...b, roomName: roomNames.get(b.room_id) || "-" }))
      );
    } catch (error) {
      console.error("Error fetching date bookings:", error);
      setDateBookings([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExport = () => {
    if (!selectedDate || dateBookings.length === 0) return;
    const exportData = dateBookings.map((b, i) => ({
      "No": i + 1,
      "BID": b.bid || "-",
      "Tanggal": format(new Date(b.date), "d MMM yyyy", { locale: localeId }),
      "Kamar": b.roomName,
      "Tamu": b.customer_name,
      "Jam Masuk": b.start_time,
      "Jam Keluar": b.end_time,
      "Durasi (Jam)": b.duration,
      "Status": b.status === "BO" ? "Booked" : b.status === "CI" ? "Check In" : b.status === "CO" ? "Check Out" : b.status,
      "Harga": b.price,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Okupansi");
    XLSX.writeFile(wb, `Okupansi_${selectedDate.date}.xlsx`);
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
    if (percentage >= 80) return "hsl(142, 76%, 36%)";
    if (percentage >= 50) return "hsl(48, 96%, 53%)";
    if (percentage > 0) return "hsl(25, 95%, 53%)";
    return "hsl(0, 0%, 80%)";
  };

  const getStatusBadge = (status: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      BO: { label: "Booked", className: "bg-blue-100 text-blue-700" },
      CI: { label: "Check In", className: "bg-green-100 text-green-700" },
      CO: { label: "Check Out", className: "bg-muted text-muted-foreground" },
    };
    const s = map[status || ""] || { label: status || "-", className: "bg-muted text-muted-foreground" };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.className}`}>{s.label}</span>;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const chartConfig = {
    percentage: { label: "Okupansi", color: "hsl(var(--primary))" },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
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
    <>
      <Card>
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

          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              data={data}
              margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
              onClick={(e) => {
                if (e?.activePayload?.[0]?.payload) {
                  handleBarClick(e.activePayload[0].payload as DailyOccupancy);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
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
                        <span className="font-bold" style={{ color: getBarColor(item.percentage) }}>{item.percentage}%</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">Klik untuk lihat detail</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={averageOccupancy} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeWidth={1.5} />
              <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={isSingleDay ? 80 : 50}>
                <LabelList dataKey="percentage" position="top" formatter={(value: number) => `${value}%`} style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

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

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">
                  {selectedDate && format(new Date(selectedDate.date), "d MMMM yyyy", { locale: localeId })}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDate?.occupied} / {selectedDate?.totalRooms} kamar terisi • {selectedDate?.percentage}%
                </p>
              </div>
              {dateBookings.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              )}
            </div>
          </DialogHeader>
          {loadingDetail ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : dateBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada booking</p>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-2 pr-3">
                {dateBookings.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg bg-muted/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-primary">{b.bid || "-"}</span>
                      {getStatusBadge(b.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{b.customer_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">• {b.roomName}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(b.price)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.start_time} - {b.end_time} ({b.duration} jam)
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
