import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface DateNavigationProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export default function DateNavigation({ selectedDate, onDateChange }: DateNavigationProps) {
  const addDays = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  return (
    <div className="bg-card p-4 rounded-xl shadow-[var(--shadow-card)] transition-[var(--transition-smooth)]">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addDays(-1)}
            className="transition-[var(--transition-smooth)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Kemarin
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
            className="transition-[var(--transition-smooth)]"
          >
            Hari Ini
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addDays(1)}
            className="transition-[var(--transition-smooth)]"
          >
            Besok
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto transition-[var(--transition-smooth)]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "dd MMMM yyyy", { locale: id })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
