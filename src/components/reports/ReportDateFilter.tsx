import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ReportTimeRange = "today" | "yesterday" | "thisMonth" | "lastMonth" | "allTime" | "custom";

interface ReportDateFilterProps {
  timeRange: ReportTimeRange;
  onTimeRangeChange: (range: ReportTimeRange) => void;
  customDateRange?: DateRange;
  onCustomDateRangeChange: (range: DateRange | undefined) => void;
}

export const getDateRange = (range: ReportTimeRange, customDateRange?: DateRange) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (range) {
    case "today":
      startDate = now;
      endDate = now;
      break;
    case "yesterday":
      startDate = subDays(now, 1);
      endDate = subDays(now, 1);
      break;
    case "thisMonth":
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case "lastMonth":
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case "allTime":
      startDate = new Date(2020, 0, 1);
      endDate = now;
      break;
    case "custom":
      if (customDateRange?.from) {
        startDate = customDateRange.from;
        endDate = customDateRange.to || customDateRange.from;
      } else {
        startDate = now;
        endDate = now;
      }
      break;
    default:
      startDate = now;
      endDate = now;
  }

  return { startDate, endDate };
};

export const getDateRangeDisplay = (range: ReportTimeRange, customDateRange?: DateRange) => {
  const { startDate, endDate } = getDateRange(range, customDateRange);
  
  if (range === "allTime") {
    return "Semua Waktu";
  }
  if (range === "today" || range === "yesterday") {
    return format(startDate, "d MMMM yyyy", { locale: localeId });
  } else {
    const isSameDate = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
    if (isSameDate) {
      return format(startDate, "d MMMM yyyy", { locale: localeId });
    }
    return `${format(startDate, "d MMM", { locale: localeId })} - ${format(endDate, "d MMM yyyy", { locale: localeId })}`;
  }
};

export default function ReportDateFilter({
  timeRange,
  onTimeRangeChange,
  customDateRange,
  onCustomDateRangeChange,
}: ReportDateFilterProps) {
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>(customDateRange);

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={timeRange} 
        onValueChange={(value: ReportTimeRange) => {
          if (value === "custom") {
            setPendingDateRange(customDateRange);
            setShowCustomDatePicker(true);
          }
          onTimeRangeChange(value);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hari Ini</SelectItem>
          <SelectItem value="yesterday">Kemarin</SelectItem>
          <SelectItem value="thisMonth">Bulan Ini</SelectItem>
          <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
          <SelectItem value="allTime">Semua Waktu</SelectItem>
          <SelectItem value="custom">Custom Tanggal</SelectItem>
        </SelectContent>
      </Select>

      {timeRange === "custom" && (
        <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !customDateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customDateRange?.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, "dd MMM", { locale: localeId })} -{" "}
                    {format(customDateRange.to, "dd MMM yyyy", { locale: localeId })}
                  </>
                ) : (
                  format(customDateRange.from, "dd MMM yyyy", { locale: localeId })
                )
              ) : (
                <span>Pilih tanggal</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover z-50" align="end">
            <div className="flex flex-col">
              <Calendar
                mode="range"
                selected={pendingDateRange}
                onSelect={(range) => setPendingDateRange(range)}
                defaultMonth={pendingDateRange?.from || customDateRange?.from || new Date()}
                initialFocus
                numberOfMonths={2}
                locale={localeId}
                className="pointer-events-auto"
              />
              <div className="flex justify-end p-3 pt-0 border-t">
                <Button
                  size="sm"
                  onClick={() => {
                    if (pendingDateRange?.from) {
                      onCustomDateRangeChange(pendingDateRange);
                      setShowCustomDatePicker(false);
                    } else {
                      toast.error("Pilih tanggal terlebih dahulu");
                    }
                  }}
                  disabled={!pendingDateRange?.from}
                >
                  OK
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
