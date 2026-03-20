import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List, TrendingDown, TrendingUp, Shield } from "lucide-react";
import ListBooking from "./ListBooking";
import IncomeExpenseReport from "./reports/IncomeExpenseReport";
import DepositManagement from "./deposit/DepositManagement";
import NoAccessMessage from "./NoAccessMessage";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { useStore } from "@/contexts/StoreContext";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface TransactionManagementProps {
  userRole: string | null;
  onEditBooking: (booking: any) => void;
  onAddBooking?: () => void;
  onAddDeposit?: () => void;
  depositRefreshTrigger: number;
}

export default function TransactionManagement({ userRole, onEditBooking, onAddBooking, onAddDeposit, depositRefreshTrigger }: TransactionManagementProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { currentStore } = useStore();
  const { isFeatureEnabled, getFeatureInfo } = useStoreFeatures(currentStore?.id);
  const [activeSubTab, setActiveSubTab] = useState("list-booking");
  const isMobile = useIsMobile();

  const hasTransactionAccess = hasAnyPermission([
    "view_bookings", "create_bookings", "edit_bookings",
    "manage_expense", "manage_income"
  ]);

  if (!hasTransactionAccess) {
    return <NoAccessMessage featureName="Transaksi" />;
  }

  const tabs = [
    { key: "list-booking", feature: "transactions.list_booking", label: "List Booking", icon: List },
    { key: "expenses", feature: "transactions.expenses", label: "Pengeluaran", icon: TrendingDown },
    { key: "incomes", feature: "transactions.incomes", label: "Pemasukan", icon: TrendingUp },
    { key: "deposits", feature: "transactions.deposits", label: "Deposit", icon: Shield },
  ].filter(t => isFeatureEnabled(t.feature));

  const currentTab = tabs.some(t => t.key === activeSubTab) ? activeSubTab : tabs[0]?.key;
  const currentTabData = tabs.find(t => t.key === currentTab);

  return (
    <div className="space-y-4">
      <Tabs value={currentTab} onValueChange={setActiveSubTab}>
        {isMobile ? (
          <Select value={currentTab} onValueChange={setActiveSubTab}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                {currentTabData && <currentTabData.icon className="h-4 w-4" />}
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
        ) : (
          <TabsList className="grid w-full max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key}>
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {isFeatureEnabled("transactions.list_booking") && (
          <TabsContent value="list-booking" className="mt-4">
            <ListBooking userRole={userRole} onEditBooking={onEditBooking} onAddBooking={onAddBooking} />
          </TabsContent>
        )}

        {isFeatureEnabled("transactions.expenses") && (
          <TabsContent value="expenses" className="mt-4">
            <IncomeExpenseReport initialTab="expenses" showAddButton hideDateFilter />
          </TabsContent>
        )}

        {isFeatureEnabled("transactions.incomes") && (
          <TabsContent value="incomes" className="mt-4">
            <IncomeExpenseReport initialTab="incomes" showAddButton hideDateFilter />
          </TabsContent>
        )}

        {isFeatureEnabled("transactions.deposits") && (
          <TabsContent value="deposits" className="mt-4">
            <DepositManagement refreshTrigger={depositRefreshTrigger} onAddDeposit={onAddDeposit} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
