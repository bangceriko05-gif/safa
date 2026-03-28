import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign } from "lucide-react";
import ListBooking from "./ListBooking";
import IncomeExpenseReport from "./reports/IncomeExpenseReport";
import PurchaseManagement from "./purchase/PurchaseManagement";
import ExpenseTransactionView from "./expense/ExpenseTransactionView";
import NoAccessMessage from "./NoAccessMessage";
import FeatureInactiveNotice from "./FeatureInactiveNotice";
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

const ALL_TABS = [
  { key: "list-booking", feature: "transactions.list_booking", label: "Penjualan", icon: TrendingUp },
  { key: "purchases", feature: "transactions.purchases", label: "Pembelian", icon: ShoppingCart },
  { key: "expenses", feature: "transactions.expenses", label: "Pengeluaran", icon: TrendingDown },
  { key: "incomes", feature: "transactions.incomes", label: "Pemasukan", icon: DollarSign },
];

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

  const currentTab = ALL_TABS.some(t => t.key === activeSubTab) ? activeSubTab : ALL_TABS[0]?.key;
  const currentTabData = ALL_TABS.find(t => t.key === currentTab);

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
              {ALL_TABS.map(tab => (
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
          <TabsList className="grid w-full max-w-2xl" style={{ gridTemplateColumns: `repeat(${ALL_TABS.length}, 1fr)` }}>
            {ALL_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key}>
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="list-booking" className="mt-4">
          {isFeatureEnabled("transactions.list_booking") ? (
            <ListBooking userRole={userRole} onEditBooking={onEditBooking} onAddBooking={onAddBooking} />
          ) : (
            <FeatureInactiveNotice featureName="Penjualan" icon={TrendingUp} price={getFeatureInfo("transactions.list_booking").price} description={getFeatureInfo("transactions.list_booking").description} />
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          {isFeatureEnabled("transactions.purchases") ? (
            <PurchaseManagement />
          ) : (
            <FeatureInactiveNotice featureName="Pembelian" icon={ShoppingCart} price={getFeatureInfo("transactions.purchases").price} description={getFeatureInfo("transactions.purchases").description} />
          )}
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          {isFeatureEnabled("transactions.expenses") ? (
            <ExpenseTransactionView />
          ) : (
            <FeatureInactiveNotice featureName="Pengeluaran" icon={TrendingDown} price={getFeatureInfo("transactions.expenses").price} description={getFeatureInfo("transactions.expenses").description} />
          )}
        </TabsContent>

        <TabsContent value="incomes" className="mt-4">
          {isFeatureEnabled("transactions.incomes") ? (
            <IncomeExpenseReport initialTab="incomes" showAddButton hideDateFilter />
          ) : (
            <FeatureInactiveNotice featureName="Pemasukan" icon={DollarSign} price={getFeatureInfo("transactions.incomes").price} description={getFeatureInfo("transactions.incomes").description} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
