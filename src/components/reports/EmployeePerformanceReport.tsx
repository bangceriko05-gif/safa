import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { Users, CheckCircle, Award } from "lucide-react";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";

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
        setStats({ totalRoomsCleaned: 0, totalEmployees: 0 });
        setLoading(false);
        return;
      }

      const roomIds = roomsData.map((r) => r.id);
      const roomNameMap = Object.fromEntries(roomsData.map((r) => [r.id, r.name]));

      // Get room daily status where status was set to 'Aktif' (ready/clean)
      // We look for records where status = 'Aktif' within the date range
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
        setStats({ totalRoomsCleaned: 0, totalEmployees: 0 });
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

      // Map logs
      const mappedLogs: RoomReadyLog[] = statusData.map((s) => ({
        room_id: s.room_id,
        room_name: roomNameMap[s.room_id] || "Unknown",
        updated_by: s.updated_by || "",
        user_name: profilesById[s.updated_by || ""] || "Unknown",
        date: s.date,
      }));

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

      setPerformances(sortedPerformances);
      setLogs(mappedLogs);
      setStats({
        totalRoomsCleaned: mappedLogs.length,
        totalEmployees: sortedPerformances.length,
      });
    } catch (error) {
      console.error("Error fetching employee performance data:", error);
    } finally {
      setLoading(false);
    }
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
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
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
          <div className="grid gap-4 md:grid-cols-2">
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
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={`${log.room_id}-${log.date}-${index}`} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                      <div>
                        <div className="font-medium">{log.room_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.date), "d MMM yyyy", { locale: localeId })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{log.user_name}</div>
                        <div className="text-xs text-green-600">Ready ✓</div>
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
