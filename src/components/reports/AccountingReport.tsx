import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, TrendingUp, Wallet, BookOpen, CreditCard, HandCoins, Package, Landmark, ListTree, ShoppingCart, ClipboardList } from "lucide-react";

import BalanceSheet from "./accounting/BalanceSheet";
import ProfitLoss from "./accounting/ProfitLoss";
import CashFlow from "./accounting/CashFlow";
import JournalEntries from "./accounting/JournalEntries";
import AccountsPayable from "./accounting/AccountsPayable";
import AccountsReceivable from "./accounting/AccountsReceivable";
import AssetManagement from "./accounting/AssetManagement";
import BankList from "./accounting/BankList";
import ChartOfAccountsList from "./accounting/ChartOfAccountsList";
import AccountingTransactions from "./accounting/AccountingTransactions";
import AccountingActivityLog from "./accounting/AccountingActivityLog";

type AccountingTab = "transaksi" | "balance" | "pl" | "cashflow" | "journal" | "payable" | "receivable" | "assets" | "bank" | "coa" | "log";

const tabs: { key: AccountingTab; label: string; icon: React.ElementType }[] = [
  { key: "transaksi", label: "Transaksi", icon: ShoppingCart },
  { key: "balance", label: "Neraca", icon: Scale },
  { key: "pl", label: "Laba Rugi", icon: TrendingUp },
  { key: "cashflow", label: "Arus Kas", icon: Wallet },
  { key: "journal", label: "Jurnal", icon: BookOpen },
  { key: "payable", label: "Hutang", icon: CreditCard },
  { key: "receivable", label: "Piutang", icon: HandCoins },
  { key: "assets", label: "Aset", icon: Package },
  { key: "bank", label: "List Bank", icon: Landmark },
  { key: "coa", label: "Daftar Akun", icon: ListTree },
  { key: "log", label: "Log Aktivitas", icon: ClipboardList },
];

const COMPONENTS: Record<AccountingTab, React.ComponentType> = {
  transaksi: AccountingTransactions,
  balance: BalanceSheet,
  pl: ProfitLoss,
  cashflow: CashFlow,
  journal: JournalEntries,
  payable: AccountsPayable,
  receivable: AccountsReceivable,
  assets: AssetManagement,
  bank: BankList,
  coa: ChartOfAccountsList,
  log: AccountingActivityLog,
};

export default function AccountingReport() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [activeTab, setActiveTabState] = useState<AccountingTab>(() => {
    const param = searchParams.get("accountingTab");
    return (param as AccountingTab) || "transaksi";
  });

  const setActiveTab = (tab: AccountingTab) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("accountingTab", tab);
    window.history.replaceState({}, "", `?${params.toString()}`);
  };

  const activeTabData = tabs.find(t => t.key === activeTab);
  const ActiveIcon = activeTabData?.icon;
  const ActiveComponent = COMPONENTS[activeTab];

  return (
    <div className="space-y-4 font-jakarta antialiased">
      <Select value={activeTab} onValueChange={(v) => setActiveTab(v as AccountingTab)}>
        <SelectTrigger className="w-[220px]">
          <div className="flex items-center gap-2">
            {ActiveIcon && <ActiveIcon className="h-4 w-4" />}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {tabs.map(tab => (
            <SelectItem key={tab.key} value={tab.key}>
              <div className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-4">
        <ActiveComponent />
      </div>
    </div>
  );
}
