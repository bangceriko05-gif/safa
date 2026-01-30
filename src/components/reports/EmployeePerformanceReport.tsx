import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Users, CheckCircle, Award, Download } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import { exportEmployeePerformanceReport, EmployeePerformanceExportData } from "@/utils/reportExport";
import { toast } from "sonner";

interface EmployeePerformance {
  user_id: string;
  user_name: string;
  rooms_cleaned: number;
  rooms_list: string[];
}

interface RoomReadyLog {
  room_id: string;
  room_name: string;
  updated_by: string;
  user_name: string;
  date: string;
  updated_at: string;
  // Booking info
  bid: string | null;
  customer_name: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  turnaround_minutes: number | null;
}

export default function EmployeePerformanceReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [performances, setPerformances] = useState<EmployeePerformance[]>([]);
  const [logs, setLogs] = useState<RoomReadyLog[]>([]);
  const [stats, setStats] = useState({
    totalRoomsCleaned: 0,
    totalEmployees: 0,
    avgTurnaroundMinutes: 0,
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [timeRange, customDateRange, currentStore]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Get rooms for this store
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("store_id", currentStore.id);

      if (roomsError) throw roomsError;

      if (!roomsData || roomsData.length === 0) {
        setPerformances([]);
        setLogs([]);
        setStats({ totalRoomsCleaned: 0, totalEmployees: 0, avgTurnaroundMinutes: 0 });
        setLoading(false);
        return;
      }

      const roomIds = roomsData.map((r) => r.id);
      const roomNameMap = Object.fromEntries(roomsData.map((r) => [r.id, r.name]));

      // Get room daily status where status was set to 'Aktif' (ready/clean)
      const { data: statusData, error: statusError } = await supabase
        .from("room_daily_status")
        .select("room_id, status, updated_by, date, updated_at")
        .in("room_id", roomIds)
        .eq("status", "Aktif")
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (statusError) throw statusError;

      if (!statusData || statusData.length === 0) {
        setPerformances([]);
        setLogs([]);
        setStats({ totalRoomsCleaned: 0, totalEmployees: 0, avgTurnaroundMinutes: 0 });
        setLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = Array.from(new Set(statusData.map((s) => s.updated_by).filter(Boolean)));

      let profilesById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        if (profiles) {
          profilesById = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        }
      }

      // Get bookings that checked out for these rooms
      // We look for bookings that were checked out within a reasonable window
      // The checkout could have happened on a previous date but room cleaned today
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, bid, room_id, customer_name, date, checked_in_at, checked_out_at")
        .in("room_id", roomIds)
        .not("checked_out_at", "is", null)
        .order("checked_out_at", { ascending: false });

      // For each room status, find the most recent checkout that happened before or around the room ready time
      const mappedLogs: RoomReadyLog[] = statusData.map((s) => {
        let matchedBooking: typeof bookingsData[0] | null = null;
        
        if (bookingsData && s.updated_at) {
          const roomReadyTime = parseISO(s.updated_at);
          
          // Find the booking for this room that was checked out closest to (but before) the room ready time
          const roomBookings = bookingsData.filter(b => b.room_id === s.room_id && b.checked_out_at);
          
          for (const booking of roomBookings) {
            const checkoutTime = parseISO(booking.checked_out_at!);
            const diffMinutes = differenceInMinutes(roomReadyTime, checkoutTime);
            
            // The checkout should be before the room was readied and within reasonable time (e.g., 24 hours)
            if (diffMinutes >= 0 && diffMinutes <= 24 * 60) {
              matchedBooking = booking;
              break; // Take the most recent one (already sorted desc)
            }
          }
        }
        
        let turnaroundMinutes: number | null = null;
        if (matchedBooking?.checked_out_at && s.updated_at) {
          turnaroundMinutes = differenceInMinutes(
            parseISO(s.updated_at),
            parseISO(matchedBooking.checked_out_at)
          );
          if (turnaroundMinutes < 0) turnaroundMinutes = null;
        }

        return {
          room_id: s.room_id,
          room_name: roomNameMap[s.room_id] || "Unknown",
          updated_by: s.updated_by || "",
          user_name: profilesById[s.updated_by || ""] || "Unknown",
          date: s.date,
          updated_at: s.updated_at,
          bid: matchedBooking?.bid || null,
          customer_name: matchedBooking?.customer_name || null,
          checked_in_at: matchedBooking?.checked_in_at || null,
          checked_out_at: matchedBooking?.checked_out_at || null,
          turnaround_minutes: turnaroundMinutes,
        };
      });

      // Aggregate by user
      const userAggregates: { [id: string]: EmployeePerformance } = {};
      mappedLogs.forEach((log) => {
        if (!log.updated_by) return;
        if (!userAggregates[log.updated_by]) {
          userAggregates[log.updated_by] = {
            user_id: log.updated_by,
            user_name: log.user_name,
            rooms_cleaned: 0,
            rooms_list: [],
          };
        }
        userAggregates[log.updated_by].rooms_cleaned += 1;
        userAggregates[log.updated_by].rooms_list.push(log.room_name);
      });

      const sortedPerformances = Object.values(userAggregates).sort((a, b) => b.rooms_cleaned - a.rooms_cleaned);

      // Calculate average turnaround time
      const validTurnarounds = mappedLogs
        .map(l => l.turnaround_minutes)
        .filter((m): m is number => m !== null && m >= 0);
      const avgTurnaround = validTurnarounds.length > 0
        ? Math.round(validTurnarounds.reduce((a, b) => a + b, 0) / validTurnarounds.length)
        : 0;

      setPerformances(sortedPerformances);
      setLogs(mappedLogs);
      setStats({
        totalRoomsCleaned: mappedLogs.length,
        totalEmployees: sortedPerformances.length,
        avgTurnaroundMinutes: avgTurnaround,
      });
    } catch (error) {
      console.error("Error fetching employee performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTurnaround = (minutes: number | null): string => {
    if (minutes === null || minutes < 0) return '-';
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
  };

  const handleExport = () => {
    if (!currentStore) return;
    
    const exportData: EmployeePerformanceExportData = {
      performances: performances.map((p, idx) => ({
        rank: idx + 1,
        user_name: p.user_name,
        rooms_cleaned: p.rooms_cleaned,
        rooms_list: p.rooms_list,
      })),
      logs: logs.map(l => ({
        bid: l.bid || '-',
        customer_name: l.customer_name || '-',
        room_name: l.room_name,
        check_in_datetime: l.checked_in_at 
          ? format(parseISO(l.checked_in_at), "d MMM yyyy, HH:mm", { locale: localeId }) 
          : '-',
        check_out_datetime: l.checked_out_at 
          ? format(parseISO(l.checked_out_at), "d MMM yyyy, HH:mm", { locale: localeId }) 
          : '-',
        cleaned_by: l.user_name,
        cleaned_at: l.updated_at 
          ? format(parseISO(l.updated_at), "d MMM yyyy, HH:mm", { locale: localeId }) 
          : format(new Date(l.date), "d MMM yyyy", { locale: localeId }),
        turnaround_minutes: l.turnaround_minutes,
      })),
      summary: {
        total_rooms_cleaned: stats.totalRoomsCleaned,
        total_employees: stats.totalEmployees,
        avg_turnaround_minutes: stats.avgTurnaroundMinutes,
      },
    };

    const dateRangeStr = getDateRangeDisplay(timeRange, customDateRange).replace(/\s/g, '_');
    exportEmployeePerformanceReport(exportData, currentStore.name, dateRangeStr);
    toast.success("Laporan berhasil di-export!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Laporan Kinerja Karyawan</h3>
          <p className="text-sm text-muted-foreground">
            Berdasarkan kamar yang di-set Ready • {getDateRangeDisplay(timeRange, customDateRange)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || performances.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <ReportDateFilter
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Kamar Dibersihkan</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRoomsCleaned}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Karyawan Aktif</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rata-rata Turnaround</CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTurnaround(stats.avgTurnaroundMinutes)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Rankings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-500" />
                Peringkat Karyawan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada data kinerja karyawan</p>
              ) : (
                <div className="space-y-3">
                  {performances.map((emp, index) => (
                    <div key={emp.user_id} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? "bg-yellow-500 text-white" :
                          index === 1 ? "bg-gray-400 text-white" :
                          index === 2 ? "bg-amber-700 text-white" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{emp.user_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Kamar: {emp.rooms_list.slice(0, 3).join(", ")}
                            {emp.rooms_list.length > 3 && ` +${emp.rooms_list.length - 3} lainnya`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{emp.rooms_cleaned}</div>
                        <div className="text-xs text-muted-foreground">kamar</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Log Aktivitas</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada aktivitas</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={`${log.room_id}-${log.date}-${index}`} className="flex flex-col sm:flex-row justify-between gap-2 p-3 bg-muted/50 rounded text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.room_name}</span>
                          {log.bid && <span className="text-xs text-muted-foreground">({log.bid})</span>}
                        </div>
                        {log.customer_name && (
                          <div className="text-xs text-muted-foreground">Tamu: {log.customer_name}</div>
                        )}
                        {log.checked_out_at && (
                          <div className="text-xs text-muted-foreground">
                            Check-out: {format(parseISO(log.checked_out_at), "d MMM, HH:mm", { locale: localeId })}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-medium">{log.user_name}</div>
                        <div className="text-xs text-green-600">
                          Ready {log.updated_at && format(parseISO(log.updated_at), "HH:mm", { locale: localeId })} ✓
                        </div>
                        {log.turnaround_minutes !== null && log.turnaround_minutes >= 0 && (
                          <div className="text-xs text-blue-600">
                            Selisih: {formatTurnaround(log.turnaround_minutes)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
