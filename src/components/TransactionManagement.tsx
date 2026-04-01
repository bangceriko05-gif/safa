import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Search, CalendarIcon, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import ListBooking from "./ListBooking";
import ExpenseTransactionView from "./expense/ExpenseTransactionView";
import IncomeTransactionView from "./income/IncomeTransactionView";
import NoAccessMessage from "./NoAccessMessage";
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
}

const ALL_TABS = [
  { key: "list-booking", feature: "transactions.list_booking", label: "Penjualan", icon: TrendingUp },
  { key: "expenses", feature: "transactions.expenses", label: "Pengeluaran", icon: TrendingDown },
  { key: "incomes", feature: "transactions.incomes", label: "Pemasukan", icon: DollarSign },
];

export default function TransactionManagement({ userRole, onEditBooking, onAddBooking, onAddDeposit, depositRefreshTrigger }: TransactionManagementProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();
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

  const hasTransactionAccess = hasAnyPermission([
    "view_bookings", "create_bookings", "edit_bookings",
    "manage_expense", "manage_income"
  ]);

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

        {/* Shared Date Filter & Search */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <div className="flex gap-1">
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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari BID, nama, deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
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
              searchQuery={searchQuery}
            />
          ) : (
            <FeatureInactiveNotice featureName="Penjualan" icon={TrendingUp} price={getFeatureInfo("transactions.list_booking").price} description={getFeatureInfo("transactions.list_booking").description} />
          )}
        </TabsContent>


        <TabsContent value="expenses" className="mt-4">
          {isFeatureEnabled("transactions.expenses") ? (
            <ExpenseTransactionView
              timeRange={timeRange}
              customDateRange={customDateRange}
              searchQuery={searchQuery}
            />
          ) : (
            <FeatureInactiveNotice featureName="Pengeluaran" icon={TrendingDown} price={getFeatureInfo("transactions.expenses").price} description={getFeatureInfo("transactions.expenses").description} />
          )}
        </TabsContent>

        <TabsContent value="incomes" className="mt-4">
          {isFeatureEnabled("transactions.incomes") ? (
            <IncomeTransactionView
              timeRange={timeRange}
              customDateRange={customDateRange}
              searchQuery={searchQuery}
            />
          ) : (
            <FeatureInactiveNotice featureName="Pemasukan" icon={DollarSign} price={getFeatureInfo("transactions.incomes").price} description={getFeatureInfo("transactions.incomes").description} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
