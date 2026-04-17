import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Boxes, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Activity } from "lucide-react";

export default function InventoryManagement() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("stok-masuk");

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
            <Boxes className="h-5 w-5 text-primary" />
            <CardTitle>Inventori</CardTitle>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
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
              <PlaceholderPanel
                title="Stok Masuk"
                description="Catat barang masuk dari pembelian, transfer, atau penyesuaian."
                icon={ArrowDownToLine}
              />
            </TabsContent>

            <TabsContent value="stok-keluar" className="mt-6">
              <PlaceholderPanel
                title="Stok Keluar"
                description="Catat pengeluaran barang untuk operasional, penjualan, atau penyesuaian."
                icon={ArrowUpFromLine}
              />
            </TabsContent>

            <TabsContent value="stok-opname" className="mt-6">
              <PlaceholderPanel
                title="Stok Opname"
                description="Lakukan perhitungan fisik stok dan penyesuaian selisih."
                icon={ClipboardList}
              />
            </TabsContent>

            <TabsContent value="pergerakan-stok" className="mt-6">
              <PlaceholderPanel
                title="Pergerakan Stok"
                description="Riwayat lengkap mutasi stok dari semua transaksi."
                icon={Activity}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

function PlaceholderPanel({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
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
  );
}
