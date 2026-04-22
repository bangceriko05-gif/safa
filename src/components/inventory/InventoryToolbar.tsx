import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Plus,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

interface InventoryToolbarProps {
  title: string;
  count: number;
  countLabel: string;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (s: string) => void;
  searchPlaceholder?: string;
  onExport?: () => void;
  onImport?: () => void;
  onAdd?: () => void;
  addLabel?: string;
}

export default function InventoryToolbar({
  title,
  count,
  countLabel,
  dateRange,
  onDateRangeChange,
  pageSize,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Cari...",
  onExport,
  onImport,
  onAdd,
  addLabel = "Tambah",
}: InventoryToolbarProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>(dateRange);

  const shiftRange = (days: number) => {
    if (!dateRange?.from || !dateRange?.to) return;
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    from.setDate(from.getDate() + days);
    to.setDate(to.getDate() + days);
    onDateRangeChange({ from, to });
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "dd MMM yy", { locale: localeId })} - ${format(
          dateRange.to,
          "dd MMM yy",
          { locale: localeId },
        )}`
      : format(dateRange.from, "dd MMM yy", { locale: localeId })
    : "Pilih tanggal";

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {count} {countLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range navigator */}
          <div className="flex items-center border rounded-md overflow-hidden bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none text-primary hover:bg-primary/5"
              onClick={() => shiftRange(-1)}
              disabled={!dateRange?.from}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 px-3 rounded-none gap-2 text-foreground hover:bg-primary/5 font-medium"
                  onClick={() => setPending(dateRange)}
                >
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-popover z-50"
                align="end"
              >
                <Calendar
                  mode="range"
                  selected={pending}
                  onSelect={(r) => setPending(r)}
                  defaultMonth={pending?.from || new Date()}
                  numberOfMonths={2}
                  locale={localeId}
                  className="pointer-events-auto"
                  initialFocus
                />
                <div className="flex justify-end gap-2 p-3 pt-0 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onDateRangeChange(undefined);
                      setPending(undefined);
                      setOpen(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (pending?.from) {
                        onDateRangeChange(pending);
                        setOpen(false);
                      } else {
                        toast.error("Pilih tanggal terlebih dahulu");
                      }
                    }}
                  >
                    Terapkan
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none text-primary hover:bg-primary/5"
              onClick={() => shiftRange(1)}
              disabled={!dateRange?.from}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={onExport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            onClick={onImport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Upload className="h-4 w-4" /> Import
          </Button>
          {onAdd && (
            <Button
              onClick={onAdd}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 Baris</SelectItem>
            <SelectItem value="25">25 Baris</SelectItem>
            <SelectItem value="50">50 Baris</SelectItem>
            <SelectItem value="100">100 Baris</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>
    </div>
  );
}