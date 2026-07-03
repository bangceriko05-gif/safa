import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ReportDateFilter, { ReportTimeRange, getDateRange } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs);
  return n < 0 ? `(${s})` : s;
};

interface PLData {
  // A. Pendapatan
  salesPOS: number;
  pelunasanKredit: number;
  pengirimanIncome: number;
  pajakExclude: number;
  pajakInclude: number;
  pembulatan: number;
  pengembalian: number;
  depositDitebus: number;
  // B. HPP
  hppPenjualan: number;
  hppPengembalian: number;
  // D. Pengeluaran
  expensesByCategory: { category: string; amount: number }[];
  // E. Stok
  stokKeluar: number;
  opnameStok: number;
  // F. Pembelian
  pembelianDiskon: number;
  pembelianPengiriman: number;
  pembelianPajak: number;
}

const EMPTY: PLData = {
  salesPOS: 0, pelunasanKredit: 0, pengirimanIncome: 0,
  pajakExclude: 0, pajakInclude: 0, pembulatan: 0, pengembalian: 0, depositDitebus: 0,
  hppPenjualan: 0, hppPengembalian: 0,
  expensesByCategory: [],
  stokKeluar: 0, opnameStok: 0,
  pembelianDiskon: 0, pembelianPengiriman: 0, pembelianPajak: 0,
};

