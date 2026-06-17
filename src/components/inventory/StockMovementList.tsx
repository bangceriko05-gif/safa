import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import InventoryToolbar from "./InventoryToolbar";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToExcel, getExportFileName } from "@/utils/reportExport";
import { toast } from "sonner";
import StockInForm from "./StockInForm";
import StockOutForm from "./StockOutForm";
import StockOpnameForm from "./StockOpnameForm";
import BidPreviewPopup, { BidType } from "./BidPreviewPopup";
import BookingModal from "@/components/BookingModal";
import AnkaLoader from "@/components/AnkaLoader";

interface Movement {
  ts: string; // ISO datetime for sorting/display
  productId: string;
  productName: string;
  unit: string;
  direction: "in" | "out";
  qty: number; // always positive
  stokSebelum: number;
  stokSesudah: number;
  bid: string;
  refType: BidType;
  refId: string;
  note: string;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
};

const fmtNum = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  return Number(n.toFixed(3)).toLocaleString("id-ID", { maximumFractionDigits: 3 });
};

// Parse multiplier factor from product_name like "AJINOMOTO (kg / 1000 gram)" => 1000.
// When the item was entered in a non-base unit, the conversion factor is embedded
// in the stored product_name in parentheses. Fallback to 1 when absent.
const parseFactorFromName = (productName: string): number => {
  if (!productName) return 1;
  const m = productName.match(/\(([^)]+)\)\s*$/);
  if (!m) return 1;
  const inner = m[1];
  const f = inner.match(/\/\s*([\d.,]+)\s+/);
  if (!f) return 1;
  const digits = f[1].replace(/\D/g, "");
  const num = parseInt(digits, 10);
  return Number.isFinite(num) && num > 0 ? num : 1;
};

