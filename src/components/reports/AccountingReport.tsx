import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, TrendingUp, Wallet, BookOpen, CreditCard, HandCoins, Package, Landmark } from "lucide-react";

import BalanceSheet from "./accounting/BalanceSheet";
import ProfitLoss from "./accounting/ProfitLoss";
import CashFlow from "./accounting/CashFlow";
import JournalEntries from "./accounting/JournalEntries";
import AccountsPayable from "./accounting/AccountsPayable";
import AccountsReceivable from "./accounting/AccountsReceivable";
import AssetManagement from "./accounting/AssetManagement";
import BankList from "./accounting/BankList";

type AccountingTab = "balance" | "pl" | "cashflow" | "journal" | "payable" | "receivable" | "assets" | "bank";

export default function AccountingReport() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [activeTab, setActiveTabState] = useState<AccountingTab>(() => {
    const param = searchParams.get("accountingTab");
    return (param as AccountingTab) || "balance";
  });

  const setActiveTab = (tab: AccountingTab) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("accountingTab", tab);
    window.history.replaceState({}, "", `?${params.toString()}`);
  };

  const tabs = [
    { key: "balance" as const, label: "Neraca", icon: Scale },
    { key: "pl" as const, label: "Laba Rugi", icon: TrendingUp },
    { key: "cashflow" as const, label: "Arus Kas", icon: Wallet },
    { key: "journal" as const, label: "Jurnal", icon: BookOpen },
    { key: "payable" as const, label: "Hutang", icon: CreditCard },
    { key: "receivable" as const, label: "Piutang", icon: HandCoins },
    { key: "assets" as const, label: "Aset", icon: Package },
    { key: "bank" as const, label: "List Bank", icon: Landmark },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountingTab)}>
        <TabsList className="flex w-full overflow-x-auto">
          {tabs.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 flex-1 text-xs sm:text-sm">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="balance" className="mt-4"><BalanceSheet /></TabsContent>
        <TabsContent value="pl" className="mt-4"><ProfitLoss /></TabsContent>
        <TabsContent value="cashflow" className="mt-4"><CashFlow /></TabsContent>
        <TabsContent value="journal" className="mt-4"><JournalEntries /></TabsContent>
        <TabsContent value="payable" className="mt-4"><AccountsPayable /></TabsContent>
        <TabsContent value="receivable" className="mt-4"><AccountsReceivable /></TabsContent>
        <TabsContent value="assets" className="mt-4"><AssetManagement /></TabsContent>
        <TabsContent value="bank" className="mt-4"><BankList /></TabsContent>
      </Tabs>
    </div>
  );
}
