import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentTimerProps {
  expiredAt: Date | null;
  onExpired?: () => void;
  className?: string;
}

export default function PaymentTimer({ expiredAt, onExpired, className }: PaymentTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiredAt) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiredAt).getTime();
      const difference = expiry - now;
      
      if (difference <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
        onExpired?.();
        return 0;
      }
      
      return Math.floor(difference / 1000);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      setTimeLeft(left);
      
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiredAt, onExpired]);

  if (!expiredAt) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 120; // Less than 2 minutes

  if (isExpired) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30",
        className
      )}>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">Waktu Pembayaran Habis</p>
          <p className="text-sm text-destructive/80">
            Booking Anda telah dibatalkan secara otomatis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-4 rounded-lg border transition-colors",
      isLowTime 
        ? "bg-destructive/10 border-destructive/30" 
        : "bg-amber-50 border-amber-200",
      className
    )}>
      <div className={cn(
        "p-2 rounded-full",
        isLowTime ? "bg-destructive/20" : "bg-amber-100"
      )}>
        <Clock className={cn(
          "h-5 w-5",
          isLowTime ? "text-destructive animate-pulse" : "text-amber-600"
        )} />
      </div>
      <div className="flex-1">
        <p className={cn(
          "font-medium",
          isLowTime ? "text-destructive" : "text-amber-800"
        )}>
          Batas Waktu Pembayaran
        </p>
        <p className={cn(
          "text-2xl font-bold tabular-nums",
          isLowTime ? "text-destructive" : "text-amber-700"
        )}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className={cn(
          "text-xs",
          isLowTime ? "text-destructive/70" : "text-amber-600"
        )}>
          Selesaikan pembayaran sebelum waktu habis
        </p>
      </div>
    </div>
  );
}
