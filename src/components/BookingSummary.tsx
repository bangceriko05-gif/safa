import { MapPin, CalendarIcon, Clock } from "lucide-react";

interface BookingSummaryProps {
  branch?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  variant?: "compact" | "full";
}

export default function BookingSummary({
  branch,
  date,
  startTime,
  endTime,
  variant = "compact"
}: BookingSummaryProps) {
  if (variant === "compact") {
    // Step 2: Only show branch and date
    return (
      <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 mb-6">
        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-3">
          Ringkasan Pilihan
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-foreground">
              <span className="text-muted-foreground">Cabang: </span>
              <span className="font-medium">{branch || "-"}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-foreground">
              <span className="text-muted-foreground">Tanggal: </span>
              <span className="font-medium">{date || "-"}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Full summary with time
  return (
    <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 mb-6">
      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-3">
        Ringkasan Booking
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-foreground">
            <span className="text-muted-foreground">Cabang: </span>
            <span className="font-medium">{branch || "-"}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-foreground">
            <span className="text-muted-foreground">Tanggal: </span>
            <span className="font-medium">{date || "-"}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-foreground">
            <span className="text-muted-foreground">Jam Mulai: </span>
            <span className="font-medium">{startTime || "-"}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-foreground">
            <span className="text-muted-foreground">Jam Selesai: </span>
            <span className="font-medium">{endTime || "-"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
