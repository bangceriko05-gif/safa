import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Settings, Rows2, Columns2, ChevronLeft, ChevronRight, CalendarDays, FileText, FileSpreadsheet } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths, addYears, subDays, subMonths, subYears } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AccountRow {
  account_code: string;
  account_name: string;
  classification: string;
  opening_balance: number;
}

interface GroupedSection {
  label: string;
  accounts: { code: string; name: string; amount: number }[];
  subtotal: number;
}

type PeriodMode = "harian" | "bulan" | "tahun";
type LayoutMode = "side" | "stacked";

export default function BalanceSheet() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("bulan");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("side");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [assetSections, setAssetSections] = useState<GroupedSection[]>([]);
  const [liabilitySections, setLiabilitySections] = useState<GroupedSection[]>([]);
  const [equitySection, setEquitySection] = useState<GroupedSection>({ label: "Modal", accounts: [], subtotal: 0 });
  const [periodIncome, setPeriodIncome] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilitiesEquity, setTotalLiabilitiesEquity] = useState(0);

  const getRange = () => {
    if (periodMode === "harian") return { startDate: startOfDay(refDate), endDate: endOfDay(refDate) };
    if (periodMode === "bulan") return { startDate: startOfMonth(refDate), endDate: endOfMonth(refDate) };
    return { startDate: startOfYear(refDate), endDate: endOfYear(refDate) };
  };

  const periodLabel = () => {
    if (periodMode === "harian") return format(refDate, "d MMMM yyyy", { locale: localeId });
    if (periodMode === "bulan") return format(refDate, "MMMM yyyy", { locale: localeId });
    return format(refDate, "yyyy", { locale: localeId });
  };

  const navigatePeriod = (dir: -1 | 1) => {
    if (periodMode === "harian") setRefDate(dir === 1 ? addDays(refDate, 1) : subDays(refDate, 1));
    else if (periodMode === "bulan") setRefDate(dir === 1 ? addMonths(refDate, 1) : subMonths(refDate, 1));
    else setRefDate(dir === 1 ? addYears(refDate, 1) : subYears(refDate, 1));
  };

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore, periodMode, refDate]);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getRange();
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [accountsRes, bookingsRes, incomesRes, expensesRes, journalRes] = await Promise.all([
        supabase
          .from("chart_of_accounts")
          .select("account_code, account_name, classification, opening_balance")
          .eq("store_id", currentStore.id)
          .eq("is_active", true)
          .order("account_code"),
        supabase
          .from("bookings")
          .select("price, price_2, status")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .not("status", "in", '("Cancelled","BATAL")'),
        supabase
          .from("incomes")
          .select("amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("expenses")
          .select("amount")
          .eq("store_id", currentStore.id)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("journal_entry_lines")
          .select("account_id, debit, credit, journal_entry_id")
          .in("journal_entry_id",
            (await supabase
              .from("journal_entries")
              .select("id")
              .eq("store_id", currentStore.id)
              .gte("entry_date", startStr)
              .lte("entry_date", endStr)
            ).data?.map(j => j.id) || []
          ),
      ]);

      const accounts: AccountRow[] = accountsRes.data || [];

      const journalAdj: Record<string, number> = {};
      (journalRes.data || []).forEach((line: any) => {
        const prev = journalAdj[line.account_id] || 0;
        journalAdj[line.account_id] = prev + Number(line.debit || 0) - Number(line.credit || 0);
      });

      const { data: accountsWithIds } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code")
        .eq("store_id", currentStore.id);

      const codeToId: Record<string, string> = {};
      (accountsWithIds || []).forEach(a => { codeToId[a.account_code] = a.id; });

      const assetLancar: AccountRow[] = [];
      const assetTidakLancar: AccountRow[] = [];
      const kewajiban: AccountRow[] = [];
      const modal: AccountRow[] = [];

      accounts.forEach(acc => {
        const code = acc.account_code;
        if (code.startsWith("1")) {
          if (code.startsWith("11")) assetLancar.push(acc);
          else assetTidakLancar.push(acc);
        } else if (code.startsWith("2")) kewajiban.push(acc);
        else if (code.startsWith("3")) modal.push(acc);
      });

      const getAmount = (acc: AccountRow) => {
        const id = codeToId[acc.account_code];
        const adj = id ? (journalAdj[id] || 0) : 0;
        return Number(acc.opening_balance || 0) + adj;
      };

      const buildSection = (label: string, accs: AccountRow[]): GroupedSection => {
        const items = accs.map(a => ({ code: a.account_code, name: a.account_name, amount: getAmount(a) }));
        return { label, accounts: items, subtotal: items.reduce((s, i) => s + i.amount, 0) };
      };

      const asetLancarSection = buildSection("Aset Lancar", assetLancar);
      const asetTidakLancarSection = buildSection("Aset Tidak Lancar", assetTidakLancar);
      const kewajibanSection = buildSection("Kewajiban", kewajiban);
      const modalSection = buildSection("Modal", modal);

      const bookingRev = (bookingsRes.data || []).reduce((s, b) => s + (Number(b.price) || 0) + (Number(b.price_2) || 0), 0);
      const otherIncome = (incomesRes.data || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const totalExp = (expensesRes.data || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netIncome = bookingRev + otherIncome - totalExp;

      const tAssets = asetLancarSection.subtotal + asetTidakLancarSection.subtotal;
      const tLiabEquity = kewajibanSection.subtotal + modalSection.subtotal + netIncome;

      setAssetSections([asetLancarSection, asetTidakLancarSection]);
      setLiabilitySections([kewajibanSection]);
      setEquitySection(modalSection);
      setPeriodIncome(netIncome);
      setTotalAssets(tAssets);
      setTotalLiabilitiesEquity(tLiabEquity);
    } catch (error) {
      console.error("Error fetching balance sheet:", error);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (amount: number) => {
    if (amount < 0) {
      return `(${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount))})`;
    }
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Neraca", 14, 15);
    doc.setFontSize(10);
    doc.text(`Per ${periodLabel()}`, 14, 22);

    const rows: any[] = [];
    assetSections.forEach(sec => {
      rows.push([{ content: sec.label, colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);
      sec.accounts.forEach(a => rows.push([`${a.code} - ${a.name}`, fmt(a.amount)]));
      rows.push([{ content: `SubTotal ${sec.label}`, styles: { fontStyle: "bold" } }, { content: fmt(sec.subtotal), styles: { fontStyle: "bold" } }]);
    });
    rows.push([{ content: "Total Aset", styles: { fontStyle: "bold", fillColor: [219, 234, 254] } }, { content: fmt(totalAssets), styles: { fontStyle: "bold", fillColor: [219, 234, 254] } }]);

    autoTable(doc, { startY: 28, head: [["Aset", "Jumlah"]], body: rows, theme: "grid", headStyles: { fillColor: [14, 165, 233] } });

    const rows2: any[] = [];
    liabilitySections.forEach(sec => {
      rows2.push([{ content: sec.label, colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);
      sec.accounts.forEach(a => rows2.push([`${a.code} - ${a.name}`, fmt(a.amount)]));
      rows2.push([{ content: `SubTotal ${sec.label}`, styles: { fontStyle: "bold" } }, { content: fmt(sec.subtotal), styles: { fontStyle: "bold" } }]);
    });
    rows2.push([{ content: "Modal", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);
    equitySection.accounts.forEach(a => rows2.push([`${a.code} - ${a.name}`, fmt(a.amount)]));
    rows2.push(["Pendapatan periode ini", fmt(periodIncome)]);
    rows2.push([{ content: "SubTotal Modal", styles: { fontStyle: "bold" } }, { content: fmt(equitySection.subtotal + periodIncome), styles: { fontStyle: "bold" } }]);
    rows2.push([{ content: "Total Kewajiban dan Modal", styles: { fontStyle: "bold", fillColor: [219, 234, 254] } }, { content: fmt(totalLiabilitiesEquity), styles: { fontStyle: "bold", fillColor: [219, 234, 254] } }]);

    autoTable(doc, { head: [["Kewajiban dan Modal", "Jumlah"]], body: rows2, theme: "grid", headStyles: { fillColor: [14, 165, 233] } });

    doc.save(`Neraca-${periodLabel()}.pdf`);
  };

  const exportExcel = () => {
    const data: any[][] = [["Neraca"], [`Per ${periodLabel()}`], [], ["Aset", "Jumlah"]];
    assetSections.forEach(sec => {
      data.push([sec.label, ""]);
      sec.accounts.forEach(a => data.push([`${a.code} - ${a.name}`, a.amount]));
      data.push([`SubTotal ${sec.label}`, sec.subtotal]);
    });
    data.push(["Total Aset", totalAssets]);
    data.push([], ["Kewajiban dan Modal", "Jumlah"]);
    liabilitySections.forEach(sec => {
      data.push([sec.label, ""]);
      sec.accounts.forEach(a => data.push([`${a.code} - ${a.name}`, a.amount]));
      data.push([`SubTotal ${sec.label}`, sec.subtotal]);
    });
    data.push(["Modal", ""]);
    equitySection.accounts.forEach(a => data.push([`${a.code} - ${a.name}`, a.amount]));
    data.push(["Pendapatan periode ini", periodIncome]);
    data.push(["SubTotal Modal", equitySection.subtotal + periodIncome]);
    data.push(["Total Kewajiban dan Modal", totalLiabilitiesEquity]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Neraca");
    XLSX.writeFile(wb, `Neraca-${periodLabel()}.xlsx`);
  };

  const renderAssets = () => (
    <>
      {assetSections.map((section, si) => (
        <div key={si} className="mb-2">
          <div className="font-semibold text-muted-foreground mb-1">{section.label}</div>
          {section.accounts.map((acc, ai) => (
            <div key={ai} className="flex justify-between py-0.5 pl-4">
              <span>{acc.code} - {acc.name}</span>
              <span className="font-medium tabular-nums">{fmt(acc.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 mt-1 bg-muted/50 px-2 rounded font-semibold text-muted-foreground">
            <span>SubTotal {section.label}</span>
            <span className="tabular-nums">{fmt(section.subtotal)}</span>
          </div>
        </div>
      ))}
      <div className="flex justify-between py-2 mt-2 border-t-2 border-dashed border-sky-500 font-bold bg-sky-50 dark:bg-sky-950/30 px-2 rounded">
        <span>Total Aset</span>
        <span className="tabular-nums">{fmt(totalAssets)}</span>
      </div>
    </>
  );

  const renderLiabilitiesEquity = () => (
    <>
      {liabilitySections.map((section, si) => (
        <div key={si} className="mb-2">
          <div className="font-semibold text-muted-foreground mb-1">{section.label}</div>
          {section.accounts.map((acc, ai) => (
            <div key={ai} className="flex justify-between py-0.5 pl-4">
              <span>{acc.code} - {acc.name}</span>
              <span className="font-medium tabular-nums">{fmt(acc.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 mt-1 bg-muted/50 px-2 rounded font-semibold text-muted-foreground">
            <span>SubTotal Kewajiban</span>
            <span className="tabular-nums">{fmt(section.subtotal)}</span>
          </div>
        </div>
      ))}
      <div className="mb-2">
        <div className="font-semibold text-muted-foreground mb-1">Modal</div>
        {equitySection.accounts.map((acc, ai) => (
          <div key={ai} className="flex justify-between py-0.5 pl-4">
            <span>{acc.code} - {acc.name}</span>
            <span className="font-medium tabular-nums">{fmt(acc.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between py-0.5 pl-4">
          <span>Pendapatan periode ini</span>
          <span className="font-medium tabular-nums">{fmt(periodIncome)}</span>
        </div>
        <div className="flex justify-between py-1 mt-1 bg-muted/50 px-2 rounded font-semibold text-muted-foreground">
          <span>SubTotal Modal</span>
          <span className="tabular-nums">{fmt(equitySection.subtotal + periodIncome)}</span>
        </div>
      </div>
      <div className="flex justify-between py-2 mt-2 border-t-2 border-dashed border-sky-500 font-bold bg-sky-50 dark:bg-sky-950/30 px-2 rounded">
        <span>Total Kewajiban dan Modal</span>
        <span className="tabular-nums">{fmt(totalLiabilitiesEquity)}</span>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
        {/* Left: settings + layout toggle */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setLayoutMode("side")}
              className={cn("px-3 py-2 transition-colors", layoutMode === "side" ? "bg-sky-500 text-white" : "bg-background hover:bg-muted")}
              title="Tampilan berdampingan"
            >
              <Columns2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode("stacked")}
              className={cn("px-3 py-2 transition-colors border-l", layoutMode === "stacked" ? "bg-sky-500 text-white" : "bg-background hover:bg-muted")}
              title="Tampilan bertumpuk"
            >
              <Rows2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center: date navigation + mode tabs */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigatePeriod(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="center">
                <Calendar
                  mode="single"
                  selected={refDate}
                  onSelect={(d) => { if (d) { setRefDate(d); setDatePickerOpen(false); } }}
                  locale={localeId}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="font-medium min-w-[120px] text-center">{periodLabel()}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigatePeriod(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex border rounded-md overflow-hidden text-sm">
            {(["harian", "bulan", "tahun"] as PeriodMode[]).map(m => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={cn(
                  "px-4 py-1.5 transition-colors capitalize",
                  m !== "harian" && "border-l",
                  periodMode === m ? "bg-sky-500 text-white" : "bg-background hover:bg-muted"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Right: PDF + Excel */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <FileText className="h-4 w-4 text-red-500" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            EXCEL
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : layoutMode === "side" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border rounded-lg overflow-hidden text-sm">
          <div className="border-r">
            <div className="bg-sky-500 text-white text-center font-bold py-2">Aset</div>
            <div className="p-4 space-y-1">{renderAssets()}</div>
          </div>
          <div>
            <div className="bg-sky-500 text-white text-center font-bold py-2">Kewajiban dan Modal</div>
            <div className="p-4 space-y-1">{renderLiabilitiesEquity()}</div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-sky-500 text-white text-center font-bold py-2">Aset</div>
          <div className="p-4 space-y-1">{renderAssets()}</div>
          <div className="bg-sky-500 text-white text-center font-bold py-2">Kewajiban dan Modal</div>
          <div className="p-4 space-y-1">{renderLiabilitiesEquity()}</div>
        </div>
      )}
    </div>
  );
}
