import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  method: string | null | undefined;
  supplierName?: string | null;
  supplierNoRek?: string | null;
}

const TRIGGER_KEYWORDS = ["cash", "transfer", "qris"];

function shouldShowPopup(method?: string | null) {
  if (!method) return false;
  const m = method.toLowerCase();
  return TRIGGER_KEYWORDS.some((k) => m.includes(k));
}

export default function PaymentMethodHoverCell({ method, supplierName, supplierNoRek }: Props) {
  const [copied, setCopied] = useState(false);
  const label = method || "-";

  if (!shouldShowPopup(method)) {
    return <span>{label}</span>;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supplierNoRek) return;
    try {
      await navigator.clipboard.writeText(supplierNoRek);
      setCopied(true);
      toast.success("No. rekening disalin");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
          {label}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-64 p-3">
        <div className="space-y-2 text-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Rekening Supplier
          </div>
          <div className="font-medium">{supplierName || "-"}</div>
          {supplierNoRek ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5">
              <span className="font-mono text-sm break-all">{supplierNoRek}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
                aria-label="Salin nomor rekening"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              No. rekening belum diisi
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}