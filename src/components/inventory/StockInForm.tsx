import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  Save,
  Search,
  Trash2,
  X,
  Check,
  Minus,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  stockInId: string | null;
  onBack: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface Item {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export default function StockInForm({ stockInId, onBack }: Props) {
  const { currentStore } = useStore();

  // Header
  const [bid, setBid] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [createdByEmail, setCreatedByEmail] = useState("");

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Add product row — supports multi-select
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [newProductSearchOpen, setNewProductSearchOpen] = useState(false);
  const [newProductSearch, setNewProductSearch] = useState("");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newQty, setNewQty] = useState<number>(1);

  // Edit dialogs
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [editNotesOpen, setEditNotesOpen] = useState(false);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canHardDelete, setCanHardDelete] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);

  // Check delete privilege (akuntan / super admin)
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
      setCanHardDelete((roles || []).some((r: any) => r.role === "akuntan"));
    };
    checkRole();
  }, []);

  const isPosted = status === "posted";
  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";
  const isReadOnly = isPosted || isCancelled;

  // Refs to access latest state inside cleanup/unload handlers
  const stateRef = useRef({ status, items, bid, supplierName, notes, date, supplierId });
  stateRef.current = { status, items, bid, supplierName, notes, date, supplierId };
  const saveDraftRef = useRef<(silent?: boolean) => Promise<string | null>>();

  // ===== Load data =====
  useEffect(() => {
    const load = async () => {
      if (!currentStore) return;
      setLoading(true);

      // Products
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("store_id", currentStore.id)
        .order("name");
      setProducts(prods || []);

      // Suppliers
      const { data: sups } = await supabase
        .from("suppliers" as any)
        .select("id, name")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setSuppliers((sups as any) || []);

      // If editing, load existing
      if (stockInId) {
        const { data: si } = await supabase
          .from("stock_in" as any)
          .select("*")
          .eq("id", stockInId)
          .single();
        if (si) {
          const r: any = si;
          setBid(r.bid);
          setDate(r.date);
          setSupplierId(r.supplier_id);
          setSupplierName(r.supplier_name || "");
          setNotes(r.notes || "");
          setStatus(r.status);

          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", r.created_by)
            .maybeSingle();
          setCreatedByEmail(prof?.email || "");

          const { data: its } = await supabase
            .from("stock_in_items" as any)
            .select("*")
            .eq("stock_in_id", stockInId);
          setItems(((its as any) || []).map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          })));
        }
      } else {
        // New: get user email & preview next BID
        const { data: { user } } = await supabase.auth.getUser();
        setCreatedByEmail(user?.email || "");

        const { data: previewBid } = await supabase.rpc("generate_stock_in_bid", {
          p_date: date,
          p_store_id: currentStore.id,
        });
        if (previewBid) setBid(previewBid as string);
      }

      setLoading(false);
    };
    load();
  }, [stockInId, currentStore]);

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + it.subtotal, 0),
    [items]
  );

  // ===== Save draft (or create new) =====
  const createdIdRef = useRef<string | null>(stockInId);
  const saveDraft = async (silent = false): Promise<string | null> => {
    if (!currentStore) return null;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let id = createdIdRef.current;

      if (!id) {
        // create — preserve the previewed BID so the list shows the same number
        const s = stateRef.current;
        const { data, error } = await supabase
          .from("stock_in" as any)
          .insert({
            store_id: currentStore.id,
            bid: s.bid || null,
            date: s.date,
            supplier_id: s.supplierId,
            supplier_name: s.supplierName || null,
            notes: s.notes || null,
            total_amount: totalAmount,
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
        const s = stateRef.current;
        const { error } = await supabase
          .from("stock_in" as any)
          .update({
            date: s.date,
            supplier_id: s.supplierId,
            supplier_name: s.supplierName || null,
            notes: s.notes || null,
            total_amount: totalAmount,
          })
          .eq("id", id);
        if (error) throw error;

        // Replace items: delete existing then re-insert
        await supabase.from("stock_in_items" as any).delete().eq("stock_in_id", id);
      }

      const curItems = stateRef.current.items;
      if (curItems.length > 0 && id) {
        const payload = curItems.map((it) => ({
          stock_in_id: id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        }));
        const { error: ie } = await supabase.from("stock_in_items" as any).insert(payload);
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

  // Auto-save draft on unmount or browser close.
  // For NEW entries: always create a draft so the previewed BID becomes a real row.
  // For EXISTING drafts: persist any pending edits.
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

  // ===== Post =====
  const postNow = async () => {
    if (items.length === 0) {
      toast.error("Tambahkan produk terlebih dahulu");
      return;
    }
    const id = await saveDraft(true);
    if (!id) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("stock_in" as any)
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
    toast.success("Stok masuk berhasil di-post");
  };

  // ===== Hard delete (permanent) =====
  const handleHardDelete = async () => {
    const id = createdIdRef.current || stockInId;
    if (!id) {
      // Nothing persisted yet — just close form
      setHardDeleteOpen(false);
      onBack();
      return;
    }
    setHardDeleting(true);
    try {
      // If posted, revert stock first by cancelling (trigger reverts qty)
      if (stateRef.current.status === "posted") {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: cErr } = await supabase
          .from("stock_in" as any)
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user?.id,
          })
          .eq("id", id);
        if (cErr) throw cErr;
      }
      const { error: iErr } = await supabase.from("stock_in_items" as any).delete().eq("stock_in_id", id);
      if (iErr) throw iErr;
      const { error: hErr } = await supabase.from("stock_in" as any).delete().eq("id", id);
      if (hErr) throw hErr;
      // Prevent auto-save on unmount from re-creating the row
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
    if (!stockInId && !bid) {
      onBack();
      return;
    }
    const id = stockInId || (await saveDraft(true));
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("stock_in" as any)
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
    toast.success("Stok masuk dibatalkan");
    setStatus("cancelled");
    setCancelOpen(false);
  };

  // ===== Add item(s) — supports multi-select =====
  const handleAddItem = () => {
    if (selectedProductIds.length === 0) {
      toast.error("Pilih minimal satu produk");
      return;
    }
    if (newQty <= 0) {
      toast.error("Qty harus lebih dari 0");
      return;
    }
    const subtotal = newQty * newPrice;
    const newItems: Item[] = selectedProductIds
      .map((pid) => products.find((x) => x.id === pid))
      .filter((p): p is Product => !!p)
      .map((p) => ({
        product_id: p.id,
        product_name: p.name,
        quantity: newQty,
        unit_price: newPrice,
        subtotal,
      }));
    setItems([...items, ...newItems]);
    setSelectedProductIds([]);
    setNewProductSearch("");
    setNewPrice(0);
    setNewQty(1);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // ===== Add supplier =====
  const handleAddSupplier = async () => {
    if (!currentStore || !newSupplierName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("suppliers" as any)
      .insert({
        store_id: currentStore.id,
        name: newSupplierName.trim(),
        created_by: user?.id,
      })
      .select()
      .single();
    if (error) {
      toast.error("Gagal menambah supplier");
      return;
    }
    const s: any = data;
    setSuppliers([...suppliers, { id: s.id, name: s.name }]);
    setSupplierId(s.id);
    setSupplierName(s.name);
    setNewSupplierName("");
    setSupplierFormOpen(false);
    toast.success("Supplier ditambahkan");
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Memuat...</div>;
  }

  const StatusBadge = () => {
    if (isPosted) return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-0 text-base px-4 py-2">Posted</Badge>;
    if (isCancelled) return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-0 text-base px-4 py-2">Batal</Badge>;
    return <Badge className="bg-orange-200 text-orange-900 hover:bg-orange-200 border-0 text-base px-4 py-2">📝 Draft</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar
      </Button>

      {/* Warning */}
      {isDraft && (
        <div className="flex items-start gap-3 bg-muted/60 border rounded-lg p-4">
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
              <p className="text-sm text-muted-foreground">No. Stok Masuk</p>
              <p className="text-2xl font-bold">{bid || "(akan di-generate)"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(isPosted || isDraft) && (
                <Button variant="default" className="bg-blue-500 hover:bg-blue-600 gap-2" onClick={() => window.print()}>
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

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tanggal */}
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Tanggal</h3>
            {!isReadOnly && (
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 gap-1" onClick={() => setEditDateOpen(true)}>
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

        {/* Supplier */}
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Supplier</h3>
            {!isReadOnly && (
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 gap-1" onClick={() => setEditSupplierOpen(true)}>
                <Pencil className="h-3 w-3" /> Ubah
              </Button>
            )}
          </div>
          <div className="px-4 py-3 text-sm min-h-[60px]">
            {supplierName ? (
              <span className="font-medium">{supplierName}</span>
            ) : (
              <span className="text-muted-foreground italic">Belum ada supplier</span>
            )}
          </div>
        </div>

        {/* Catatan */}
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Catatan</h3>
            {!isReadOnly && (
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 gap-1" onClick={() => setEditNotesOpen(true)}>
                <Pencil className="h-3 w-3" /> Ubah
              </Button>
            )}
          </div>
          <div className="px-4 py-3 text-sm min-h-[60px]">
            {notes ? <span>{notes}</span> : <span className="text-muted-foreground italic">Tidak ada catatan</span>}
          </div>
        </div>
      </div>

      {/* Add product */}
      {!isReadOnly && (
        <div className="border rounded-lg bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold">Tambah Produk</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_200px_180px_auto] gap-3 items-start">
            <div>
              <Label className="text-xs text-muted-foreground">Produk</Label>
              <Popover open={newProductSearchOpen} onOpenChange={setNewProductSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative mt-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Cari Produk"
                      value={newProductSearch}
                      onChange={(e) => {
                        setNewProductSearch(e.target.value);
                        if (!newProductSearchOpen) setNewProductSearchOpen(true);
                      }}
                      onFocus={() => setNewProductSearchOpen(true)}
                      className="pl-9 h-10"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width]"
                  align="start"
                  side="bottom"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandEmpty>Produk tidak ditemukan</CommandEmpty>
                      <CommandGroup>
                        {products
                          .filter((p) =>
                            p.name.toLowerCase().includes(newProductSearch.toLowerCase())
                          )
                          .map((p) => {
                          const isSelected = selectedProductIds.includes(p.id);
                          return (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                if (isSelected) {
                                  setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                                } else {
                                  setSelectedProductIds([...selectedProductIds, p.id]);
                                  if (selectedProductIds.length === 0 && newPrice === 0) {
                                    setNewPrice(p.price);
                                  }
                                }
                              }}
                            >
                              <Check className={`h-4 w-4 mr-2 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                              <div className="flex justify-between w-full">
                                <span>{p.name}</span>
                                <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedProductIds.map((pid) => {
                    const p = products.find((x) => x.id === pid);
                    if (!p) return null;
                    return (
                      <Badge
                        key={pid}
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1 pr-1"
                      >
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProductIds(selectedProductIds.filter((id) => id !== pid))}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Harga Beli</Label>
              <Input
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <div className="flex items-center mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-r-none h-10"
                  onClick={() => setNewQty(Math.max(1, newQty - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                  className="rounded-none text-center h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-l-none h-10"
                  onClick={() => setNewQty(newQty + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Button onClick={handleAddItem} className="bg-blue-500 hover:bg-blue-600 h-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Items table */}
      {items.length > 0 && (
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold">Daftar Produk</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Produk</th>
                  <th className="text-right px-4 py-2 font-medium">Harga Beli</th>
                  <th className="text-center px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                  {!isReadOnly && <th className="text-right px-4 py-2 font-medium w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{it.product_name}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(it.unit_price)}</td>
                    <td className="px-4 py-2 text-center">{it.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(it.subtotal)}</td>
                    {!isReadOnly && (
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
                  {!isReadOnly && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Date Dialog */}
      <Dialog open={editDateOpen} onOpenChange={setEditDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Tanggal</DialogTitle>
          </DialogHeader>
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

      {/* Edit Supplier Dialog */}
      <Dialog open={editSupplierOpen} onOpenChange={setEditSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={supplierId || ""}
              onValueChange={(v) => {
                setSupplierId(v);
                const s = suppliers.find((x) => x.id === v);
                setSupplierName(s?.name || "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full gap-2" onClick={() => { setEditSupplierOpen(false); setSupplierFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Tambah Supplier Baru
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplierOpen(false)}>Batal</Button>
            <Button onClick={() => setEditSupplierOpen(false)}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Form */}
      <Dialog open={supplierFormOpen} onOpenChange={setSupplierFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Supplier</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nama Supplier</Label>
            <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Contoh: PT Sinar Jaya" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierFormOpen(false)}>Batal</Button>
            <Button onClick={handleAddSupplier}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={editNotesOpen} onOpenChange={setEditNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Catatan</DialogTitle>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Batalkan Stok Masuk?</DialogTitle>
          </DialogHeader>
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

      {/* Hard Delete Dialog */}
      <AlertDialog open={hardDeleteOpen} onOpenChange={(o) => { if (!o && !hardDeleting) setHardDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus permanen stok masuk?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus permanen dokumen <span className="font-mono font-semibold">{bid}</span>.
              {status === "posted" && (
                <> Stok produk yang sebelumnya ditambahkan akan <b>dikembalikan</b> (dikurangi) terlebih dahulu sebelum dokumen dihapus.</>
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
