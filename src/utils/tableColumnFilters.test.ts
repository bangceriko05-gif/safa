/// <reference types="bun" />
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
  test("purchase quantity and subtotal filters feed the same rows to totals and export", () => {
    const purchases = [{ bid: "P1", quantity: 2, subtotal: 50000 }, { bid: "P2", quantity: 3, subtotal: 9000 }];
    const filtered = applyColumnFilters(purchases, { quantity: ["2"] }, { key: "subtotal", direction: "desc" },
      (row, key) => row[key as keyof typeof row]);
    expect(filtered.reduce((sum, row) => sum + row.subtotal, 0)).toBe(50000);
    expect(filtered.map(row => row.bid)).toEqual(["P1"]);
    expect(purchases.length).toBe(2);
  });
  test("sales payment filtering never discounts received money again", () => {
    const sales = [{ bid: "S1", gross: 1120000, discount: 220000, paid: 900000 }, { bid: "S2", gross: 50000, discount: 0, paid: 50000 }];
    const filtered = applyColumnFilters(sales, { paid: ["900000"] }, null,
      (row, key) => row[key as keyof typeof row]);
    expect(filtered.reduce((sum, row) => sum + row.gross, 0)).toBe(1120000);
    expect(filtered.reduce((sum, row) => sum + row.discount, 0)).toBe(220000);
    expect(filtered.reduce((sum, row) => sum + row.paid, 0)).toBe(900000);
  });
});