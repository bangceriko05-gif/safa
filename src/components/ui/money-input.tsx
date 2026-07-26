import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  className?: string;
  allowDecimal?: boolean;
}

/**
 * Money input that formats numbers with Indonesian thousand separators
 * as the user types (e.g. 1000 -> "1.000", 100000 -> "100.000") and
 * emits the raw numeric value via onChange.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, allowDecimal = false, ...rest }, ref) => {
    const num = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : Number(value ?? 0);
    const safe = Number.isFinite(num) ? num : 0;
    const display = safe ? new Intl.NumberFormat("id-ID").format(safe) : "";
    return (
      <Input
        ref={ref}
        {...rest}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          onChange(raw ? parseInt(raw, 10) : 0);
        }}
        className={cn("tabular-nums", className)}
      />
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export default MoneyInput;