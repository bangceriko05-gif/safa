import { useEffect, useState } from "react";
import { BarChart3, ShoppingCart, WalletCards, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import TransactionManagement from "./TransactionManagement";

interface DashboardOverviewProps {
  userRole: string | null;
  userName: string;
  searchQuery: string;
  onEditBooking: (booking: any) => void;
  onAddBooking: () => void;
  onAddDeposit: () => void;
  depositRefreshTrigger: number;
}

type Summary = {
  sales: number;
  purchases: number;
  expenses: number;
  customers: number;
};

const initialSummary: Summary = { sales: 0, purchases: 0, expenses: 0, customers: 0 };

export default function DashboardOverview({
  userRole,
  userName,
  searchQuery,
  onEditBooking,
  onAddBooking,
  onAddDeposit,
  depositRefreshTrigger,
}: DashboardOverviewProps) {
  const { currentStore } = useStore();
  const [summary, setSummary] = useState<Summary>(initialSummary);

  useEffect(() => {
    if (!currentStore?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    let active = true;

    Promise.all([
      supabase.from("bookings").select("price,price_2,status").eq("store_id", currentStore.id).eq("date", today),
      supabase.from("booking_orders").select("total_amount,process_status").eq("store_id", currentStore.id).eq("date", today),
      supabase.from("purchases" as any).select("total_amount").eq("store_id", currentStore.id).eq("date", today),
      supabase.from("expenses").select("amount").eq("store_id", currentStore.id).eq("date", today),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", currentStore.id),
    ]).then(([bookingsResult, ordersResult, purchasesResult, expensesResult, customersResult]) => {
      if (!active) return;
      const bookingSales = (bookingsResult.data || []).reduce(
        (sum, row: any) => row.status === "BATAL" ? sum : sum + Number(row.price || 0) + Number(row.price_2 || 0),
        0,
      );
      const orderSales = (ordersResult.data || []).reduce(
        (sum, row: any) => row.process_status === "batal" ? sum : sum + Number(row.total_amount || 0),
        0,
      );
      setSummary({
        sales: bookingSales + orderSales,
        purchases: (purchasesResult.data || []).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0),
        expenses: (expensesResult.data || []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0),
        customers: customersResult.count || 0,
      });
    });

    return () => { active = false; };
  }, [currentStore?.id, depositRefreshTrigger]);

  const cards = [
    { label: "Total Penjualan", value: `Rp ${summary.sales.toLocaleString("id-ID")}`, icon: BarChart3, tone: "sales" },
    { label: "Total Pembelian", value: `Rp ${summary.purchases.toLocaleString("id-ID")}`, icon: ShoppingCart, tone: "purchase" },
    { label: "Total Pengeluaran", value: `Rp ${summary.expenses.toLocaleString("id-ID")}`, icon: WalletCards, tone: "expense" },
    { label: "Total Pelanggan", value: summary.customers.toLocaleString("id-ID"), icon: Users, tone: "customer" },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-foreground">Selamat datang, {userName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola operasional kost dan guest house dengan lebih mudah.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`dashboard-stat dashboard-stat-${tone}`}>
            <div className="dashboard-stat-icon"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-[22px] font-extrabold leading-none text-foreground tabular-nums">{value}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-success"><TrendingUp className="h-3 w-3" /> Data hari ini</p>
            </div>
          </div>
        ))}
      </section>

      <TransactionManagement
        userRole={userRole}
        onEditBooking={onEditBooking}
        onAddBooking={onAddBooking}
        onAddDeposit={onAddDeposit}
        depositRefreshTrigger={depositRefreshTrigger}
        initialSearchQuery={searchQuery}
      />
    </div>
  );
}