import { describe, expect, it } from "vitest";
import { computeServiceCharge, posOrderTotal, receiptOrderBreakdown, stripAutoOrderNotes } from "./posOrderCharges";

const pct10 = { enabled: true, apply: true, type: "percent" as const, value: 10 };

describe("POS service charge & PPN", () => {
  it("service charge 10% dihitung dari subtotal sebelum PPN", () => {
    expect(computeServiceCharge(145000, pct10)).toBe(14500);
  });

  it("service charge tidak dihitung bila kasir mematikannya", () => {
    expect(computeServiceCharge(145000, { ...pct10, apply: false })).toBe(0);
  });

  it("total = subtotal + PPN exclude + service charge", () => {
    expect(posOrderTotal(145000, 2200, 14500)).toBe(161700);
  });

  it("nota memisahkan service, PPN dan total tersimpan", () => {
    const b = receiptOrderBreakdown([{ total_amount: 161920, service_charge: 14720, tax_amount: 2200 }], 145000);
    expect(b).toEqual({ total: 161920, service: 14720, tax: 2200, other: 0 });
  });

  it("catatan otomatis service charge tidak menumpuk", () => {
    expect(
      stripAutoOrderNotes("[Service Charge: 10% = Rp 14.720] [Service Charge: 10% = Rp 17.720] tanpa es"),
    ).toBe("tanpa es");
  });
});
