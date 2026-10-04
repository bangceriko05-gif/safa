import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Search, CalendarIcon, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { lazy, Suspense } from "react";
import ListBooking from "./ListBooking";
const ExpenseTransactionView = lazyWithRetry(() => import("./expense/ExpenseTransactionView"));
const IncomeTransactionView = lazyWithRetry(() => import("./income/IncomeTransactionView"));
const PurchaseManagement = lazyWithRetry(() => import("./purchase/PurchaseManagement"));
import NoAccessMessage from "./NoAccessMessage";
import AnkaLoader from "./AnkaLoader";
import FeatureInactiveNotice from "./FeatureInactiveNotice";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { useStore } from "@/contexts/StoreContext";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReportTimeRange, getDateRangeDisplay } from "./reports/ReportDateFilter";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TransactionManagementProps {
  userRole: string | null;
  onEditBooking: (booking: any) => void;
  onAddBooking?: () => void;
  onAddDeposit?: () => void;
  depositRefreshTrigger: number;
  initialSearchQuery?: string;
}

const ALL_TABS = [
  { key: "list-booking", feature: "transactions.list_booking", label: "Penjualan", icon: TrendingUp },
  { key: "purchases", feature: "transactions.purchases", label: "Pembelian", icon: ShoppingCart },
  { key: "expenses", feature: "transactions.expenses", label: "Pengeluaran", icon: TrendingDown },
  { key: "incomes", feature: "transactions.incomes", label: "Pemasukan", icon: DollarSign },
];

