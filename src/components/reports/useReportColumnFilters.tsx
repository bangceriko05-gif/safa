import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { TableHead } from "@/components/ui/table";
import { applyColumnFilters, ColumnSelections, ColumnSort, ColumnValue } from "@/utils/tableColumnFilters";
import ReportColumnFilter from "./ReportColumnFilter";

export interface ReportFilterColumn {
  key: string;
  label: string;
  numeric?: boolean;
  date?: boolean;
  currency?: boolean;
}

export default function useReportColumnFilters<T>(rows: T[], columns: ReportFilterColumn[], getValue: (row: T, key: string) => ColumnValue, scope: string) {
  const [selections, setSelections] = useState<ColumnSelections>({});
  const [sort, setSort] = useState<ColumnSort>(null);
  useEffect(() => { setSelections({}); setSort(null); }, [scope]);
  const options = useMemo(() => Object.fromEntries(columns.map(column => {
    const values = [...new Set(rows.map(row => getValue(row, column.key)))];
    values.sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "id", { numeric: true }));
    return [column.key, values.map(value => ({ value: String(value), label: column.date && value !== "-"
      ? format(new Date(String(value)), "dd MMM yyyy", { locale: id })
      : column.currency ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(value)) : String(value) }))];
  })), [rows, columns, getValue]);
  return {
    filtered: applyColumnFilters(rows, selections, sort, getValue),
    selections, sort,
    headers: columns.map(column => (
      <TableHead key={column.key} className={column.numeric ? "text-right" : undefined}>
        <div className={`flex items-center gap-1 whitespace-nowrap ${column.numeric ? "justify-end" : ""}`}>
          <span>{column.label}</span>
          <ReportColumnFilter label={column.label} options={options[column.key] || []} selected={selections[column.key]}
            direction={sort?.key === column.key ? sort.direction : undefined} numeric={column.numeric} date={column.date}
            onApply={(selected, direction) => {
              setSelections(previous => ({ ...previous, [column.key]: selected }));
              setSort(previous => direction ? { key: column.key, direction } : previous?.key === column.key ? null : previous);
            }} />
        </div>
      </TableHead>
    )),
  };
}