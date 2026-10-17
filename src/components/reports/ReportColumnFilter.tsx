import { useState } from "react";
import { ArrowDown, ArrowUp, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  label: string;
  options: { value: string; label: string }[];
  selected: string[] | undefined;
  direction?: "asc" | "desc";
  numeric?: boolean;
  date?: boolean;
  onApply: (selected: string[] | undefined, direction: "asc" | "desc" | undefined) => void;
}

export default function ReportColumnFilter({ label, options, selected, direction, numeric, date, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[] | undefined>(selected);
  const [draftDirection, setDraftDirection] = useState(direction);
  const visible = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const active = selected !== undefined || direction !== undefined;
  const openChanged = (value: boolean) => {
    if (value) { setDraft(selected); setDraftDirection(direction); setQuery(""); }
    setOpen(value);
  };

  return (
    <Popover open={open} onOpenChange={openChanged}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-6 w-6 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
          aria-label={`Filter ${label}`} title={`Filter ${label}`}>
          <Filter className={`h-3.5 w-3.5 ${selected !== undefined ? "fill-current" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] max-w-[calc(100vw-24px)] p-3" aria-label={`Pilihan filter ${label}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setDraft(undefined)}>Pilih semua ({options.length} opsi)</Button>
          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setDraft([])}>Kosongkan</Button>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label={`Cari pilihan ${label}`} placeholder="Cari..." className="h-9 pl-8" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="h-60 overflow-y-auto border rounded-md py-1">
          {visible.map(option => (
            <label key={option.value} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent">
              <Checkbox className="mt-0.5" checked={draft === undefined || draft.includes(option.value)}
                aria-label={option.label} onCheckedChange={checked => {
                  const next = new Set(draft ?? options.map(item => item.value));
                  if (checked === true) next.add(option.value); else next.delete(option.value);
                  setDraft(next.size === options.length ? undefined : [...next]);
                }} />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          ))}
          {visible.length === 0 && <p className="p-3 text-sm text-muted-foreground">Tidak ada pilihan</p>}
        </div>
        <div className="flex gap-2 border-b py-2 mb-2">
          <Button variant={draftDirection === "asc" ? "secondary" : "ghost"} size="sm" className="flex-1" aria-pressed={draftDirection === "asc"}
            onClick={() => setDraftDirection(draftDirection === "asc" ? undefined : "asc")}>
            <ArrowUp className="h-4 w-4 mr-1" />{numeric ? "Kecil–Besar" : date ? "Terlama" : "A–Z"}
          </Button>
          <Button variant={draftDirection === "desc" ? "secondary" : "ghost"} size="sm" className="flex-1" aria-pressed={draftDirection === "desc"}
            onClick={() => setDraftDirection(draftDirection === "desc" ? undefined : "desc")}>
            <ArrowDown className="h-4 w-4 mr-1" />{numeric ? "Besar–Kecil" : date ? "Terbaru" : "Z–A"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" className="flex-1" onClick={() => { onApply(draft, draftDirection); setOpen(false); }}>Oke</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}