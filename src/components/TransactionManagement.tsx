import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, TrendingDown, TrendingUp, Shield } from "lucide-react";
import ListBooking from "./ListBooking";
import IncomeExpenseReport from "./reports/IncomeExpenseReport";
import DepositManagement from "./deposit/DepositManagement";
import { useState } from "react";

interface TransactionManagementProps {
  userRole: string | null;
  onEditBooking: (booking: any) => void;
  depositRefreshTrigger: number;
}

export default function TransactionManagement({ userRole, onEditBooking, depositRefreshTrigger }: TransactionManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState("list-booking");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="list-booking">
            <List className="mr-2 h-4 w-4" />
            List Booking
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <TrendingDown className="mr-2 h-4 w-4" />
            Pengeluaran
          </TabsTrigger>
          <TabsTrigger value="incomes">
            <TrendingUp className="mr-2 h-4 w-4" />
            Pemasukan
          </TabsTrigger>
          <TabsTrigger value="deposits">
            <Shield className="mr-2 h-4 w-4" />
            Deposit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list-booking" className="mt-4">
          <ListBooking userRole={userRole} onEditBooking={onEditBooking} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <IncomeExpenseReport initialTab="expenses" />
        </TabsContent>

        <TabsContent value="incomes" className="mt-4">
          <IncomeExpenseReport initialTab="incomes" />
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <DepositManagement refreshTrigger={depositRefreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