export default function StockMovementList() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [movements, setMovements] = useState<Movement[]>([]);

  // Edit form navigation
  const [editForm, setEditForm] = useState<
    | { kind: "stock_in"; id: string }
    | { kind: "stock_out"; id: string }
    | { kind: "stock_opname"; id: string }
    | null
  >(null);

  // Booking edit (full-screen)
  const [editBooking, setEditBooking] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

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

      // 1. All products + base unit lookup
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", storeId)
        .order("name");
      type ProdInfo = { id: string; name: string; unit: string };
      const productMap = new Map<string, ProdInfo>();
      ((productsData as any[]) || []).forEach((p) =>
        productMap.set(p.id, {
          id: p.id,
          name: p.name,
          unit: "",
        }),
      );
      setProducts(((productsData as any[]) || []).map((p) => ({ id: p.id, name: p.name })));

      // Base unit per product = first conversion's to_unit
      const productIds = Array.from(productMap.keys());
      if (productIds.length > 0) {
        const { data: convs } = await supabase
          .from("product_unit_conversions")
          .select("product_id, to_unit, from_unit, factor, is_active")
          .in("product_id", productIds);
        ((convs as any[]) || []).forEach((c) => {
          if (c.is_active === false) return;
          const p = productMap.get(c.product_id);
          if (!p) return;
          if (!p.unit) p.unit = c.to_unit || c.from_unit || "";
        });
      }

      // Pull all posted movements up to selected end date, then calculate stock
      // chronologically from zero so each row reflects the real before/after flow.
      const [siRes, soRes, opRes, bkRes] = await Promise.all([
        supabase
          .from("stock_in" as any)
          .select("id, bid, date, posted_at, status, notes")
          .eq("store_id", storeId)
          .eq("status", "posted")
          .lte("date", toStr),
        supabase
          .from("stock_out" as any)
          .select("id, bid, date, posted_at, status, notes, reason, recipient")
          .eq("store_id", storeId)
          .eq("status", "posted")
          .lte("date", toStr),
        supabase
          .from("stock_opname" as any)
          .select("id, bid, date, posted_at, status, notes")
          .eq("store_id", storeId)
          .eq("status", "posted")
          .lte("date", toStr),
        supabase
          .from("bookings")
          .select("id, bid, date, created_at, status, customer_name")
          .eq("store_id", storeId)
          .neq("status", "BATAL")
          .lte("date", toStr),
      ]);

      const siHeaders = (siRes.data as any[]) || [];
      const soHeaders = (soRes.data as any[]) || [];
      const opHeaders = (opRes.data as any[]) || [];
      const bkHeaders = (bkRes.data as any[]) || [];

      const siMap = new Map(siHeaders.map((h: any) => [h.id, h]));
      const soMap = new Map(soHeaders.map((h: any) => [h.id, h]));
      const opMap = new Map(opHeaders.map((h: any) => [h.id, h]));
      const bkMap = new Map(bkHeaders.map((h: any) => [h.id, h]));

      const [siItemsRes, soItemsRes, opItemsRes, bpItemsRes] = await Promise.all([
        siHeaders.length > 0
          ? supabase
              .from("stock_in_items" as any)
              .select("stock_in_id, product_id, product_name, quantity")
              .in("stock_in_id", siHeaders.map((h: any) => h.id))
          : Promise.resolve({ data: [] as any[] } as any),
        soHeaders.length > 0
          ? supabase
              .from("stock_out_items" as any)
              .select("stock_out_id, product_id, product_name, quantity")
              .in("stock_out_id", soHeaders.map((h: any) => h.id))
          : Promise.resolve({ data: [] as any[] } as any),
        opHeaders.length > 0
          ? supabase
              .from("stock_opname_items" as any)
              .select("stock_opname_id, product_id, difference")
              .in("stock_opname_id", opHeaders.map((h: any) => h.id))
          : Promise.resolve({ data: [] as any[] } as any),
        bkHeaders.length > 0
          ? supabase
              .from("booking_products")
              .select("booking_id, product_id, quantity, product_name")
              .in("booking_id", bkHeaders.map((h: any) => h.id))
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      // Build raw movement list (no stock_sebelum/sesudah yet)
      type Raw = Omit<Movement, "stokSebelum" | "stokSesudah"> & { delta: number };
      const raw: Raw[] = [];

      ((siItemsRes.data as any[]) || []).forEach((it) => {
        const h = siMap.get(it.stock_in_id);
        if (!h) return;
        const p = productMap.get(it.product_id);
        if (!p) return;
        const factor = parseFactorFromName(it.product_name || "");
        const qty = Number(it.quantity || 0) * factor;
        raw.push({
          ts: h.posted_at || h.date,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          direction: "in",
          qty,
          delta: qty,
          bid: h.bid || "-",
          refType: "stock_in",
          refId: h.id,
          note: h.notes || "Stok masuk",
        });
      });

      ((soItemsRes.data as any[]) || []).forEach((it) => {
        const h = soMap.get(it.stock_out_id);
        if (!h) return;
        const p = productMap.get(it.product_id);
        if (!p) return;
        const factor = parseFactorFromName(it.product_name || "");
        const qty = Number(it.quantity || 0) * factor;
        raw.push({
          ts: h.posted_at || h.date,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          direction: "out",
          qty,
          delta: -qty,
          bid: h.bid || "-",
          refType: "stock_out",
          refId: h.id,
          note: "Stok keluar",
        });
      });

      ((opItemsRes.data as any[]) || []).forEach((it) => {
        const h = opMap.get(it.stock_opname_id);
        if (!h) return;
        const p = productMap.get(it.product_id);
        if (!p) return;
        const diff = Number(it.difference || 0);
        if (diff === 0) return;
        raw.push({
          ts: h.posted_at || h.date,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          direction: diff > 0 ? "in" : "out",
          qty: Math.abs(diff),
          delta: diff,
          bid: h.bid || "-",
          refType: "stock_opname",
          refId: h.id,
          note: h.notes || "Penyesuaian stok opname",
        });
      });

      ((bpItemsRes.data as any[]) || []).forEach((it) => {
        const h = bkMap.get(it.booking_id);
        if (!h) return;
        const p = productMap.get(it.product_id);
        if (!p) return;
        const factor = parseFactorFromName(it.product_name || "");
        const qty = Number(it.quantity || 0) * factor;
        raw.push({
          ts: h.created_at || h.date,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          direction: "out",
          qty,
          delta: -qty,
          bid: h.bid || "-",
          refType: "bookings",
          refId: h.id,
          note: `Penjualan ke ${h.customer_name || "tamu"}`,
        });
      });

      // Sort by timestamp asc (oldest first) and compute running stock forward.
      raw.sort((a, b) => (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : a.bid.localeCompare(b.bid)));

      // Compute running stock per product from movement history, not from the
      // current product stock cache, because cached stock can use source units.
      const runningPerProduct = new Map<string, number>();
      productMap.forEach((p) => runningPerProduct.set(p.id, 0));

      const result: Movement[] = raw.map((r) => {
        const before = runningPerProduct.get(r.productId) ?? 0;
        const after = before + r.delta;
        runningPerProduct.set(r.productId, after);
        return {
          ts: r.ts,
          productId: r.productId,
          productName: r.productName,
          unit: r.unit,
          direction: r.direction,
          qty: r.qty,
          stokSebelum: before,
          stokSesudah: after,
          bid: r.bid,
          refType: r.refType,
          refId: r.refId,
          note: r.note,
        };
      });

      // Filter to only movements within selected range (use date portion)
      const filtered = result.filter((m) => {
        const dateOnly = m.ts.slice(0, 10);
        return dateOnly >= fromStr && dateOnly <= toStr;
      }).sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : b.bid.localeCompare(a.bid)));

      setMovements(filtered);
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
    return movements.filter((m) => {
      if (productFilter !== "all" && m.productId !== productFilter) return false;
      if (!q) return true;
      return (
        m.productName.toLowerCase().includes(q) ||
        m.bid.toLowerCase().includes(q) ||
        m.note.toLowerCase().includes(q)
      );
    });
  }, [movements, search, productFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, productFilter, pageSize, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const data = filtered.map((m) => ({
      Waktu: formatDateTime(m.ts),
      Produk: m.productName,
      Tipe: m.direction === "in" ? "Masuk" : "Keluar",
      Qty: m.qty,
      Satuan: m.unit,
      "Stok Sebelum": m.stokSebelum,
      "Stok Sesudah": m.stokSesudah,
      BID: m.bid,
      Catatan: m.note,
    }));
    const fileName = getExportFileName("Pergerakan_Stok", currentStore?.name || "Outlet", "all");
    exportToExcel(data, "Pergerakan Stok", fileName);
    toast.success(`Berhasil mengekspor ${data.length} baris`);
  };

  const handleBidClick = (m: Movement) =>
    setPreview({ type: m.refType, refId: m.refId, bid: m.bid });

  const handlePreviewEdit = () => {
    if (!preview) return;
    if (preview.type === "bookings") {
      const refId = preview.refId;
      setPreview(null);
      // Fetch booking and open full-screen edit
      (async () => {
        setLoadingBooking(true);
        try {
          const { data, error } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", refId)
            .maybeSingle();
          if (error) throw error;
          if (data) setEditBooking(data);
          else toast.error("Booking tidak ditemukan");
        } catch (err) {
          console.error("[StockMovement] booking fetch error:", err);
          toast.error("Gagal memuat booking");
        } finally {
          setLoadingBooking(false);
        }
      })();
      return;
    }
    const target = { kind: preview.type, id: preview.refId } as
      | { kind: "stock_in"; id: string }
      | { kind: "stock_out"; id: string }
      | { kind: "stock_opname"; id: string };
    setPreview(null);
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

  // Render booking edit full-screen
  if (editBooking) {
    return (
      <BookingModal
        isOpen={true}
        fullscreen
        onClose={() => {
          setEditBooking(null);
          fetchData();
        }}
        selectedDate={new Date(editBooking.date)}
        selectedSlot={null}
        editingBooking={editBooking}
        userId={currentUserId}
      />
    );
  }

  if (loadingBooking) {
    return <AnkaLoader />;
  }

  return (
    <div className="space-y-4">
      <InventoryToolbar
        title="Pergerakan Stok"
        count={filtered.length}
        countLabel="Pergerakan"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari BID, produk, catatan..."
        onExport={handleExport}
      />

      {/* Product filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Produk:</span>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Semua Produk" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Semua Produk</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Waktu</th>
                <th className="text-left px-4 py-3 font-semibold">Produk</th>
                <th className="text-left px-4 py-3 font-semibold">Tipe</th>
                <th className="text-right px-4 py-3 font-semibold">Qty</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Stok Sebelum</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Stok Sesudah</th>
                <th className="text-left px-4 py-3 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <AnkaLoader />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada pergerakan stok pada periode ini.
                  </td>
                </tr>
              ) : (
                paginated.map((m, i) => {
                  const isIn = m.direction === "in";
                  return (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">
                        {formatDateTime(m.ts)}
                      </td>
                      <td className="px-4 py-3 font-medium uppercase">{m.productName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isIn ? (
                            <ArrowUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-rose-600" />
                          )}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${
                              isIn ? "bg-emerald-600" : "bg-rose-600"
                            }`}
                          >
                            {isIn ? "Masuk" : "Keluar"}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          isIn ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isIn ? "+" : "-"}
                        {fmtNum(m.qty)} <span className="text-muted-foreground font-normal">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {fmtNum(m.stokSebelum)} <span className="text-muted-foreground">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">
                        {fmtNum(m.stokSesudah)} <span className="text-muted-foreground font-normal">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleBidClick(m)}
                          className="text-primary hover:underline font-medium"
                        >
                          {m.bid}
                        </button>
                        <span className="text-muted-foreground"> - {m.note}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            Menampilkan {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* BID Preview Popup */}
      {preview && (
        <BidPreviewPopup
          open={!!preview}
          onClose={() => setPreview(null)}
          type={preview.type}
          refId={preview.refId}
          bid={preview.bid}
          onEdit={handlePreviewEdit}
        />
      )}
    </div>
  );
}