import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { cn } from "@/lib/utils";

interface PurchaseItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Supplier {
  id: string;
  name: string;
  notes: string | null;
}

interface AddPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPurchaseModal({ open, onClose, onSuccess }: AddPurchaseModalProps) {
  const { currentStore } = useStore();
  const { methods: paymentMethods } = usePaymentMethods();
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierDescription, setSupplierDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reffNo, setReffNo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([{ product_name: "", quantity: 1, unit_price: 0 }]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);

  useEffect(() => {
    if (!open || !currentStore) return;
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,notes")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setSuppliers((data as Supplier[]) || []);
    })();
  }, [open, currentStore]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierName.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierName]);

  const selectSupplier = (s: Supplier) => {
    setSupplierName(s.name);
    setSupplierDescription(s.notes || "");
    setSupplierOpen(false);
  };

  const addItem = () => setItems([...items, { product_name: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const totalAmount = items.reduce((s, item) => s + item.quantity * item.unit_price, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const handleSubmit = async () => {
    if (!currentStore) return;
    if (!supplierName.trim()) {
      toast.error("Nama supplier wajib diisi");
      return;
    }
    if (items.some((i) => !i.product_name.trim())) {
      toast.error("Nama produk wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: purchase, error } = await supabase
        .from("purchases" as any)
        .insert({
          store_id: currentStore.id,
          supplier_name: supplierName,
          supplier_description: supplierDescription || null,
          date,
          payment_method: paymentMethod,
          reff_no: reffNo || null,
          notes: notes || null,
          amount: totalAmount,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (items.length > 0 && purchase) {
        const itemsData = items.map((item) => ({
          purchase_id: (purchase as any).id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase
          .from("purchase_items" as any)
          .insert(itemsData);

        if (itemsError) throw itemsError;
      }

      toast.success("Pembelian berhasil ditambahkan!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error adding purchase:", error);
      toast.error("Gagal menambahkan pembelian");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSupplierName("");
    setSupplierDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("cash");
    setReffNo("");
    setNotes("");
    setItems([{ product_name: "", quantity: 1, unit_price: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Pembelian</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nama Supplier *</Label>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      value={supplierName}
                      onChange={(e) => {
                        setSupplierName(e.target.value);
                        if (!supplierOpen) setSupplierOpen(true);
                      }}
                      onFocus={() => setSupplierOpen(true)}
                      placeholder="Masukkan nama supplier"
                      className="pr-8"
                    />
                    <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width] max-h-64 overflow-y-auto"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada supplier</div>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSupplier(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent",
                          supplierName === s.name && "bg-accent"
                        )}
                      >
                        <div>
                          <div className="font-medium">{s.name}</div>
                          {s.notes && <div className="text-xs text-muted-foreground line-clamp-1">{s.notes}</div>}
                        </div>
                        {supplierName === s.name && <Check className="h-4 w-4" />}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Deskripsi Supplier</Label>
              <Input
                value={supplierDescription}
                onChange={(e) => setSupplierDescription(e.target.value)}
                placeholder="Deskripsi opsional"
              />
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.length > 0
                    ? paymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.name}>
                          {pm.name}
                        </SelectItem>
                      ))
                    : <>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </>
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>No. Reff</Label>
              <Input
                value={reffNo}
                onChange={(e) => setReffNo(e.target.value)}
                placeholder="No. referensi (opsional)"
              />
            </div>
          </div>

          <div>
            <Label>Catatan</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan opsional..." />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Item Pembelian</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Tambah Item
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  {i === 0 && <Label className="text-xs">Nama Produk</Label>}
                  <Input
                    value={item.product_name}
                    onChange={(e) => updateItem(i, "product_name", e.target.value)}
                    placeholder="Nama produk"
                  />
                </div>
                <div className="w-20">
                  {i === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="w-32">
                  {i === 0 && <Label className="text-xs">Harga</Label>}
                  <Input
                    type="number"
                    min={0}
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-28 text-right text-sm font-medium pt-1">
                  {formatCurrency(item.quantity * item.unit_price)}
                </div>
                {items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <div className="text-right font-bold text-lg border-t pt-2">
              Total: {formatCurrency(totalAmount)}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Pembelian"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