export default function ProfitLoss() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [data, setData] = useState<PLData>(EMPTY);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    A: true, B: true, D: true, E: true, F: true,
  });

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, timeRange, customDateRange]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [bookingsRes, incomesRes, expensesRes, depositsRes, opnameRes, stockOutRes, purchasesRes, bookingProductsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, price, price_2, tax_amount, tax_mode, tax_enabled")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .not("status", "in", '("Cancelled","BATAL")'),
        supabase
          .from("incomes")
          .select("amount, category")
          .eq("store_id", currentStore.id)
          .eq("process_status", "selesai")
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("expenses")
          .select("amount, category")
          .eq("store_id", currentStore.id)
          .eq("process_status", "selesai")
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("room_deposits")
          .select("amount, status, returned_at")
          .eq("store_id", currentStore.id)
          .eq("status", "returned")
          .gte("returned_at", `${startStr}T00:00:00`)
          .lte("returned_at", `${endStr}T23:59:59`),
        supabase
          .from("stock_opname")
          .select("total_value_difference, status, posted_at")
          .eq("store_id", currentStore.id)
          .eq("status", "posted")
          .gte("posted_at", `${startStr}T00:00:00`)
          .lte("posted_at", `${endStr}T23:59:59`),
        supabase
          .from("stock_out")
          .select("total_amount, status, posted_at")
          .eq("store_id", currentStore.id)
          .eq("status", "posted")
          .gte("posted_at", `${startStr}T00:00:00`)
          .lte("posted_at", `${endStr}T23:59:59`),
        supabase
          .from("purchases")
          .select("total, discount_amount, shipping_cost, tax_amount, verification_status, date")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("booking_products")
          .select("product_id, quantity, bookings!inner(store_id, date, status)")
          .eq("bookings.store_id", currentStore.id)
          .gte("bookings.date", startStr)
          .lte("bookings.date", endStr)
          .not("bookings.status", "in", '("Cancelled","BATAL")'),
      ]);

      const salesPOS = (bookingsRes.data || []).reduce(
        (sum, b) => sum + (Number(b.price) || 0) + (Number(b.price_2) || 0), 0
      );

      let pajakExclude = 0, pajakInclude = 0;
      (bookingsRes.data || []).forEach((b: any) => {
        if (!b.tax_enabled) return;
        const t = Number(b.tax_amount) || 0;
        if ((b.tax_mode || "").toLowerCase() === "include") pajakInclude += t;
        else pajakExclude += t;
      });

      // Split incomes by category
      const incomeCat = (kw: string[]) =>
        (incomesRes.data || []).filter((i: any) => {
          const c = (i.category || "").toLowerCase();
          return kw.some((k) => c.includes(k));
        }).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

      const pelunasanKredit = incomeCat(["pelunasan", "kredit", "piutang"]);
      const pengirimanIncome = incomeCat(["pengiriman", "delivery", "ongkir"]);

      const depositDitebus = (depositsRes.data || []).reduce(
        (s: number, d: any) => s + (Number(d.amount) || 0), 0
      );

      // HPP — sum(quantity * purchase_price) from booking_products
      const productIds = Array.from(
        new Set(((bookingProductsRes.data as any[]) || []).map((r) => r.product_id).filter(Boolean))
      );
      let costMap = new Map<string, number>();
      if (productIds.length) {
        const { data: prodRows } = await supabase
          .from("products")
          .select("id, purchase_price")
          .in("id", productIds);
        (prodRows || []).forEach((p: any) => costMap.set(p.id, Number(p.purchase_price) || 0));
      }
      const hppPenjualan = ((bookingProductsRes.data as any[]) || []).reduce(
        (s, r) => s + (Number(r.quantity) || 0) * (costMap.get(r.product_id) || 0), 0
      );

      // Expenses grouped
      const catMap: Record<string, number> = {};
      (expensesRes.data || []).forEach((e: any) => {
        const cat = e.category || "Lainnya";
        catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
      });
      const expensesByCategory = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      const stokKeluar = (stockOutRes.data || []).reduce(
        (s: number, r: any) => s + (Number(r.total_amount) || 0), 0
      );
      const opnameStok = (opnameRes.data || []).reduce(
        (s: number, r: any) => s + (Number(r.total_value_difference) || 0), 0
      );

      const pembelianDiskon = (purchasesRes.data || []).reduce(
        (s: number, p: any) => s + (Number(p.discount_amount) || 0), 0
      );
      const pembelianPengiriman = (purchasesRes.data || []).reduce(
        (s: number, p: any) => s + (Number(p.shipping_cost) || 0), 0
      );
      const pembelianPajak = (purchasesRes.data || []).reduce(
        (s: number, p: any) => s + (Number(p.tax_amount) || 0), 0
      );

      setData({
        salesPOS,
        pelunasanKredit,
        pengirimanIncome,
        pajakExclude,
        pajakInclude,
        pembulatan: 0,
        pengembalian: 0,
        depositDitebus,
        hppPenjualan,
        hppPengembalian: 0,
        expensesByCategory,
        stokKeluar,
        opnameStok,
        pembelianDiskon,
        pembelianPengiriman,
        pembelianPajak,
      });
    } catch (error) {
      console.error("Error fetching P&L:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalA =
    data.salesPOS + data.pelunasanKredit + data.pengirimanIncome +
    data.pajakExclude + data.pajakInclude + data.pembulatan +
    data.pengembalian + data.depositDitebus;
  const totalB = data.hppPenjualan + data.hppPengembalian;
  const labaKotor = totalA - totalB;
  const totalD = data.expensesByCategory.reduce((s, e) => s + e.amount, 0);
  const totalE = data.stokKeluar + data.opnameStok; // both usually negative-impacting
  const totalF = data.pembelianDiskon + data.pembelianPengiriman + data.pembelianPajak;
  // Laba bersih: gross profit - expenses - stock adjustments - purchase overhead
  const labaBersih = labaKotor - totalD + totalE - totalF;

  const toggle = (k: string) => setOpenSections((o) => ({ ...o, [k]: !o[k] }));

  const Row = ({ label, value, indent = true }: { label: string; value: number; indent?: boolean }) => (
    <div className={cn("grid grid-cols-[1fr_auto] items-center px-4 py-2 border-b text-sm", indent && "pl-8")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right min-w-[140px]">{fmt(value)}</span>
    </div>
  );

  const SectionHeader = ({
    id, label, total, collapsible = true,
  }: { id: string; label: string; total: number; collapsible?: boolean }) => (
    <button
      type="button"
      onClick={() => collapsible && toggle(id)}
      className="w-full grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b bg-muted/30 hover:bg-muted/50 text-left"
    >
      <span className="flex items-center gap-2 font-semibold text-sm">
        {collapsible && (openSections[id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        {label}
      </span>
      <span className="tabular-nums font-semibold text-right min-w-[140px]">{fmt(total)}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
      </div>

      <div className="border rounded-md bg-background overflow-hidden">
        {/* A. Pendapatan */}
        <SectionHeader id="A" label="A. Pendapatan" total={totalA} />
        {openSections.A && (
          <>
            <Row label="SALES - POINT OF SALE" value={data.salesPOS} />
            <Row label="Pelunasan Kredit" value={data.pelunasanKredit} />
            <Row label="Pengiriman" value={data.pengirimanIncome} />
            <Row label="Pajak (exclude)" value={data.pajakExclude} />
            <Row label="Pajak (include)" value={data.pajakInclude} />
            <Row label="Pembulatan" value={data.pembulatan} />
            <Row label="Pengembalian" value={data.pengembalian} />
            <Row label="Total Deposit yang ditebus" value={data.depositDitebus} />
          </>
        )}

        {/* B. HPP */}
        <SectionHeader id="B" label="B. Harga Pokok Penjualan" total={totalB} />
        {openSections.B && (
          <>
            <Row label="Total Penjualan (Harga Modal)" value={data.hppPenjualan} />
            <Row label="Total Pengembalian (Harga Modal)" value={data.hppPengembalian} />
          </>
        )}

        {/* C. Laba Kotor */}
        <SectionHeader id="C" label="C. Laba Kotor" total={labaKotor} collapsible={false} />

        {/* D. Pengeluaran */}
        <SectionHeader id="D" label="D. Pengeluaran" total={totalD} />
        {openSections.D && (
          data.expensesByCategory.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4 border-b">No Data</div>
          ) : (
            data.expensesByCategory.map((e) => (
              <Row key={e.category} label={e.category} value={e.amount} />
            ))
          )
        )}

        {/* E. Stok */}
        <SectionHeader id="E" label="E. Stok" total={totalE} />
        {openSections.E && (
          <>
            <Row label="Stok Keluar" value={data.stokKeluar} />
            <Row label="Opname Stok" value={data.opnameStok} />
          </>
        )}

        {/* F. Pembelian */}
        <SectionHeader id="F" label="F. Pembelian" total={totalF} />
        {openSections.F && (
          <>
            <Row label="Diskon" value={data.pembelianDiskon} />
            <Row label="Pengiriman" value={data.pembelianPengiriman} />
            <Row label="Pajak" value={data.pembelianPajak} />
          </>
        )}

        {/* G. Laba Bersih */}
        <div className="grid grid-cols-[1fr_auto] items-center px-4 py-3 bg-muted/50">
          <span className="font-bold text-sm">G. Laba Bersih</span>
          <span className={cn(
            "tabular-nums font-bold text-right min-w-[140px]",
            labaBersih >= 0 ? "text-green-600" : "text-red-600"
          )}>{fmt(labaBersih)}</span>
        </div>
      </div>
    </div>
  );
}
