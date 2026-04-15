import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "../ReportDateFilter";
import { DateRange } from "react-day-picker";

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

export default function BalanceSheet() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  const [assetSections, setAssetSections] = useState<GroupedSection[]>([]);
  const [liabilitySections, setLiabilitySections] = useState<GroupedSection[]>([]);
  const [equitySection, setEquitySection] = useState<GroupedSection>({ label: "Modal", accounts: [], subtotal: 0 });
  const [periodIncome, setPeriodIncome] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilitiesEquity, setTotalLiabilitiesEquity] = useState(0);

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

      // Fetch all accounts + period income/expenses in parallel
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

      // Build journal adjustments map (account_id -> net debit-credit)
      const journalAdj: Record<string, number> = {};
      (journalRes.data || []).forEach((line: any) => {
        const prev = journalAdj[line.account_id] || 0;
        journalAdj[line.account_id] = prev + Number(line.debit || 0) - Number(line.credit || 0);
      });

      // We need account IDs to map journal entries - fetch them
      const { data: accountsWithIds } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code")
        .eq("store_id", currentStore.id);
      
      const codeToId: Record<string, string> = {};
      (accountsWithIds || []).forEach(a => { codeToId[a.account_code] = a.id; });

      // Classify accounts by code prefix
      const assetLancar: AccountRow[] = [];
      const assetTidakLancar: AccountRow[] = [];
      const kewajiban: AccountRow[] = [];
      const modal: AccountRow[] = [];

      accounts.forEach(acc => {
        const code = acc.account_code;
        if (code.startsWith("1")) {
          // 11xxx = Aset Lancar, 12xxx+ = Aset Tidak Lancar
          if (code.startsWith("11")) {
            assetLancar.push(acc);
          } else {
            assetTidakLancar.push(acc);
          }
        } else if (code.startsWith("2")) {
          kewajiban.push(acc);
        } else if (code.startsWith("3")) {
          modal.push(acc);
        }
      });

      const getAmount = (acc: AccountRow) => {
        const id = codeToId[acc.account_code];
        const adj = id ? (journalAdj[id] || 0) : 0;
        return Number(acc.opening_balance || 0) + adj;
      };

      const buildSection = (label: string, accs: AccountRow[]): GroupedSection => {
        const items = accs.map(a => ({
          code: a.account_code,
          name: a.account_name,
          amount: getAmount(a),
        }));
        return { label, accounts: items, subtotal: items.reduce((s, i) => s + i.amount, 0) };
      };

      const asetLancarSection = buildSection("Aset Lancar", assetLancar);
      const asetTidakLancarSection = buildSection("Aset Tidak Lancar", assetTidakLancar);
      const kewajibanSection = buildSection("Kewajiban", kewajiban);
      const modalSection = buildSection("Modal", modal);

      // Calculate period income
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Per {getDateRangeDisplay(timeRange, customDateRange)}</p>
        <ReportDateFilter
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border rounded-lg overflow-hidden text-sm">
        {/* LEFT: Aset */}
        <div className="border-r">
          <div className="bg-sky-500 text-white text-center font-bold py-2">Aset</div>
          <div className="p-4 space-y-1">
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
          </div>
        </div>

        {/* RIGHT: Kewajiban dan Modal */}
        <div>
          <div className="bg-sky-500 text-white text-center font-bold py-2">Kewajiban dan Modal</div>
          <div className="p-4 space-y-1">
            {/* Kewajiban */}
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

            {/* Modal */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
