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

  // Add product row
  const [newProductId, setNewProductId] = useState<string>("");
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
  const saveDraft = async (silent = false): Promise<string | null> => {
    if (!currentStore) return null;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let id = stockInId;

      if (!id) {
        // create
        const { data, error } = await supabase
          .from("stock_in" as any)
          .insert({
            store_id: currentStore.id,
            date,
            supplier_id: supplierId,
            supplier_name: supplierName || null,
            notes: notes || null,
            total_amount: totalAmount,
            status: "draft",
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        id = (data as any).id;
        setBid((data as any).bid);
      } else {
        const { error } = await supabase
          .from("stock_in" as any)
          .update({
            date,
            supplier_id: supplierId,
            supplier_name: supplierName || null,
            notes: notes || null,
            total_amount: totalAmount,
          })
          .eq("id", id);
        if (error) throw error;

        // Replace items: delete existing then re-insert
        await supabase.from("stock_in_items" as any).delete().eq("stock_in_id", id);
      }

      if (items.length > 0 && id) {
        const payload = items.map((it) => ({
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
      toast.error("Gagal menyimpan: " + e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };
  saveDraftRef.current = saveDraft;

  // Auto-save draft on unmount or browser close (only if still draft & has items)
  useEffect(() => {
    const shouldAutoSave = () => {
      const s = stateRef.current;
      return s.status === "draft" && (s.items.length > 0 || s.supplierName || s.notes);
    };
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
    const s = stateRef.current;
    if (s.status === "draft" && (s.items.length > 0 || s.supplierName || s.notes)) {
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
    setStatus("posted");
  };

  // ===== Cancel =====
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

  // ===== Add item =====
  const handleAddItem = () => {
    if (!newProductId) {
      toast.error("Pilih produk");
      return;
    }
    if (newQty <= 0) {
      toast.error("Qty harus lebih dari 0");
      return;
    }
    const p = products.find((x) => x.id === newProductId);
    if (!p) return;
    const subtotal = newQty * newPrice;
    setItems([
      ...items,
      {
        product_id: p.id,
        product_name: p.name,
        quantity: newQty,
        unit_price: newPrice,
        subtotal,
      },
    ]);
    setNewProductId("");
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
              {isPosted && (
                <Button variant="default" className="bg-blue-500 hover:bg-blue-600 gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Cetak
                </Button>
              )}
              {isDraft && (
                <>
                  <Button variant="default" className="bg-blue-500 hover:bg-blue-600 gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Cetak
                  </Button>
                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setCancelOpen(true)}>
                    <X className="h-4 w-4" /> Batalkan
                  </Button>
                  <Button variant="default" className="bg-green-500 hover:bg-green-600 gap-2" onClick={postNow} disabled={saving}>
                    <Check className="h-4 w-4" /> Post Sekarang
                  </Button>
                </>
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
          <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_200px_180px_auto] gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Produk</Label>
              <Popover open={newProductSearchOpen} onOpenChange={setNewProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal mt-1">
                    <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                    {newProductId
                      ? products.find((p) => p.id === newProductId)?.name
                      : <span className="text-muted-foreground">Cari Produk</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Cari produk..." value={newProductSearch} onValueChange={setNewProductSearch} />
                    <CommandList>
                      <CommandEmpty>Produk tidak ditemukan</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              setNewProductId(p.id);
                              setNewPrice(p.price);
                              setNewProductSearchOpen(false);
                            }}
                          >
                            <div className="flex justify-between w-full">
                              <span>{p.name}</span>
                              <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
    </div>
  );
}
