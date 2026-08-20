import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchCustomersCached, type CachedCustomer } from "@/utils/customerCache";

interface Props {
  storeId?: string | null;
  value: string;
  onChange: (name: string) => void;
  onSelect?: (customer: CachedCustomer) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  maxItems?: number;
}

/**
 * Shared customer name input with database-backed suggestions.
 * Typing filters the store's customer base by name or phone.
 */
export default function CustomerNameInput({
  storeId,
  value,
  onChange,
  onSelect,
  placeholder = "Ketik nama pelanggan...",
  className,
  disabled,
  id,
  maxItems = 25,
}: Props) {
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!storeId) {
      setCustomers([]);
      return;
    }
    fetchCustomersCached(storeId).then((rows) => {
      if (!cancelled) setCustomers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const matches = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return customers.slice(0, maxItems);
    return customers
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
      )
      .slice(0, maxItems);
  }, [customers, value, maxItems]);

  return (
    <div className="relative">
      <Input
        id={id}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          blurTimer.current = window.setTimeout(() => setOpen(false), 180);
        }}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-popover border rounded-md shadow-md">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(c.name);
                onSelect?.(c);
                setOpen(false);
              }}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.phone || "-"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
