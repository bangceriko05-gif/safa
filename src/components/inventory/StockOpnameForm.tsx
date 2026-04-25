import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  ArrowLeft,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
  Check,
  Minus,
  MoreVertical,
  ChevronDown,
  Package,
  History,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  stockOpnameId: string | null;
  onBack: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_qty: number;
}

interface Item {
  id?: string;
  product_id: string;
  product_name: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  unit_price: number;
  value_difference: number;
}

interface HistoryEvent {
  type: "created" | "posted" | "cancelled";
  label: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  reason?: string | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function StockOpnameForm({ stockOpnameId, onBack }: Props) {
  const { currentStore } = useStore();

  // Header
  const [bid, setBid] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [createdByEmail, setCreatedByEmail] = useState("");

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // History
  const [history, setHistory] = useState<HistoryEvent[]>([]);

  // Add product dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addPage, setAddPage] = useState(1);
  const [addPageSize, setAddPageSize] = useState(50);
  // pendingSelections: productId -> actual stock entered
  const [pendingSelections, setPendingSelections] = useState<Record<string, number>>({});

  // Edit dialogs
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editNotesOpen, setEditNotesOpen] = useState(false);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canHardDelete, setCanHardDelete] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);

  // Delete privilege
  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (isSuper) { setCanHardDelete(true); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setCanHardDelete((roles || []).some((r: any) => r.role === "akuntan" || r.role === "owner"));
    };
    checkRole();
  }, []);

  const isPosted = status === "posted";
  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";
  const isReadOnly = isPosted || isCancelled;

  // Refs for autosave
  const stateRef = useRef({ status, items, bid, notes, date });
  stateRef.current = { status, items, bid, notes, date };
  const saveDraftRef = useRef<(silent?: boolean) => Promise<string | null>>();

  // Load
  useEffect(() => {
    const load = async () => {
      if (!currentStore) return;
      setLoading(true);

      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, stock_qty")
        .eq("store_id", currentStore.id)
        .order("name");
      setProducts((prods || []) as Product[]);

      if (stockOpnameId) {
        const { data: so } = await supabase
          .from("stock_opname" as any)
          .select("*")
          .eq("id", stockOpnameId)
          .single();
        if (so) {
          const r: any = so;
          setBid(r.bid);
          setDate(r.date);
          setNotes(r.notes || "");
          setStatus(r.status);

          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", r.created_by)
            .maybeSingle();
          setCreatedByEmail(prof?.email || "");

          const { data: its } = await supabase
            .from("stock_opname_items" as any)
            .select("*")
            .eq("stock_opname_id", stockOpnameId);
          setItems(((its as any) || []).map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            system_stock: Number(it.system_stock),
            actual_stock: Number(it.actual_stock),
            difference: Number(it.difference),
            unit_price: Number(it.unit_price),
            value_difference: Number(it.value_difference),
          })));

          const actorIds = Array.from(
            new Set([r.created_by, r.posted_by, r.cancelled_by].filter(Boolean) as string[])
          );
          let actorMap: Record<string, { name: string; email: string }> = {};
          if (actorIds.length > 0) {
            const { data: actors } = await supabase
              .from("profiles")
              .select("id, name, email")
              .in("id", actorIds);
            (actors || []).forEach((a: any) => {
              actorMap[a.id] = { name: a.name || "", email: a.email || "" };
            });
          }
          const events: HistoryEvent[] = [];
          if (r.created_at) {
            const a = actorMap[r.created_by] || { name: "", email: "" };
            events.push({
              type: "created",
              label: "Membuat dokumen",
              userName: a.name || a.email || "Unknown",
              userEmail: a.email,
              timestamp: r.created_at,
            });
          }
          if (r.posted_at && r.posted_by) {
            const a = actorMap[r.posted_by] || { name: "", email: "" };
            events.push({
              type: "posted",
              label: "Memposting dokumen",
              userName: a.name || a.email || "Unknown",
              userEmail: a.email,
              timestamp: r.posted_at,
            });
          }
          if (r.cancelled_at && r.cancelled_by) {
            const a = actorMap[r.cancelled_by] || { name: "", email: "" };
            events.push({
              type: "cancelled",
              label: "Membatalkan dokumen",
              userName: a.name || a.email || "Unknown",
              userEmail: a.email,
              timestamp: r.cancelled_at,
              reason: r.cancel_reason,
            });
          }
          events.sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
          setHistory(events);
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setCreatedByEmail(user?.email || "");
        const { data: previewBid } = await supabase.rpc("generate_stock_opname_bid" as any, {
          p_date: date,
          p_store_id: currentStore.id,
        });
        if (previewBid) setBid(previewBid as string);
      }

      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockOpnameId, currentStore]);

  const totals = useMemo(() => {
    const totalDiff = items.reduce((s, it) => s + it.difference, 0);
    const totalValueDiff = items.reduce((s, it) => s + it.value_difference, 0);
    return { totalDiff, totalValueDiff };
  }, [items]);

  // Save draft
  const createdIdRef = useRef<string | null>(stockOpnameId);
  const saveDraft = async (silent = false): Promise<string | null> => {
    if (!currentStore) return null;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let id = createdIdRef.current;
      const s = stateRef.current;
      const totalDiff = s.items.reduce((sum, it) => sum + it.difference, 0);
      const totalValueDiff = s.items.reduce((sum, it) => sum + it.value_difference, 0);

      if (!id) {
        const { data, error } = await supabase
          .from("stock_opname" as any)
          .insert({
            store_id: currentStore.id,
            bid: s.bid || null,
            date: s.date,
            notes: s.notes || null,
            total_difference: totalDiff,
            total_value_difference: totalValueDiff,
            status: "draft",
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        id = (data as any).id;
        createdIdRef.current = id;
        setBid((data as any).bid);
      } else {
        const { error } = await supabase
          .from("stock_opname" as any)
          .update({
            date: s.date,
            notes: s.notes || null,
            total_difference: totalDiff,
            total_value_difference: totalValueDiff,
          })
          .eq("id", id);
        if (error) throw error;
        await supabase.from("stock_opname_items" as any).delete().eq("stock_opname_id", id);
      }

      if (s.items.length > 0 && id) {
        const payload = s.items.map((it) => ({
          stock_opname_id: id,
          product_id: it.product_id,
          product_name: it.product_name,
          system_stock: it.system_stock,
          actual_stock: it.actual_stock,
          difference: it.difference,
          unit_price: it.unit_price,
          value_difference: it.value_difference,
        }));
        const { error: ie } = await supabase.from("stock_opname_items" as any).insert(payload);
        if (ie) throw ie;
      }

      if (!silent) toast.success("Draft tersimpan");
      return id;
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error("Gagal menyimpan: " + e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };
  saveDraftRef.current = saveDraft;

  // Auto-save on unmount
  useEffect(() => {
    const shouldAutoSave = () => stateRef.current.status === "draft";
    const handleBeforeUnload = () => {
      if (shouldAutoSave()) saveDraftRef.current?.(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (shouldAutoSave()) saveDraftRef.current?.(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = async () => {
    if (stateRef.current.status === "draft") {
      await saveDraft(true);
    }
    onBack();
  };

  // Post
  const postNow = async () => {
    if (items.length === 0) {
      toast.error("Tambahkan produk terlebih dahulu");
      return;
    }
    const id = await saveDraft(true);
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("stock_opname" as any)
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        posted_by: user?.id,
      })
      .eq("id", id);
    if (error) {
      toast.error("Gagal posting: " + error.message);
      return;
    }
    toast.success("Stok opname berhasil di-post");
    setStatus("posted");
  };

  // Hard delete
  const handleHardDelete = async () => {
    const id = createdIdRef.current || stockOpnameId;
    if (!id) {
      setHardDeleteOpen(false);
      onBack();
      return;
    }
    setHardDeleting(true);
    try {
      if (stateRef.current.status === "posted") {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: cErr } = await supabase
          .from("stock_opname" as any)
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user?.id,
          })
          .eq("id", id);
        if (cErr) throw cErr;
      }
      const { error: iErr } = await supabase.from("stock_opname_items" as any).delete().eq("stock_opname_id", id);
      if (iErr) throw iErr;
      const { error: hErr } = await supabase.from("stock_opname" as any).delete().eq("id", id);
      if (hErr) throw hErr;
      createdIdRef.current = null;
      stateRef.current = { ...stateRef.current, status: "deleted" as any };
      toast.success("Data berhasil dihapus permanen");
      setHardDeleteOpen(false);
      onBack();
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal menghapus: " + (e.message || ""));
    } finally {
      setHardDeleting(false);
    }
  };

  const doCancel = async () => {
    if (!stockOpnameId && !bid) {
      onBack();
      return;
    }
    const id = stockOpnameId || (await saveDraft(true));
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("stock_opname" as any)
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id,
        cancel_reason: cancelReason || null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Gagal membatalkan: " + error.message);
      return;
    }
    toast.success("Stok opname dibatalkan");
    setStatus("cancelled");
    setCancelOpen(false);
  };

  // ========== Add product dialog logic ==========
  const openAddDialog = () => {
    setAddSearch("");
    setAddPage(1);
    // Pre-populate selections from items already in the document so user can see what's already added
    const initial: Record<string, number> = {};
    items.forEach((it) => { initial[it.product_id] = it.actual_stock; });
    setPendingSelections(initial);
    setAddOpen(true);
  };

  const filteredAddProducts = useMemo(() => {
    const q = addSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, addSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredAddProducts.length / addPageSize));
  const pagedProducts = useMemo(() => {
    const start = (addPage - 1) * addPageSize;
    return filteredAddProducts.slice(start, start + addPageSize);
  }, [filteredAddProducts, addPage, addPageSize]);

  useEffect(() => { setAddPage(1); }, [addSearch, addPageSize]);

  const selectedCount = Object.keys(pendingSelections).length;
  const allOnPageSelected =
    pagedProducts.length > 0 && pagedProducts.every((p) => p.id in pendingSelections);

  const togglePageSelection = () => {
    setPendingSelections((prev) => {
      const next = { ...prev };
      if (allOnPageSelected) {
        pagedProducts.forEach((p) => { delete next[p.id]; });
      } else {
        pagedProducts.forEach((p) => {
          if (!(p.id in next)) next[p.id] = p.stock_qty;
        });
      }
      return next;
    });
  };

  const toggleProductSelection = (p: Product) => {
    setPendingSelections((prev) => {
      const next = { ...prev };
      if (p.id in next) {
        delete next[p.id];
      } else {
        next[p.id] = p.stock_qty;
      }
      return next;
    });
  };

  const setActualForProduct = (productId: string, val: number) => {
    setPendingSelections((prev) => ({ ...prev, [productId]: Math.max(0, val) }));
  };

  const confirmAdd = () => {
    if (selectedCount === 0) {
      toast.error("Pilih minimal 1 produk");
      return;
    }
    // Build new items list: keep existing items not in selection, replace those that are
    const selectedIds = new Set(Object.keys(pendingSelections));
    const kept = items.filter((it) => !selectedIds.has(it.product_id));
    const newItems: Item[] = Object.entries(pendingSelections).map(([pid, actual]) => {
      const product = products.find((p) => p.id === pid)!;
      const system = product.stock_qty;
      const diff = actual - system;
      const unit = product.price;
      return {
        product_id: pid,
        product_name: product.name,
        system_stock: system,
        actual_stock: actual,
        difference: diff,
        unit_price: unit,
        value_difference: diff * unit,
      };
    });
    setItems([...kept, ...newItems]);
    setAddOpen(false);
    setPendingSelections({});
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItemActual = (idx: number, actual: number) => {
    const next = [...items];
    const it = next[idx];
    const diff = actual - it.system_stock;
    next[idx] = {
      ...it,
      actual_stock: actual,
      difference: diff,
      value_difference: diff * it.unit_price,
    };
    setItems(next);
  };

  const handlePrint = () => window.print();

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Memuat...</div>;
  }

  const StatusBadge = () => {
    if (isPosted) return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-0 text-base px-4 py-2">Posted</Badge>;
    if (isCancelled) return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-0 text-base px-4 py-2">Batal</Badge>;
    return <Badge className="bg-orange-200 text-orange-900 hover:bg-orange-200 border-0 text-base px-4 py-2">📝 Draft</Badge>;
  };

  return (
    <div className="space-y-4 print-area">
      {/* Back (hidden on print) */}
      <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 no-print">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar
      </Button>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Stok Opname</h1>
        <p className="text-sm text-muted-foreground">
          {currentStore?.name || ""} — Dicetak {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* Warning (hidden on print) */}
      {isDraft && (
        <div className="flex items-start gap-3 bg-muted/60 border rounded-lg p-4 no-print">
          <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Pastikan data sudah benar sebelum diposting. Setelah terposting, data tidak diperbolehkan diubah.
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="flex flex-col md:flex-row">
          <div className="bg-orange-100/60 px-6 py-6 flex items-center justify-center md:w-48">
            <StatusBadge />
          </div>
          <div className="flex-1 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">No. Stok Opname</p>
              <p className="text-2xl font-bold">{bid || "(akan di-generate)"}</p>
            </div>
            <div className="flex flex-wrap gap-2 no-print">
              {(isPosted || isDraft) && (
                <Button variant="default" className="bg-blue-500 hover:bg-blue-600 gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Cetak
                </Button>
              )}
              {isDraft && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="bg-green-500 hover:bg-green-600 gap-2" disabled={saving}>
                      <Check className="h-4 w-4" /> Aksi
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={postNow} className="gap-2 cursor-pointer">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Post Sekarang</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCancelOpen(true)} className="gap-2 cursor-pointer">
                      <X className="h-4 w-4 text-blue-600" />
                      <span>Batalkan</span>
                    </DropdownMenuItem>
                    {canHardDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setHardDeleteOpen(true)}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Hapus Permanen</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {(isPosted || isCancelled) && canHardDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title="Aksi lain">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => setHardDeleteOpen(true)}
                      className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus Permanen</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: Tanggal + Catatan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Tanggal</h3>
            {!isReadOnly && (
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 gap-1 no-print" onClick={() => setEditDateOpen(true)}>
                <Pencil className="h-3 w-3" /> Ubah
              </Button>
            )}
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tanggal buat</span>
              <span className="font-medium">{formatDate(date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dibuat oleh</span>
              <span className="font-medium truncate ml-2">{createdByEmail || "-"}</span>
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Catatan</h3>
            {!isReadOnly && (
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 gap-1 no-print" onClick={() => setEditNotesOpen(true)}>
                <Pencil className="h-3 w-3" /> Ubah
              </Button>
            )}
          </div>
          <div className="px-4 py-3 text-sm min-h-[60px]">
            {notes ? <span>{notes}</span> : <span className="text-muted-foreground italic">Tidak ada catatan</span>}
          </div>
        </div>
      </div>

      {/* Items table with Tambah Produk button */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-blue-50/60 flex items-center justify-between">
          <h3 className="font-semibold text-blue-900">Produk Stok Opname ({items.length})</h3>
          {!isReadOnly && (
            <Button onClick={openAddDialog} className="bg-blue-500 hover:bg-blue-600 gap-2 no-print">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Belum ada produk. Klik "Tambah Produk" untuk memulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-10">No</th>
                  <th className="text-left px-3 py-2 font-medium">Nama Produk</th>
                  <th className="text-right px-3 py-2 font-medium">Stok Sistem</th>
                  <th className="text-right px-3 py-2 font-medium">Stok Aktual</th>
                  <th className="text-right px-3 py-2 font-medium">Selisih</th>
                  <th className="text-right px-3 py-2 font-medium">Harga</th>
                  <th className="text-right px-3 py-2 font-medium">Nilai Selisih</th>
                  {!isReadOnly && <th className="text-center px-3 py-2 font-medium w-20 no-print">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const diffPositive = it.difference > 0;
                  const diffNegative = it.difference < 0;
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-semibold">{it.product_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{it.system_stock}</td>
                      <td className="px-3 py-3 text-right">
                        {isReadOnly ? (
                          <span>{it.actual_stock}</span>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min={0}
                              value={it.actual_stock}
                              onChange={(e) => updateItemActual(i, parseFloat(e.target.value) || 0)}
                              className="h-9 max-w-[100px] ml-auto text-right print:hidden"
                            />
                            <span className="hidden print:inline">{it.actual_stock}</span>
                          </>
                        )}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold ${
                        diffPositive ? "text-green-600" : diffNegative ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {diffPositive ? `+${it.difference}` : it.difference}
                      </td>
                      <td className="px-3 py-3 text-right">{formatCurrency(it.unit_price)}</td>
                      <td className={`px-3 py-3 text-right font-semibold ${
                        diffPositive ? "text-green-600" : diffNegative ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {diffPositive ? "+" : ""}{formatCurrency(it.value_difference)}
                      </td>
                      {!isReadOnly && (
                        <td className="px-3 py-3 text-center no-print">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(i)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr className="border-t bg-muted/30 font-bold">
                  <td colSpan={4} className="px-3 py-3 text-right">Total Selisih</td>
                  <td className={`px-3 py-3 text-right ${
                    totals.totalDiff > 0 ? "text-green-600" : totals.totalDiff < 0 ? "text-destructive" : ""
                  }`}>
                    {totals.totalDiff > 0 ? `+${totals.totalDiff}` : totals.totalDiff}
                  </td>
                  <td />
                  <td className={`px-3 py-3 text-right ${
                    totals.totalValueDiff > 0 ? "text-green-600" : totals.totalValueDiff < 0 ? "text-destructive" : ""
                  }`}>
                    {totals.totalValueDiff > 0 ? "+" : ""}{formatCurrency(totals.totalValueDiff)}
                  </td>
                  {!isReadOnly && <td className="no-print" />}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      {stockOpnameId && history.length > 0 && (
        <div className="border rounded-lg bg-card overflow-hidden no-print">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Riwayat Aktivitas</h3>
          </div>
          <div className="p-4">
            <ol className="relative border-l-2 border-muted ml-3 space-y-5">
              {history.map((ev, idx) => {
                const Icon =
                  ev.type === "created" ? FileText : ev.type === "posted" ? CheckCircle2 : XCircle;
                const dotClass =
                  ev.type === "created"
                    ? "bg-blue-500 text-white"
                    : ev.type === "posted"
                    ? "bg-green-500 text-white"
                    : "bg-destructive text-destructive-foreground";
                const ts = new Date(ev.timestamp);
                const dateStr = ts.toLocaleDateString("id-ID", {
                  day: "2-digit", month: "short", year: "numeric",
                });
                const timeStr = ts.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={idx} className="ml-6">
                    <span className={`absolute -left-[15px] flex items-center justify-center h-7 w-7 rounded-full ring-4 ring-card ${dotClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <p className="text-sm font-semibold">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">
                          oleh <span className="font-medium text-foreground">{ev.userName}</span>
                          {ev.userEmail && ev.userEmail !== ev.userName && (
                            <span className="text-muted-foreground"> ({ev.userEmail})</span>
                          )}
                        </p>
                        {ev.reason && (
                          <p className="text-xs text-muted-foreground mt-1 italic">Alasan: {ev.reason}</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">
                        <span className="font-medium">{dateStr}</span>
                        <span className="mx-1">·</span>
                        <span>{timeStr}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-row items-center justify-between space-y-0 border-b">
            <DialogTitle className="text-xl">Tambah Produk</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
              <Button onClick={confirmAdd} className="bg-green-500 hover:bg-green-600">
                Tambah ({selectedCount})
              </Button>
            </div>
          </DialogHeader>

          <div className="px-6 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari Produk / SKU / Barcode"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className={`mx-6 mt-3 mb-2 rounded-md px-4 py-2.5 text-sm ${
            selectedCount > 0
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            {selectedCount > 0 ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {selectedCount} Terpilih (Maksimal 500)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Maksimal 500 produk terpilih tiap penambahan
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={togglePageSelection}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Stok Sistem</th>
                  <th className="text-left px-4 py-3 font-medium w-[260px]">Stok Aktual</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-muted-foreground">
                      Tidak ada produk
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((p) => {
                    const isSelected = p.id in pendingSelections;
                    const actualVal = pendingSelections[p.id] ?? p.stock_qty;
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProductSelection(p)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-blue-500" />
                            </div>
                            <span className="font-semibold">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{p.stock_qty}</td>
                        <td className="px-4 py-3">
                          {isSelected ? (
                            <div className="flex items-center max-w-[220px] border rounded-md ring-2 ring-blue-300">
                              <Input
                                type="number"
                                min={0}
                                value={actualVal}
                                onChange={(e) =>
                                  setActualForProduct(p.id, parseFloat(e.target.value) || 0)
                                }
                                className="border-0 h-9 text-center focus-visible:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => setActualForProduct(p.id, actualVal - 1)}
                                className="px-2 h-9 border-l hover:bg-muted"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActualForProduct(p.id, actualVal + 1)}
                                className="px-2 h-9 border-l hover:bg-muted"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Pilih untuk input</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t px-6 py-3 flex items-center justify-center gap-2">
            <Select value={String(addPageSize)} onValueChange={(v) => setAddPageSize(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25/page</SelectItem>
                <SelectItem value="50">50/page</SelectItem>
                <SelectItem value="100">100/page</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={addPage <= 1}
              onClick={() => setAddPage(addPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {addPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={addPage >= totalPages}
              onClick={() => setAddPage(addPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Date */}
      <Dialog open={editDateOpen} onOpenChange={setEditDateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ubah Tanggal</DialogTitle></DialogHeader>
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDateOpen(false)}>Batal</Button>
            <Button onClick={() => setEditDateOpen(false)}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes */}
      <Dialog open={editNotesOpen} onOpenChange={setEditNotesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ubah Catatan</DialogTitle></DialogHeader>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Tambahkan catatan..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNotesOpen(false)}>Batal</Button>
            <Button onClick={() => setEditNotesOpen(false)}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batalkan Stok Opname?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Dokumen ini akan ditandai sebagai dibatalkan dan tidak bisa diubah lagi.</p>
            <Label>Alasan (opsional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Tutup</Button>
            <Button variant="destructive" onClick={doCancel}>Ya, Batalkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete */}
      <AlertDialog open={hardDeleteOpen} onOpenChange={(o) => { if (!o && !hardDeleting) setHardDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus permanen stok opname?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus permanen dokumen <span className="font-mono font-semibold">{bid}</span>.
              {status === "posted" && (
                <> Stok produk akan dikembalikan ke nilai sistem semula sebelum dokumen dihapus.</>
              )}
              <br />
              Tindakan ini <b>tidak dapat dibatalkan</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hardDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleHardDelete(); }}
              disabled={hardDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {hardDeleting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}