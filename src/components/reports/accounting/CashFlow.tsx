import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  ChevronsLeft,
  ChevronsRight,
  FileText,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addMonths,
  subMonths,
  addYears,
  subYears,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CashFlowDetailView, { type CashFlowDetailType } from "./CashFlowDetailView";

type FilterMode = "custom" | "month" | "year";

const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","Mei","Jun",
  "Jul","Agt","Sep","Okt","Nov","Des",
];

const formatAmount = (amount: number): string => {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (amount < 0) return `(${formatted})`;
  return formatted;
};

// Month picker inline
function MonthPickerInline({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(subMonths(value, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setViewYear(value.getFullYear());
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-sm font-medium">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(value, "MMMM yyyy", { locale: localeId })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-3 pointer-events-auto" align="center">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => y - 1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => y + 1)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const isSelected =
                viewYear === value.getFullYear() && idx === value.getMonth();
              return (
                <Button
                  key={name}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    onChange(new Date(viewYear, idx, 1));
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(addMonths(value, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface CashFlowData {
  openingBalance: number;
  // Aktivitas Operasional
  penerimaanPelanggan: number;
  pembayaranPemasok: number;
  biayaOperasional: number;
  biayaPerawatan: number;
  pendapatanLain: number;
  pengeluaranLain: number;
  // Aktivitas Investasi
  pembelianAsetTetap: number;
  pembelianAsetTakBerwujud: number;
  aktivitasInvestasiLain: number;
  // Aktivitas Pendanaan
  pembayaranPinjaman: number;
  penambahanModal: number;
}

export default function CashFlow() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>();
  const [activeDetail, setActiveDetail] = useState<CashFlowDetailType | null>(null);
  const [data, setData] = useState<CashFlowData>({
    openingBalance: 0,
    penerimaanPelanggan: 0,
    pembayaranPemasok: 0,
    biayaOperasional: 0,
    biayaPerawatan: 0,
    pendapatanLain: 0,
    pengeluaranLain: 0,
    pembelianAsetTetap: 0,
    pembelianAsetTakBerwujud: 0,
    aktivitasInvestasiLain: 0,
    pembayaranPinjaman: 0,
    penambahanModal: 0,
  });

  const { startDate, endDate } = useMemo(() => {
    if (filterMode === "custom" && customDateRange?.from) {
      return {
        startDate: customDateRange.from,
        endDate: customDateRange.to || customDateRange.from,
      };
    }
    if (filterMode === "year") {
      return {
        startDate: startOfYear(selectedYear),
        endDate: endOfYear(selectedYear),
      };
    }
    return {
      startDate: startOfMonth(selectedMonth),
      endDate: endOfMonth(selectedMonth),
    };
  }, [filterMode, selectedMonth, selectedYear, customDateRange]);

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, startDate, endDate]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // 1. Opening balance: sum of chart_of_accounts where classification = 'Kas & Bank'
      const { data: coaData } = await supabase
        .from("chart_of_accounts")
        .select("opening_balance")
        .eq("store_id", currentStore.id)
        .eq("classification", "Kas & Bank")
        .eq("is_active", true);

      const coaOpeningBalance = (coaData || []).reduce(
        (sum, a) => sum + (Number(a.opening_balance) || 0),
        0
      );

      // 2. Transactions BEFORE start date to calculate running opening balance
      const beforeStartStr = format(
        new Date(startDate.getTime() - 86400000),
        "yyyy-MM-dd"
      );

      const [bookingsBefore, incomesBefore, expensesBefore, payablesBefore] =
        await Promise.all([
          supabase
            .from("bookings")
            .select("price, price_2")
            .eq("store_id", currentStore.id)
            .lte("date", beforeStartStr)
            .in("status", ["CI", "CO"]),
          supabase
            .from("incomes")
            .select("amount")
            .eq("store_id", currentStore.id)
            .lte("date", beforeStartStr),
          supabase
            .from("expenses")
            .select("amount")
            .eq("store_id", currentStore.id)
            .lte("date", beforeStartStr),
          supabase
            .from("accounts_payable")
            .select("paid_amount")
            .eq("store_id", currentStore.id)
            .lte(
              "created_at",
              format(new Date(startDate.getTime() - 86400000), "yyyy-MM-dd'T'23:59:59")
            ),
        ]);

      const priorBookings = (bookingsBefore.data || []).reduce(
        (s, b) => s + (Number(b.price) || 0) + (Number(b.price_2) || 0),
        0
      );
      const priorIncomes = (incomesBefore.data || []).reduce(
        (s, i) => s + (Number(i.amount) || 0),
        0
      );
      const priorExpenses = (expensesBefore.data || []).reduce(
        (s, e) => s + (Number(e.amount) || 0),
        0
      );
      const priorPayables = (payablesBefore.data || []).reduce(
        (s, p) => s + (Number(p.paid_amount) || 0),
        0
      );

      const openingBalance =
        coaOpeningBalance + priorBookings + priorIncomes - priorExpenses - priorPayables;

      // 3. Current period transactions
      const [bookingsRes, incomesRes, expensesRes, payablesRes, assetsRes, investorRes] =
        await Promise.all([
          supabase
            .from("bookings")
            .select("price, price_2")
            .eq("store_id", currentStore.id)
            .gte("date", startStr)
            .lte("date", endStr)
            .in("status", ["CI", "CO"]),
          supabase
            .from("incomes")
            .select("amount, category")
            .eq("store_id", currentStore.id)
            .gte("date", startStr)
            .lte("date", endStr),
          supabase
            .from("expenses")
            .select("amount, category")
            .eq("store_id", currentStore.id)
            .gte("date", startStr)
            .lte("date", endStr),
          supabase
            .from("accounts_payable")
            .select("paid_amount")
            .eq("store_id", currentStore.id)
            .gte("created_at", `${startStr}T00:00:00`)
            .lte("created_at", `${endStr}T23:59:59`),
          supabase
            .from("assets")
            .select("purchase_price, category")
            .eq("store_id", currentStore.id)
            .gte("created_at", `${startStr}T00:00:00`)
            .lte("created_at", `${endStr}T23:59:59`),
          supabase
            .from("investor_transfers")
            .select("amount")
            .eq("store_id", currentStore.id)
            .gte("transfer_date", startStr)
            .lte("transfer_date", endStr),
        ]);

      const penerimaanPelanggan = (bookingsRes.data || []).reduce(
        (s, b) => s + (Number(b.price) || 0) + (Number(b.price_2) || 0),
        0
      );

      // Split incomes into "pendapatan lain"
      const pendapatanLain = (incomesRes.data || []).reduce(
        (s, i) => s + (Number(i.amount) || 0),
        0
      );

      // Split expenses: operational vs other
      const allExpenses = expensesRes.data || [];
      const biayaOperasional = allExpenses
        .filter((e) => {
          const cat = (e.category || "").toLowerCase();
          return !cat.includes("lain") && !cat.includes("perawatan");
        })
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

      const biayaPerawatan = allExpenses
        .filter((e) => {
          const cat = (e.category || "").toLowerCase();
          return cat.includes("perawatan");
        })
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

      const pengeluaranLain = allExpenses
        .filter((e) => {
          const cat = (e.category || "").toLowerCase();
          return cat.includes("lain");
        })
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

      const pembayaranPemasok = (payablesRes.data || []).reduce(
        (s, p) => s + (Number(p.paid_amount) || 0),
        0
      );

      // Assets purchased this period
      const pembelianAsetTetap = (assetsRes.data || []).reduce(
        (s, a) => s + (Number(a.purchase_price) || 0),
        0
      );

      // Investor transfers = capital changes
      const penambahanModal = (investorRes.data || []).reduce(
        (s, t) => s + (Number(t.amount) || 0),
        0
      );

      setData({
        openingBalance,
        penerimaanPelanggan,
        pembayaranPemasok,
        biayaOperasional,
        biayaPerawatan,
        pendapatanLain,
        pengeluaranLain,
        pembelianAsetTetap,
        pembelianAsetTakBerwujud: 0,
        aktivitasInvestasiLain: 0,
        pembayaranPinjaman: 0,
        penambahanModal,
      });
    } catch (error) {
      console.error("Error fetching cash flow:", error);
      toast.error("Gagal memuat data arus kas");
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const subtotalOperasional =
    data.penerimaanPelanggan -
    data.pembayaranPemasok -
    data.biayaOperasional -
    data.biayaPerawatan +
    data.pendapatanLain -
    data.pengeluaranLain;

  const subtotalInvestasi =
    -data.pembelianAsetTetap -
    data.pembelianAsetTakBerwujud +
    data.aktivitasInvestasiLain;

  const subtotalPendanaan =
    data.pembayaranPinjaman - data.penambahanModal;

  const totalKenaikanPenurunan =
    subtotalOperasional + subtotalInvestasi + subtotalPendanaan;

  const saldoKasAkhir = data.openingBalance + totalKenaikanPenurunan;

  // PDF export placeholder
  const handleExportPDF = () => {
    toast.info("Fitur export PDF akan segera tersedia");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex flex-col items-center gap-2">
          {filterMode === "month" && (
            <MonthPickerInline value={selectedMonth} onChange={setSelectedMonth} />
          )}
          {filterMode === "year" && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedYear(subYears(selectedYear, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {format(selectedYear, "yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedYear(addYears(selectedYear, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {filterMode === "custom" && customDateRange?.from && (
            <span className="text-sm font-medium">
              {format(customDateRange.from, "dd MMM yyyy", { locale: localeId })}
              {customDateRange.to &&
                ` - ${format(customDateRange.to, "dd MMM yyyy", { locale: localeId })}`}
            </span>
          )}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={filterMode === "custom" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none text-xs h-8 px-3"
                  onClick={() => {
                    setFilterMode("custom");
                    setPendingDateRange(customDateRange);
                    setShowCustomPicker(true);
                  }}
                >
                  Sesuaikan
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="flex flex-col">
                  <Calendar
                    mode="range"
                    selected={pendingDateRange}
                    onSelect={setPendingDateRange}
                    defaultMonth={pendingDateRange?.from || new Date()}
                    initialFocus
                    numberOfMonths={2}
                    locale={localeId}
                    className="p-3 pointer-events-auto"
                  />
                  <div className="flex justify-end p-3 pt-0 border-t">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (pendingDateRange?.from) {
                          setCustomDateRange(pendingDateRange);
                          setFilterMode("custom");
                          setShowCustomPicker(false);
                        }
                      }}
                      disabled={!pendingDateRange?.from}
                    >
                      OK
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant={filterMode === "month" ? "default" : "ghost"}
              size="sm"
              className="rounded-none text-xs h-8 px-3"
              onClick={() => setFilterMode("month")}
            >
              Bulan
            </Button>
            <Button
              variant={filterMode === "year" ? "default" : "ghost"}
              size="sm"
              className="rounded-none text-xs h-8 px-3"
              onClick={() => setFilterMode("year")}
            >
              Tahun
            </Button>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF}>
          <FileText className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* === SALDO KAS AWAL === */}
      <SectionHeader label="Saldo kas awal" color="sky" />
      <Row
        label="Total Saldo kas awal"
        amount={data.openingBalance}
        bold
        className="bg-muted/40"
      />

      {/* === ARUS KAS === */}
      <SectionHeader label="Arus Kas" color="green" className="mt-4" />

      {/* Aktivitas Operasional */}
      <SubSectionTitle label="Aktivitas operasional" />
      <Row label="Penerimaan dari pelanggan" amount={data.penerimaanPelanggan} indent onClick={() => setActiveDetail("penerimaan_pelanggan")} />
      <Row label="Pembayaran ke pemasok" amount={-data.pembayaranPemasok} indent negative onClick={() => setActiveDetail("pembayaran_pemasok")} />
      <Row label="Biaya operasional" amount={-data.biayaOperasional} indent negative onClick={() => setActiveDetail("biaya_operasional")} />
      <Row label="Biaya perawatan" amount={-data.biayaPerawatan} indent negative onClick={() => setActiveDetail("biaya_perawatan")} />
      <Row label="Pendapatan lain" amount={data.pendapatanLain} indent onClick={() => setActiveDetail("pendapatan_lain")} />
      <Row label="Pengeluaran lain" amount={-data.pengeluaranLain} indent negative onClick={() => setActiveDetail("pengeluaran_lain")} />
      <SubTotalRow label="SubTotal Aktivitas operasional" amount={subtotalOperasional} />

      {/* Aktivitas Investasi */}
      <SubSectionTitle label="Aktivitas Investasi" />
      <Row label="Pendapatan/pengeluaran aset tetap" amount={-data.pembelianAsetTetap} indent onClick={() => setActiveDetail("pembelian_aset_tetap")} />
      <Row label="Pendapatan/pengeluaran aset tidak berwujud" amount={-data.pembelianAsetTakBerwujud} indent onClick={() => setActiveDetail("pembelian_aset_tak_berwujud")} />
      <Row label="Aktivitas investasi lain" amount={data.aktivitasInvestasiLain} indent onClick={() => setActiveDetail("aktivitas_investasi_lain")} />
      <SubTotalRow label="SubTotal Aktivitas Investasi" amount={subtotalInvestasi} />

      {/* Total Pendapatan = SubTotal Operasional + SubTotal Investasi */}
      <Row label="Total Pendapatan" amount={subtotalOperasional + subtotalInvestasi} bold className="bg-primary/10 text-primary font-bold" />

      {/* Aktivitas Pendanaan */}
      <SubSectionTitle label="Aktivitas Pendanaan" />
      <Row label="Pembayaran/penerimaan pinjaman" amount={data.pembayaranPinjaman} indent onClick={() => setActiveDetail("pembayaran_pinjaman")} />
      <Row label="Penambahan/pengambilan modal" amount={-data.penambahanModal} indent onClick={() => setActiveDetail("penambahan_modal")} />
      <SubTotalRow label="SubTotal Aktivitas Pendanaan" amount={subtotalPendanaan} />

      {/* Total Kenaikan / Penurunan */}
      <div className="border-t-2 border-dashed border-primary/40 mt-4" />
      <Row label="Total Kenaikan/penurunan kas" amount={totalKenaikanPenurunan} bold className="bg-primary/10 text-primary font-bold" />

      {/* === SALDO KAS AKHIR === */}
      <SectionHeader label="Saldo kas akhir" color="sky" className="mt-4" />
      <div className="border-t-2 border-dashed border-primary/40" />
      <Row label="Total Saldo kas akhir" amount={saldoKasAkhir} bold className="bg-foreground/5 font-bold" />

      {/* Detail View */}
      {activeDetail && currentStore && (
        <CashFlowDetailView
          detailType={activeDetail}
          storeId={currentStore.id}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setActiveDetail(null)}
        />
      )}
    </div>
  );
}

/* ==========================
   Reusable Row Components
   ========================== */

function SectionHeader({
  label,
  color = "sky",
  className,
}: {
  label: string;
  color?: "sky" | "green";
  className?: string;
}) {
  const bg = color === "green" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <div
      className={cn(
        "text-center py-1.5 text-xs font-semibold text-white tracking-wide",
        bg,
        className
      )}
    >
      {label}
    </div>
  );
}

function SubSectionTitle({ label }: { label: string }) {
  return (
    <div className="py-2 px-4">
      <span className="text-sm font-semibold text-foreground/70 underline decoration-foreground/20 underline-offset-4">
        {label}
      </span>
    </div>
  );
}

function SubTotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 bg-sky-50 dark:bg-sky-900/20 border-y border-sky-200 dark:border-sky-800">
      <span className="text-sm font-semibold text-sky-700 dark:text-sky-300 underline underline-offset-4 decoration-sky-300">
        {label}
      </span>
      <span className="text-sm font-semibold text-right tabular-nums">
        {formatAmount(amount)}
      </span>
    </div>
  );
}

function Row({
  label,
  amount,
  bold = false,
  indent = false,
  negative = false,
  className,
  onClick,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const isNeg = amount < 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 px-4 border-b border-border/50",
        onClick && "cursor-pointer hover:bg-muted/60 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "text-sm",
          indent && "pl-6",
          bold ? "font-bold" : "text-foreground/80",
          indent && "underline decoration-foreground/15 underline-offset-4"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums text-right min-w-[120px]",
          bold && "font-bold",
          isNeg && "text-primary"
        )}
      >
        {formatAmount(amount)}
      </span>
    </div>
  );
}