export default function TransactionManagement({ userRole, onEditBooking, onAddBooking, onAddDeposit, depositRefreshTrigger, initialSearchQuery = "" }: TransactionManagementProps) {
  const { hasPermission, hasAnyPermission, loading: permLoading } = usePermissions();
  const { currentStore } = useStore();
  const { isFeatureEnabled, getFeatureInfo } = useStoreFeatures(currentStore?.id);
  const [activeSubTab, setActiveSubTab] = useState("list-booking");
  const isMobile = useIsMobile();

  // Shared date filter & search state
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>(undefined);

  const effectiveSearchQuery = initialSearchQuery || searchQuery;

  const hasTransactionAccess = hasAnyPermission([
    "view_bookings", "create_bookings", "edit_bookings",
    "manage_expense", "manage_income"
  ]);

  if (permLoading) {
    return <AnkaLoader />;
  }
  if (!hasTransactionAccess) {
    return <NoAccessMessage featureName="Transaksi" />;
  }

  const currentTab = ALL_TABS.some(t => t.key === activeSubTab) ? activeSubTab : ALL_TABS[0]?.key;
  const currentTabData = ALL_TABS.find(t => t.key === currentTab);

  const handleDateFilterChange = (filter: ReportTimeRange) => {
    if (filter === "custom") {
      setPendingDateRange(customDateRange);
      setCalendarOpen(true);
    }
    setTimeRange(filter);
  };

  const handleCustomDateConfirm = () => {
    if (pendingDateRange?.from) {
      setCustomDateRange(pendingDateRange);
      setCalendarOpen(false);
    }
  };

  const dateRangeLabel = getDateRangeDisplay(timeRange, customDateRange);

  return (
    <div className="dashboard-transactions space-y-3">
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
          <TabsList className="grid h-11 w-full max-w-[630px] rounded-lg border bg-card p-1 shadow-sm" style={{ gridTemplateColumns: `repeat(${ALL_TABS.length}, 1fr)` }}>
            {ALL_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="h-9 rounded-md text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {/* Shared Date Filter & Search */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
          {isMobile ? (
            <Select value={timeRange} onValueChange={(v) => handleDateFilterChange(v as ReportTimeRange)}>
              <SelectTrigger className="w-[160px]">
                <CalendarIcon className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="thisMonth">Bulan Ini</SelectItem>
                <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
                <SelectItem value="allTime">All Time</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" onClick={() => handleDateFilterChange("today")} className={cn(timeRange === "today" && "bg-primary text-primary-foreground")}>Hari Ini</Button>
              <Button variant="outline" size="sm" onClick={() => handleDateFilterChange("yesterday")} className={cn(timeRange === "yesterday" && "bg-primary text-primary-foreground")}>Kemarin</Button>
              <Button variant="outline" size="sm" onClick={() => handleDateFilterChange("thisMonth")} className={cn(timeRange === "thisMonth" && "bg-primary text-primary-foreground")}>Bulan Ini</Button>
              <Button variant="outline" size="sm" onClick={() => handleDateFilterChange("lastMonth")} className={cn(timeRange === "lastMonth" && "bg-primary text-primary-foreground")}>Bulan Lalu</Button>
              <Button variant="outline" size="sm" onClick={() => handleDateFilterChange("allTime")} className={cn("gap-1", timeRange === "allTime" && "bg-primary text-primary-foreground")}><Infinity className="h-3 w-3" />All Time</Button>
            </div>
          )}

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-2", timeRange === "custom" && "bg-primary text-primary-foreground")}
                onClick={() => handleDateFilterChange("custom")}
              >
                <CalendarIcon className="h-4 w-4" />
                {timeRange === "custom" && customDateRange?.from ? (
                  customDateRange.to ? (
                    <>
                      {format(customDateRange.from, "d MMM", { locale: idLocale })} -{" "}
                      {format(customDateRange.to, "d MMM yyyy", { locale: idLocale })}
                    </>
                  ) : (
                    format(customDateRange.from, "d MMMM yyyy", { locale: idLocale })
                  )
                ) : (
                  "Custom Tanggal"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={pendingDateRange}
                onSelect={(range) => setPendingDateRange(range)}
                defaultMonth={pendingDateRange?.from || new Date()}
                initialFocus
                numberOfMonths={isMobile ? 1 : 2}
                locale={idLocale}
                className="pointer-events-auto"
              />
              <div className="flex justify-end gap-2 p-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>Batal</Button>
                <Button size="sm" onClick={handleCustomDateConfirm} disabled={!pendingDateRange?.from}>OK</Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Search Input */}
          <div className="relative ml-auto min-w-[240px] flex-1 lg:max-w-[270px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari BID, nama, deskripsi..."
              value={effectiveSearchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-lg border-border/80 bg-background pl-9 text-xs shadow-none"
            />
          </div>
        </div>

        <TabsContent value="list-booking" className="mt-4">
          {isFeatureEnabled("transactions.list_booking") ? (
            <ListBooking
              userRole={userRole}
              onEditBooking={onEditBooking}
              onAddBooking={onAddBooking}
              timeRange={timeRange}
              customDateRange={customDateRange}
              searchQuery={effectiveSearchQuery}
            />
          ) : (
            <FeatureInactiveNotice featureName="Penjualan" icon={TrendingUp} price={getFeatureInfo("transactions.list_booking").price} description={getFeatureInfo("transactions.list_booking").description} />
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          {isFeatureEnabled("pos") ? (
            <Suspense fallback={<AnkaLoader />}>
              <PurchaseManagement />
            </Suspense>
          ) : (
            <FeatureInactiveNotice
              featureName="Pembelian (bagian dari Point of Sale)"
              icon={ShoppingCart}
              price={getFeatureInfo("pos").price}
              description={getFeatureInfo("pos").description}
            />
          )}
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          {isFeatureEnabled("transactions.expenses") ? (
            <Suspense fallback={<AnkaLoader />}>
              <ExpenseTransactionView
                timeRange={timeRange}
                customDateRange={customDateRange}
                searchQuery={searchQuery}
              />
            </Suspense>
          ) : (
            <FeatureInactiveNotice featureName="Pengeluaran" icon={TrendingDown} price={getFeatureInfo("transactions.expenses").price} description={getFeatureInfo("transactions.expenses").description} />
          )}
        </TabsContent>

        <TabsContent value="incomes" className="mt-4">
          {isFeatureEnabled("transactions.incomes") ? (
            <Suspense fallback={<AnkaLoader />}>
              <IncomeTransactionView
                timeRange={timeRange}
                customDateRange={customDateRange}
                searchQuery={searchQuery}
              />
            </Suspense>
          ) : (
            <FeatureInactiveNotice featureName="Pemasukan" icon={DollarSign} price={getFeatureInfo("transactions.incomes").price} description={getFeatureInfo("transactions.incomes").description} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
