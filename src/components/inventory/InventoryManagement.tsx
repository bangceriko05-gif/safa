import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Activity } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfYear } from "date-fns";
import StockInList from "./StockInList";
import InventoryToolbar from "./InventoryToolbar";

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState("stok-masuk");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <CardTitle>Inventori</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="stok-masuk" className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                <span className="hidden sm:inline">Stok Masuk</span>
                <span className="sm:hidden">Masuk</span>
              </TabsTrigger>
              <TabsTrigger value="stok-keluar" className="flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4" />
                <span className="hidden sm:inline">Stok Keluar</span>
                <span className="sm:hidden">Keluar</span>
              </TabsTrigger>
              <TabsTrigger value="stok-opname" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Stok Opname</span>
                <span className="sm:hidden">Opname</span>
              </TabsTrigger>
              <TabsTrigger value="pergerakan-stok" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Pergerakan Stok</span>
                <span className="sm:hidden">Pergerakan</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stok-masuk" className="mt-6">
              <StockInList />
            </TabsContent>

            <TabsContent value="stok-keluar" className="mt-6">
              <PlaceholderWithToolbar
                title="Stok Keluar"
                countLabel="Stok Keluar"
                description="Catat pengeluaran barang untuk operasional, penjualan, atau penyesuaian."
                icon={ArrowUpFromLine}
                searchPlaceholder="Cari No. Stok Keluar"
                addLabel="Tambah"
              />
            </TabsContent>

            <TabsContent value="stok-opname" className="mt-6">
              <PlaceholderWithToolbar
                title="Stok Opname"
                countLabel="Stok Opname"
                description="Lakukan perhitungan fisik stok dan penyesuaian selisih."
                icon={ClipboardList}
                searchPlaceholder="Cari No. Stok Opname"
                addLabel="Tambah"
              />
            </TabsContent>

            <TabsContent value="pergerakan-stok" className="mt-6">
              <PlaceholderWithToolbar
                title="Pergerakan Stok"
                countLabel="Pergerakan"
                description="Riwayat lengkap mutasi stok dari semua transaksi."
                icon={Activity}
                searchPlaceholder="Cari pergerakan stok"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
    </Card>
  );
}

function PlaceholderWithToolbar({
  title,
  countLabel,
  description,
  icon: Icon,
  searchPlaceholder,
  addLabel,
}: {
  title: string;
  countLabel: string;
  description: string;
  icon: React.ElementType;
  searchPlaceholder: string;
  addLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  });

  return (
    <div className="space-y-4">
      <InventoryToolbar
        title={`Daftar ${title}`}
        count={0}
        countLabel={countLabel}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        onAdd={addLabel ? () => {} : undefined}
        addLabel={addLabel}
      />
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-border rounded-lg">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
        <p className="text-xs text-muted-foreground italic">
          Fitur ini sedang dalam pengembangan. Segera hadir.
        </p>
      </div>
    </div>
  );
}
