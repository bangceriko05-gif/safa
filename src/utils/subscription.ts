import { addMonths, format, parseISO } from "date-fns";

export function extendFeatureSubscription(start: string, end: string, months: number): string {
  const base = end || start;
  if (!base) return "";
  return format(addMonths(parseISO(base), months), "yyyy-MM-dd");
}

export const PMS_PAYMENT_ACCOUNT = {
  bank: "BCA",
  number: "0241003956",
  name: "FAUZAN ASSIDDIQI",
} as const;

export interface SubscriptionStore {
  id: string;
  name: string;
  is_active: boolean;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  subscription_price?: number | string | null;
}

export interface SubscriptionFeatureRow {
  id: string;
  feature_key: string;
  is_enabled: boolean;
  activation_price: string | null;
  monthly_price: number | string | null;
  subscription_start_date?: string | null;
  subscription_end_date: string | null;
}

export interface SubscriptionItem {
  id: string;
  featureKey: string;
  name: string;
  description: string;
  monthlyPrice: number;
  startDate: string | null;
  endDate: string | null;
  isEnabled: boolean;
  isActive: boolean;
  daysLeft: number | null;
}

const FEATURE_INFO: Record<string, { name: string; description: string }> = {
  pos: { name: "POS", description: "Point of Sales" },
  "pos.inventory": { name: "Inventori POS", description: "Stok Masuk, Keluar, dan Opname" },
  "reports.accounting": { name: "Akuntansi", description: "Jurnal, neraca, arus kas, dan aset" },
  website: { name: "Website", description: "Toko online dan transaksi website" },
  "website.storefront": { name: "Website Toko", description: "Katalog dan halaman toko online" },
  "website.orders": { name: "Transaksi Website", description: "Pesanan dari toko online" },
};

export function parseMonthlyPrice(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (!value) return 0;
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

export function subscriptionDaysLeft(endDate: string | null | undefined, today = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - current.getTime()) / 86_400_000);
}

export function subscriptionFeatureInfo(featureKey: string) {
  if (FEATURE_INFO[featureKey]) return FEATURE_INFO[featureKey];
  const name = featureKey
    .split(".")
    .pop()
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || featureKey;
  return { name, description: "Fitur tambahan ANKA" };
}

export function buildSubscriptionItems(
  store: SubscriptionStore,
  features: SubscriptionFeatureRow[],
  today = new Date(),
): SubscriptionItem[] {
  const pmsDaysLeft = subscriptionDaysLeft(store.subscription_end_date, today);
  const pms: SubscriptionItem = {
    id: `pms-${store.id}`,
    featureKey: "pms",
    name: "PMS",
    description: "Property Management System",
    monthlyPrice: parseMonthlyPrice(store.subscription_price),
    startDate: store.subscription_start_date || null,
    endDate: store.subscription_end_date || null,
    isEnabled: store.is_active,
    isActive: store.is_active && (pmsDaysLeft === null || pmsDaysLeft > 0),
    daysLeft: pmsDaysLeft,
  };

  const paidFeatures = features
    .map((feature) => {
      const monthlyPrice = feature.monthly_price === null
        ? parseMonthlyPrice(feature.activation_price)
        : parseMonthlyPrice(feature.monthly_price);
      const endDate = feature.subscription_end_date || store.subscription_end_date || null;
      const daysLeft = subscriptionDaysLeft(endDate, today);
      const info = subscriptionFeatureInfo(feature.feature_key);
      return {
        id: feature.id,
        featureKey: feature.feature_key,
        ...info,
        monthlyPrice,
        startDate: feature.subscription_start_date || store.subscription_start_date || null,
        endDate,
        isEnabled: feature.is_enabled,
        isActive: feature.is_enabled && (daysLeft === null || daysLeft > 0),
        daysLeft,
      } satisfies SubscriptionItem;
    })
    .filter((feature) => feature.monthlyPrice > 0);

  return [pms, ...paidFeatures];
}

export function nextSubscriptionBill(items: SubscriptionItem[]): SubscriptionItem | null {
  const candidates = items
    .filter((item) => item.isEnabled && item.endDate && item.monthlyPrice > 0)
    .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
  const first = candidates[0];
  if (!first) return null;
  const sameDate = candidates.filter((item) => item.endDate === first.endDate);
  if (sameDate.length === 1) return first;
  return {
    ...first,
    id: `combined-${first.endDate}`,
    featureKey: "combined",
    name: sameDate.map((item) => item.name).join(" + "),
    description: "Tagihan langganan gabungan",
    monthlyPrice: sameDate.reduce((total, item) => total + item.monthlyPrice, 0),
  };
}

export function subscriptionBillTiming(daysLeft: number | null): string {
  if (daysLeft === null) return "Tanggal belum diatur";
  if (daysLeft < 0) return `Terlambat ${Math.abs(daysLeft)} hari`;
  if (daysLeft === 0) return "Jatuh tempo hari ini";
  return `${daysLeft} hari lagi`;
}

export function formatSubscriptionDate(value: string | null | undefined): string {
  if (!value) return "Belum diatur";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Belum diatur";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatSubscriptionPrice(value: number): string {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

