import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfYear } from "date-fns";
import StockInForm from "./StockInForm";
import InventoryToolbar from "./InventoryToolbar";

interface StockInRow {
  id: string;
  bid: string;
  date: string;
  supplier_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  item_count: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const statusBadge = (status: string) => {
  if (status === "posted") return <Badge className="bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/10">Posted</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-destructive border-destructive/30">Batal</Badge>;
  return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/10">Draft</Badge>;
};

export default function StockInList() {
  const { currentStore } = useStore();
  const [rows, setRows] = useState<StockInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  });

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_in" as any)
      .select("id, bid, date, supplier_name, total_amount, status, created_at")
      .eq("store_id", currentStore.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const ids = (data as any[]).map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("stock_in_items" as any)
          .select("stock_in_id, quantity")
          .in("stock_in_id", ids);
        (items as any[] | null)?.forEach((it) => {
          counts[it.stock_in_id] = (counts[it.stock_in_id] || 0) + Number(it.quantity || 0);
        });
      }
      setRows((data as any[]).map((r) => ({ ...r, item_count: counts[r.id] || 0 })) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentStore]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (dateRange?.from) {
      const d = new Date(r.date);
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to || dateRange.from);
      to.setHours(23, 59, 59, 999);
      if (d < from || d > to) return false;
    }
    if (!q) return true;
    return (
      r.bid?.toLowerCase().includes(q) ||
      (r.supplier_name || "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(0, pageSize);

  const handleOpenNew = () => {
    setEditId(null);
    setOpenForm(true);
  };

  const handleOpenEdit = (id: string) => {
    setEditId(id);
    setOpenForm(true);
  };

  if (openForm) {
    return (
      <StockInForm
        stockInId={editId}
        onBack={() => {
          setOpenForm(false);
          setEditId(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <InventoryToolbar
        title="Daftar Stok Masuk"
        count={filtered.length}
        countLabel="Stok Masuk"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari No. Stok Masuk"
        onAdd={handleOpenNew}
        addLabel="Tambah"
      />

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No. Stok Masuk</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Jumlah Item</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Memuat...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Belum ada data stok masuk
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenEdit(r.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium">{r.bid}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.supplier_name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.total_amount)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {r.item_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
