import logo from "@/assets/doku-logo.png.asset.json";
import { cn } from "@/lib/utils";

export default function DokuLogo({ className }: { className?: string }) {
  return <img src={logo.url} alt="DOKU" className={cn("h-5 w-5 shrink-0 object-contain", className)} />;
}