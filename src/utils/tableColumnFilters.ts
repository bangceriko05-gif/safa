export type ColumnSelections = Record<string, string[] | undefined>;
export type ColumnSort = { key: string; direction: "asc" | "desc" } | null;
export type ColumnValue = string | number;

export function applyColumnFilters<T>(
  rows: T[],
  selections: ColumnSelections,
  sort: ColumnSort,
  getValue: (row: T, key: string) => ColumnValue,
): T[] {
  const filtered = rows.filter(row => Object.entries(selections).every(
    ([key, values]) => values === undefined || values.includes(String(getValue(row, key))),
  ));
  if (!sort) return filtered;
  return filtered.sort((a, b) => {
    const left = getValue(a, sort.key);
    const right = getValue(b, sort.key);
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "id", { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? comparison : -comparison;
  });
}