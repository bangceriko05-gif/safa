import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, DollarSign, Shield } from "lucide-react";
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
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="list-booking">
            <List className="mr-2 h-4 w-4" />
            List Booking
          </TabsTrigger>
          <TabsTrigger value="income-expense">
            <DollarSign className="mr-2 h-4 w-4" />
            Pengeluaran & Pemasukan
          </TabsTrigger>
          <TabsTrigger value="deposits">
            <Shield className="mr-2 h-4 w-4" />
            Deposit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list-booking" className="mt-4">
          <ListBooking userRole={userRole} onEditBooking={onEditBooking} />
        </TabsContent>

        <TabsContent value="income-expense" className="mt-4">
          <IncomeExpenseReport />
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <DepositManagement refreshTrigger={depositRefreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
