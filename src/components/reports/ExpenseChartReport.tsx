import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useStore } from "@/contexts/StoreContext";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "./ReportDateFilter";
import { DateRange } from "react-day-picker";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";

const PIE_COLORS = [
  "hsl(0, 72%, 51%)",
  "hsl(25, 95%, 53%)",
  "hsl(45, 93%, 47%)",
  "hsl(142, 71%, 45%)",
  "hsl(199, 89%, 48%)",
  "hsl(262, 83%, 58%)",
  "hsl(330, 81%, 60%)",
  "hsl(210, 40%, 60%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)",
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

export default function ExpenseChartReport() {
  const { currentStore } = useStore();
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ category: string; amount: number }[]>([]);

  useEffect(() => {
    if (!currentStore) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(timeRange, customDateRange);
        const { data, error } = await supabase
          .from("expenses")
          .select("category, amount")
          .eq("store_id", currentStore.id)
          .gte("date", format(startDate, "yyyy-MM-dd"))
          .lte("date", format(endDate, "yyyy-MM-dd"))
          .in("process_status", ["proses", "selesai"]);
        if (error) throw error;
        setRows(
          ((data as any[]) || []).map((r) => ({
            category: r.category || "Lainnya",
            amount: Number(r.amount) || 0,
          })),
        );
      } catch (e) {
        console.error(e);
        toast.error("Gagal memuat data grafik");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange, customDateRange, currentStore]);

  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.amount;
    });
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const total = useMemo(
    () => categories.reduce((s, c) => s + c.total, 0),
    [categories],
  );

  const pieData = categories.map((c) => ({ name: c.category, value: c.total }));

  const renderLabel = ({ name, value, cx, x, y, percent }: any) => {
    if (percent < 0.03) return null; // hide tiny slices to prevent overlap
    const pct = (percent * 100).toFixed(1);
    return (
      <text
        x={x}
        y={y}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fill="hsl(var(--foreground))"
      >
        {name} {pct}%
      </text>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Tidak ada data pengeluaran pada periode ini
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(total)}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Grafik Pengeluaran per Kategori (Pie)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 20, right: 60, left: 60, bottom: 20 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={renderLabel}
                        labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                        minAngle={2}
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Grafik Pengeluaran per Kategori (Bar)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categories.map((c) => ({
                        name: c.category,
                        total: c.total,
                      }))}
                      margin={{ top: 8, right: 8, left: 8, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={60}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}jt`
                            : v >= 1000
                            ? `${(v / 1000).toFixed(0)}rb`
                            : `${v}`
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Pengeluaran" fill="hsl(0, 72%, 51%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Rincian Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categories.map((c, i) => {
                  const pct = total > 0 ? (c.total / total) * 100 : 0;
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{
                              backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                          <span>{c.category}</span>
                        </div>
                        <div className="font-medium text-red-600">
                          {formatCurrency(c.total)}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}