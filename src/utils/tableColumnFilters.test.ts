import { describe, expect, test } from "bun:test";
import { applyColumnFilters } from "./tableColumnFilters";

const rows = [
  { id: "A", category: "FO", status: "Proses", amount: 50000, date: "2026-10-17" },
  { id: "B", category: "FO", status: "Selesai", amount: 9000, date: "2026-09-30" },
  { id: "C", category: "Operasional", status: "Proses", amount: 360000, date: "2026-10-01" },
];
const value = (row: typeof rows[number], key: string) => row[key as keyof typeof row];
describe("report column filters", () => {
  test("all selected leaves every row", () => {
    expect(applyColumnFilters(rows, { category: undefined }, null, value).length).toBe(3);
  });
  test("empty selection returns no rows", () => {
    expect(applyColumnFilters(rows, { category: [] }, null, value)).toEqual([]);
  });
  test("multiple selections and columns intersect", () => {
    expect(applyColumnFilters(rows, { category: ["FO", "Operasional"], status: ["Proses"] }, null, value).map(r => r.id)).toEqual(["A", "C"]);
  });
  test("amounts sort numerically ascending and descending", () => {
    expect(applyColumnFilters(rows, {}, { key: "amount", direction: "asc" }, value).map(r => r.amount)).toEqual([9000, 50000, 360000]);
    expect(applyColumnFilters(rows, {}, { key: "amount", direction: "desc" }, value).map(r => r.amount)).toEqual([360000, 50000, 9000]);
  });
  test("dates sort chronologically without changing source rows", () => {
    expect(applyColumnFilters(rows, {}, { key: "date", direction: "asc" }, value).map(r => r.id)).toEqual(["B", "C", "A"]);
    expect(rows.map(r => r.id)).toEqual(["A", "B", "C"]);
  });
});