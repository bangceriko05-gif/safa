import { describe, expect, test } from "bun:test";
import {
  buildSubscriptionItems,
  nextSubscriptionBill,
  parseMonthlyPrice,
  PMS_PAYMENT_ACCOUNT,
  subscriptionBillTiming,
  subscriptionDaysLeft,
} from "./subscription";

const store = {
  id: "store-1",
  name: "SAFA Kost and Guest House",
  is_active: true,
  subscription_start_date: "2026-11-21",
  subscription_end_date: "2026-12-21",
  subscription_price: 150000,
};

const pos = {
  id: "feature-pos",
  feature_key: "pos",
  is_enabled: true,
  activation_price: "50000",
  monthly_price: 50000,
  subscription_end_date: "2026-11-25",
};

describe("langganan PMS dan fitur bulanan", () => {
  test("PMS memakai biaya Rp150.000 dari pengaturan outlet", () => {
    const [pms] = buildSubscriptionItems(store, [], new Date("2026-11-22T08:00:00"));
    expect(pms.monthlyPrice).toBe(150000);
    expect(pms.endDate).toBe("2026-12-21");
    expect(pms.isActive).toBe(true);
  });

  test("POS berbayar Rp50.000 mempunyai masa aktif sendiri", () => {
    const items = buildSubscriptionItems(store, [pos], new Date("2026-11-22T08:00:00"));
    expect(items[1]).toMatchObject({ name: "POS", monthlyPrice: 50000, endDate: "2026-11-25", daysLeft: 3 });
  });

  test("fitur gratis tidak masuk tagihan langganan", () => {
    const items = buildSubscriptionItems(store, [{ ...pos, monthly_price: 0, activation_price: null }]);
    expect(items.map((item) => item.featureKey)).toEqual(["pms"]);
  });

  test("fitur tanpa tanggal khusus mengikuti masa aktif PMS", () => {
    const items = buildSubscriptionItems(store, [{ ...pos, subscription_end_date: null }]);
    expect(items[1].endDate).toBe("2026-12-21");
  });

  test("tagihan terdekat memilih POS tiga hari sebelum jatuh tempo", () => {
    const items = buildSubscriptionItems(store, [pos], new Date("2026-11-22T08:00:00"));
    const bill = nextSubscriptionBill(items);
    expect(bill?.featureKey).toBe("pos");
    expect(subscriptionBillTiming(bill?.daysLeft ?? null)).toBe("3 hari lagi");
  });

  test("PMS dan POS dengan tanggal sama ditagihkan bersama sebesar Rp200.000", () => {
    const items = buildSubscriptionItems(store, [{ ...pos, subscription_end_date: "2026-12-21" }], new Date("2026-11-22T08:00:00"));
    const bill = nextSubscriptionBill(items);
    expect(bill?.name).toBe("PMS + POS");
    expect(bill?.monthlyPrice).toBe(200000);
  });

  test("fitur nonaktif tidak ditagihkan", () => {
    const items = buildSubscriptionItems(store, [{ ...pos, is_enabled: false }], new Date("2026-11-22T08:00:00"));
    expect(nextSubscriptionBill(items)?.featureKey).toBe("pms");
  });

  test("harga aktivasi lama tetap dapat dibaca sebagai harga bulanan", () => {
    expect(parseMonthlyPrice("Biaya aktivasi: Rp 250.000 / bulan")).toBe(250000);
  });

  test("hari aktif dihitung dari tanggal kalender, bukan jam", () => {
    expect(subscriptionDaysLeft("2026-11-25", new Date("2026-11-22T23:59:00"))).toBe(3);
    expect(subscriptionBillTiming(0)).toBe("Jatuh tempo hari ini");
  });

  test("pembayaran memakai rekening PMS yang sudah digunakan", () => {
    expect(PMS_PAYMENT_ACCOUNT).toEqual({ bank: "BCA", number: "0241003956", name: "FAUZAN ASSIDDIQI" });
  });
});
