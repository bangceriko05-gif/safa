import { describe, expect, test } from "bun:test";
import {
  buildSubscriptionItems,
  nextSubscriptionBill,
  parseMonthlyPrice,
  PMS_PAYMENT_ACCOUNT,
  subscriptionBillTiming,
  subscriptionDaysLeft,
  extendFeatureSubscription,
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
  test("tanggal mulai dan nominal tiap fitur tetap independen dari PMS dan fitur lain", () => {
    const items = buildSubscriptionItems(store, [
      { ...pos, subscription_start_date: "2026-11-01" },
      { ...pos, id: "inventory", feature_key: "pos.inventory", monthly_price: 75000, subscription_start_date: "2026-11-10", subscription_end_date: "2026-12-10" },
    ]);
    expect(items[1]).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-25", monthlyPrice: 50000 });
    expect(items[2]).toMatchObject({ startDate: "2026-11-10", endDate: "2026-12-10", monthlyPrice: 75000 });
    expect(items[0].startDate).toBe("2026-11-21");
  });

  test("tanggal mulai fitur yang belum diatur mengikuti PMS", () => {
    expect(buildSubscriptionItems(store, [pos])[1].startDate).toBe("2026-11-21");
  });

  test("perpanjangan 1, 2, 3 bulan memakai akhir fitur sendiri", () => {
    expect(extendFeatureSubscription("2026-01-01", "2026-11-26", 1)).toBe("2026-12-26");
    expect(extendFeatureSubscription("2026-01-01", "2026-11-26", 2)).toBe("2027-01-26");
    expect(extendFeatureSubscription("2026-01-01", "2026-11-26", 3)).toBe("2027-02-26");
  });

  test("perpanjangan memakai tanggal mulai saat akhir kosong dan membatasi akhir bulan", () => {
    expect(extendFeatureSubscription("2026-01-31", "", 1)).toBe("2026-02-28");
    expect(extendFeatureSubscription("", "", 1)).toBe("");
  });
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
