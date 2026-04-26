import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import InventoryToolbar from "./InventoryToolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";
import StockInForm from "./StockInForm";
import StockOutForm from "./StockOutForm";
import StockOpnameForm from "./StockOpnameForm";
import BidPreviewPopup, { BidType } from "./BidPreviewPopup";

interface ProductRow {
  id: string;
  name: string;
  awal: number;
  masuk: number;
  pengembalian: number;
  penjualan: number;
  keluar: number;
  sisa: number;
}

interface MovementDetail {
  date: string; // ISO datetime
  type: "STOCK_IN" | "STOCK_OUT" | "STOCK_OPNAME" | "POS_SALE";
  refTable: "stock_in" | "stock_out" | "stock_opname" | "bookings";
  refId: string;
  bid: string;
  qtyIn: number;
  qtyOut: number;
}

const formatDateTime = (s: string) => {
  const d = new Date(s);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export default function StockMovementList() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [details, setDetails] = useState<MovementDetail[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit form navigation
  const [editForm, setEditForm] = useState<
    | { kind: "stock_in"; id: string }
    | { kind: "stock_out"; id: string }
    | { kind: "stock_opname"; id: string }
    | null
  >(null);

  // Preview popup state
  const [preview, setPreview] = useState<
    | { type: BidType; refId: string; bid: string }
    | null
  >(null);

  const fromIso = dateRange?.from ? new Date(dateRange.from) : null;
  const toIso = dateRange?.to ? new Date(dateRange.to) : fromIso;
  if (fromIso) fromIso.setHours(0, 0, 0, 0);
  if (toIso) toIso.setHours(23, 59, 59, 999);

  const fetchData = async () => {
    if (!currentStore || !fromIso || !toIso) return;
    setLoading(true);
    try {
      const storeId = currentStore.id;
      const fromStr = fromIso.toISOString().split("T")[0];
      const toStr = toIso.toISOString().split("T")[0];

      // 1. All products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_qty")
        .eq("store_id", storeId)
        .order("name");
      const productList = (products as any[]) || [];
      const productMap = new Map<string, ProductRow>();
      for (const p of productList) {
        productMap.set(p.id, {
          id: p.id,
          name: p.name,
          awal: 0,
          masuk: 0,
          pengembalian: 0,
          penjualan: 0,
          keluar: 0,
          sisa: Number(p.stock_qty || 0),
        });
      }

      // 2. Stock IN within range (posted only) — masuk
      const { data: stockInHeaders } = await supabase
        .from("stock_in" as any)
        .select("id, date, status")
        .eq("store_id", storeId)
        .gte("date", fromStr)
        .lte("date", toStr);
      const inIds = ((stockInHeaders as any[]) || [])
        .filter((h) => h.status === "posted")
        .map((h) => h.id);
      if (inIds.length > 0) {
        const { data: inItems } = await supabase
          .from("stock_in_items" as any)
          .select("stock_in_id, product_id, quantity")
          .in("stock_in_id", inIds);
        ((inItems as any[]) || []).forEach((it) => {
          const row = productMap.get(it.product_id);
          if (row) row.masuk += Number(it.quantity || 0);
        });
      }

      // 3. Stock OUT within range (posted) — keluar
      const { data: stockOutHeaders } = await supabase
        .from("stock_out" as any)
        .select("id, date, status")
        .eq("store_id", storeId)
        .gte("date", fromStr)
        .lte("date", toStr);
      const outIds = ((stockOutHeaders as any[]) || [])
        .filter((h) => h.status === "posted")
        .map((h) => h.id);
      if (outIds.length > 0) {
        const { data: outItems } = await supabase
          .from("stock_out_items" as any)
          .select("stock_out_id, product_id, quantity")
          .in("stock_out_id", outIds);
        ((outItems as any[]) || []).forEach((it) => {
          const row = productMap.get(it.product_id);
          if (row) row.keluar += Number(it.quantity || 0);
        });
      }

      // 4. Bookings (posted/non-cancelled) within range — penjualan
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, date, status")
        .eq("store_id", storeId)
        .gte("date", fromStr)
        .lte("date", toStr)
        .neq("status", "BATAL");
      const bIds = ((bookingsData as any[]) || []).map((b) => b.id);
      if (bIds.length > 0) {
        const { data: bp } = await supabase
          .from("booking_products")
          .select("booking_id, product_id, quantity")
          .in("booking_id", bIds);
        ((bp as any[]) || []).forEach((it) => {
          const row = productMap.get(it.product_id);
          if (row) row.penjualan += Number(it.quantity || 0);
        });
      }

      // 5. Stock opname within range (posted) — affects keluar (negatif) atau masuk (positif penyesuaian)
      const { data: opnameHeaders } = await supabase
        .from("stock_opname" as any)
        .select("id, date, status")
        .eq("store_id", storeId)
        .gte("date", fromStr)
        .lte("date", toStr);
      const opIds = ((opnameHeaders as any[]) || [])
        .filter((h) => h.status === "posted")
        .map((h) => h.id);
      if (opIds.length > 0) {
        const { data: opItems } = await supabase
          .from("stock_opname_items" as any)
          .select("stock_opname_id, product_id, difference")
          .in("stock_opname_id", opIds);
        ((opItems as any[]) || []).forEach((it) => {
          const row = productMap.get(it.product_id);
          if (!row) return;
          const diff = Number(it.difference || 0);
          if (diff > 0) row.masuk += diff;
          else if (diff < 0) row.keluar += Math.abs(diff);
        });
      }

      // 6. Awal = sisa - masuk + penjualan + keluar - pengembalian
      // (Mengingat sisa adalah stok terkini, ini perkiraan untuk periode aktif)
      productMap.forEach((row) => {
        row.awal = row.sisa - row.masuk + row.penjualan + row.keluar - row.pengembalian;
      });

      // Hanya tampilkan produk yang punya pergerakan ATAU stok > 0
      const arr = Array.from(productMap.values()).filter(
        (r) => r.awal !== 0 || r.masuk !== 0 || r.keluar !== 0 || r.penjualan !== 0 || r.sisa !== 0,
      );
      setRows(arr);
    } catch (err) {
      console.error("[StockMovement] fetch error:", err);
      toast.error("Gagal memuat pergerakan stok");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const paginated = filtered.slice(0, pageSize);

  const fetchDetails = async (product: ProductRow) => {
    if (!currentStore || !fromIso || !toIso) return;
    setSelected(product);
    setLoadingDetail(true);
    setDetails(null);
    try {
      const storeId = currentStore.id;
      const fromStr = fromIso.toISOString().split("T")[0];
      const toStr = toIso.toISOString().split("T")[0];
      const all: MovementDetail[] = [];

      // Track running 'awal' from product.awal
      // STOCK IN
      const { data: inRows } = await supabase
        .from("stock_in_items" as any)
        .select("stock_in_id, quantity, stock_in:stock_in_id(id, bid, date, status)")
        .eq("product_id", product.id);
      ((inRows as any[]) || []).forEach((it) => {
        const h = it.stock_in;
        if (!h || h.status !== "posted") return;
        if (h.date < fromStr || h.date > toStr) return;
        all.push({
          date: h.date,
          type: "STOCK_IN",
          refTable: "stock_in",
          refId: h.id,
          bid: h.bid,
          qtyIn: Number(it.quantity || 0),
          qtyOut: 0,
        });
      });

      // STOCK OUT
      const { data: outRows } = await supabase
        .from("stock_out_items" as any)
        .select("stock_out_id, quantity, stock_out:stock_out_id(id, bid, date, status)")
        .eq("product_id", product.id);
      ((outRows as any[]) || []).forEach((it) => {
        const h = it.stock_out;
        if (!h || h.status !== "posted") return;
        if (h.date < fromStr || h.date > toStr) return;
        all.push({
          date: h.date,
          type: "STOCK_OUT",
          refTable: "stock_out",
          refId: h.id,
          bid: h.bid,
          qtyIn: 0,
          qtyOut: Number(it.quantity || 0),
        });
      });

      // STOCK OPNAME
      const { data: opRows } = await supabase
        .from("stock_opname_items" as any)
        .select("stock_opname_id, difference, stock_opname:stock_opname_id(id, bid, date, status)")
        .eq("product_id", product.id);
      ((opRows as any[]) || []).forEach((it) => {
        const h = it.stock_opname;
        if (!h || h.status !== "posted") return;
        if (h.date < fromStr || h.date > toStr) return;
        const diff = Number(it.difference || 0);
        all.push({
          date: h.date,
          type: "STOCK_OPNAME",
          refTable: "stock_opname",
          refId: h.id,
          bid: h.bid,
          qtyIn: diff > 0 ? diff : 0,
          qtyOut: diff < 0 ? Math.abs(diff) : 0,
        });
      });

      // BOOKINGS (penjualan)
      const { data: bpRows } = await supabase
        .from("booking_products")
        .select("booking_id, quantity, booking:booking_id(id, bid, date, status, store_id)")
        .eq("product_id", product.id);
      ((bpRows as any[]) || []).forEach((it) => {
        const h = it.booking;
        if (!h || h.store_id !== storeId) return;
        if (h.status === "BATAL") return;
        if (h.date < fromStr || h.date > toStr) return;
        all.push({
          date: h.date,
          type: "POS_SALE",
          refTable: "bookings",
          refId: h.id,
          bid: h.bid,
          qtyIn: 0,
          qtyOut: Number(it.quantity || 0),
        });
      });

      // sort ascending by date
      all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setDetails(all);
    } catch (err) {
      console.error("[StockMovement] detail error:", err);
      toast.error("Gagal memuat detail mutasi");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const data = filtered.map((r) => ({
      Produk: r.name,
      Awal: r.awal,
      Masuk: r.masuk,
      Pengembalian: r.pengembalian,
      Penjualan: r.penjualan,
      Keluar: r.keluar,
      Sisa: r.sisa,
    }));
    const fileName = getExportFileName("Pergerakan_Stok", currentStore?.name || "Outlet", "all");
    exportToExcel(data, "Pergerakan Stok", fileName);
    toast.success(`Berhasil mengekspor ${data.length} produk`);
  };

  const handleBidClick = (d: MovementDetail) => {
    setPreview({ type: d.refTable as BidType, refId: d.refId, bid: d.bid });
  };

  const handlePreviewEdit = () => {
    if (!preview) return;
    if (preview.type === "bookings") {
      const url = `/dashboard?tab=transactions&bid=${encodeURIComponent(preview.bid)}`;
      setPreview(null);
      window.location.href = url;
      return;
    }
    const target = { kind: preview.type, id: preview.refId } as
      | { kind: "stock_in"; id: string }
      | { kind: "stock_out"; id: string }
      | { kind: "stock_opname"; id: string };
    setPreview(null);
    setSelected(null);
    setDetails(null);
    setEditForm(target);
  };

  // Render edit form full-screen
  if (editForm?.kind === "stock_in") {
    return (
      <StockInForm
        stockInId={editForm.id}
        onBack={() => {
          setEditForm(null);
          fetchData();
        }}
      />
    );
  }
  if (editForm?.kind === "stock_out") {
    return (
      <StockOutForm
        stockOutId={editForm.id}
        onBack={() => {
          setEditForm(null);
          fetchData();
        }}
      />
    );
  }
  if (editForm?.kind === "stock_opname") {
    return (
      <StockOpnameForm
        stockOpnameId={editForm.id}
        onBack={() => {
          setEditForm(null);
          fetchData();
        }}
      />
    );
  }

  // Compute running balances for detail modal
  const runningDetails = useMemo(() => {
    if (!details || !selected) return [];
    let running = selected.awal;
    return details.map((d) => {
      const awalBaris = running;
      running = running + d.qtyIn - d.qtyOut;
      return { ...d, awalBaris, sisaBaris: running };
    });
  }, [details, selected]);

  return (
    <div className="space-y-4">
      <InventoryToolbar
        title="Pergerakan Stok"
        count={filtered.length}
        countLabel="Item"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari nama produk"
        onExport={handleExport}
      />

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Produk</th>
                <th className="text-right px-4 py-3 font-medium">Awal</th>
                <th className="text-right px-4 py-3 font-medium">Masuk</th>
                <th className="text-right px-4 py-3 font-medium">Pengembalian</th>
                <th className="text-right px-4 py-3 font-medium">Penjualan</th>
                <th className="text-right px-4 py-3 font-medium">Keluar</th>
                <th className="text-right px-4 py-3 font-medium">Sisa</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" /> Memuat...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Belum ada pergerakan stok pada periode ini.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer hover:bg-muted/30"
                    onClick={() => fetchDetails(r)}
                  >
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right">{r.awal}</td>
                    <td className={`px-4 py-3 text-right ${r.masuk > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>{r.masuk}</td>
                    <td className={`px-4 py-3 text-right ${r.pengembalian > 0 ? "text-blue-600 font-semibold" : "text-muted-foreground"}`}>{r.pengembalian}</td>
                    <td className={`px-4 py-3 text-right ${r.penjualan > 0 ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>{r.penjualan}</td>
                    <td className={`px-4 py-3 text-right ${r.keluar > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{r.keluar}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.sisa}</td>
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

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setDetails(null); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 -mx-6 px-6">
            {loadingDetail ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline" /> Memuat detail...
              </div>
            ) : runningDetails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada mutasi untuk produk ini pada periode terpilih.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium">Tanggal</th>
                    <th className="text-left px-3 py-3 font-medium">Tipe</th>
                    <th className="text-right px-3 py-3 font-medium">Awal</th>
                    <th className="text-right px-3 py-3 font-medium">Masuk</th>
                    <th className="text-right px-3 py-3 font-medium">Keluar</th>
                    <th className="text-right px-3 py-3 font-medium">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {runningDetails.map((d, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-3 text-xs">{formatDate(d.date)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-muted-foreground">{d.type}</span>
                          <button
                            type="button"
                            onClick={() => handleBidClick(d)}
                            className="text-primary hover:underline font-mono text-xs text-left"
                          >
                            {d.bid}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{d.awalBaris}</td>
                      <td className={`px-3 py-3 text-right ${d.qtyIn > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>{d.qtyIn}</td>
                      <td className={`px-3 py-3 text-right ${d.qtyOut > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{d.qtyOut}</td>
                      <td className="px-3 py-3 text-right font-semibold">{d.sisaBaris}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => { setSelected(null); setDetails(null); }} className="gap-2">
              <X className="h-4 w-4" /> Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}