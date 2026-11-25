import { Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SubscriptionPaymentIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex text-foreground", className)} aria-hidden="true">
      <Calendar className="h-full w-full" strokeWidth={1.9} />
      <span className="absolute -bottom-[12%] -right-[16%] flex h-[58%] w-[58%] items-center justify-center rounded-full border-2 border-card bg-success text-primary-foreground shadow-sm">
        <Check className="h-[72%] w-[72%]" strokeWidth={3.5} />
      </span>
    </span>
  );
}
