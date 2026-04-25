import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfYear } from "date-fns";
import StockOpnameForm from "./StockOpnameForm";
import InventoryToolbar from "./InventoryToolbar";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";

interface OpnameRow {
  id: string;
  bid: string;
  date: string;
  notes: string | null;
  total_difference: number;
  total_value_difference: number;
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

export default function StockOpnameList() {
  const { currentStore } = useStore();
  const [rows, setRows] = useState<OpnameRow[]>([]);
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
      .from("stock_opname" as any)
      .select("id, bid, date, notes, total_difference, total_value_difference, status, created_at")
      .eq("store_id", currentStore.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const ids = (data as any[]).map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("stock_opname_items" as any)
          .select("stock_opname_id")
          .in("stock_opname_id", ids);
        (items as any[] | null)?.forEach((it) => {
          counts[it.stock_opname_id] = (counts[it.stock_opname_id] || 0) + 1;
        });
      }
      setRows((data as any[]).map((r) => ({ ...r, item_count: counts[r.id] || 0 })) as any);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentStore]);

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
      (r.notes || "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(0, pageSize);

  const handleOpenNew = () => { setEditId(null); setOpenForm(true); };
  const handleOpenEdit = (id: string) => { setEditId(id); setOpenForm(true); };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const formatDateExp = (s: string) =>
      new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    const data = filtered.map((r) => ({
      "No. Stok Opname": r.bid,
      "Tanggal": formatDateExp(r.date),
      "Total Selisih (Qty)": r.total_difference,
      "Nilai Selisih": r.total_value_difference,
      "Status": r.status,
      "Jumlah Item": r.item_count,
      "Catatan": r.notes || "-",
    }));
    const fileName = getExportFileName("Stok_Opname", currentStore?.name || "Outlet", "all");
    exportToExcel(data, "Stok Opname", fileName);
    toast.success(`Berhasil mengekspor ${data.length} data`);
  };

  if (openForm) {
    return (
      <StockOpnameForm
        stockOpnameId={editId}
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
        title="Daftar Stok Opname"
        count={filtered.length}
        countLabel="Stok Opname"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari No. Stok Opname"
        onExport={handleExport}
        onAdd={handleOpenNew}
        addLabel="Tambah"
      />

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No. Stok Opname</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-right px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Total Selisih</th>
                <th className="text-right px-4 py-3 font-medium">Nilai Selisih</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">Memuat...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada data stok opname.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer hover:bg-muted/30"
                    onClick={() => handleOpenEdit(r.id)}
                  >
                    <td className="px-4 py-3 font-mono">{r.bid}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-right">{r.item_count}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      r.total_difference > 0
                        ? "text-green-600"
                        : r.total_difference < 0
                        ? "text-destructive"
                        : ""
                    }`}>
                      {r.total_difference > 0 ? `+${r.total_difference}` : r.total_difference}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      r.total_value_difference > 0
                        ? "text-green-600"
                        : r.total_value_difference < 0
                        ? "text-destructive"
                        : ""
                    }`}>
                      {r.total_value_difference > 0 ? "+" : ""}{formatCurrency(r.total_value_difference)}
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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