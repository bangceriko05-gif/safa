import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus, Trash2, Calendar as CalendarIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import AddProductDialog, { PickedProduct } from "./AddProductDialog";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

interface Item extends PickedProduct {}

export default function PurchaseForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { currentStore } = useStore();
  const { methods: paymentMethods } = usePaymentMethods();
  const [loading, setLoading] = useState(false);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [receiptStatus, setReceiptStatus] = useState("Belum Diterima");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reffNo, setReffNo] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("tunda");
  const [items, setItems] = useState<Item[]>([]);
  const [discountAll, setDiscountAll] = useState(0);

  const [productOpen, setProductOpen] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,phone,address,notes")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setSuppliers((data as Supplier[]) || []);
    })();
  }, [currentStore]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discountItems = items.reduce((s, i) => s + (i.discount || 0), 0);
  const grandTotal = Math.max(0, subtotal - discountItems - discountAll);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!currentStore) return;
    if (!supplier) return toast.error("Pilih supplier terlebih dahulu");
    if (items.length === 0) return toast.error("Tambahkan minimal 1 produk");

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: purchase, error } = await supabase
        .from("purchases" as any)
        .insert({
          store_id: currentStore.id,
          supplier_name: supplier.name,
          supplier_description: supplier.notes || null,
          date,
          payment_method: paymentMethod,
          reff_no: reffNo || null,
          notes: notes || null,
          amount: grandTotal,
          status,
          receipt_status: receiptStatus,
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
          subtotal: item.quantity * item.unit_price - (item.discount || 0),
        }));
        const { error: itemsError } = await supabase.from("purchase_items" as any).insert(itemsData);
        if (itemsError) throw itemsError;
      }

      toast.success("Pembelian berhasil disimpan!");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan pembelian");
    } finally {
      setLoading(false);
    }
  };

  const isPaid = grandTotal > 0 && paymentMethod && paymentMethod.toLowerCase() !== "hutang";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold">Tambah Pembelian</h2>
                <p className="text-sm text-muted-foreground">Pembelian baru</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={isPaid ? "bg-green-500" : "bg-red-500"}>
                {isPaid ? "Lunas" : "Belum Bayar"}
              </Badge>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunda">Tunda</SelectItem>
                  <SelectItem value="disetujui">Disetujui</SelectItem>
                  <SelectItem value="ditolak">Ditolak</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Supplier</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSupplierOpen(true)}>
              {supplier ? "Ubah" : "Pilih"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-primary font-medium">Nama Supplier</div>
              <div className="text-muted-foreground">{supplier?.name || "-"}</div>
            </div>
            <div>
              <div className="text-primary font-medium">Deskripsi</div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {supplier?.notes || "-"}
              </div>
            </div>
            <div>
              <div className="text-primary font-medium">Telepon</div>
              <div className="text-muted-foreground">{supplier?.phone || "-"}</div>
            </div>
            <div>
              <div className="text-primary font-medium">Alamat</div>
              <div className="text-muted-foreground">{supplier?.address || "-"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Info Penerimaan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Info Penerimaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Status Penerimaan</Label>
              <Select value={receiptStatus} onValueChange={setReceiptStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belum Diterima">Belum Diterima</SelectItem>
                  <SelectItem value="Diterima">Diterima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tanggal Diterima</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Catatan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tidak ada"
              rows={5}
            />
          </CardContent>
        </Card>
      </div>

      {/* Payment method */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Metode Pembayaran</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.length > 0
                  ? paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                    ))
                  : <>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </>}
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
        </CardContent>
      </Card>

      {/* Produk Pesanan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produk Pesanan</CardTitle>
          <Button onClick={() => setProductOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Produk
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-2">Deskripsi</th>
                  <th className="py-2 pr-2 w-20">Qty</th>
                  <th className="py-2 pr-2 w-32">Harga(IDR)</th>
                  <th className="py-2 pr-2 w-28">Diskon</th>
                  <th className="py-2 pr-2 w-36 text-right">Total Harga(IDR)</th>
                  <th className="py-2 w-12">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Belum ada produk
                    </td>
                  </tr>
                ) : (
                  items.map((it, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 pr-2">{it.product_name}</td>
                      <td className="py-2 pr-2">{it.quantity}</td>
                      <td className="py-2 pr-2">{fmt(it.unit_price)}</td>
                      <td className="py-2 pr-2">{fmt(it.discount || 0)}</td>
                      <td className="py-2 pr-2 text-right font-medium">
                        {fmt(it.quantity * it.unit_price - (it.discount || 0))}
                      </td>
                      <td className="py-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-b">
                  <td className="py-2 text-right font-medium" colSpan={1}>Total Pesanan</td>
                  <td className="py-2 pr-2 font-medium">{totalQty}</td>
                  <td colSpan={4}></td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="py-2 pr-2 text-right font-bold">{fmt(subtotal)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">Diskon Item</td>
                  <td className="py-2 pr-2 text-right font-bold">{fmt(discountItems)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">Diskon All Transaksi</td>
                  <td className="py-2 pr-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      value={discountAll}
                      onChange={(e) => setDiscountAll(parseFloat(e.target.value) || 0)}
                      className="h-8 text-right"
                    />
                  </td>
                  <td></td>
                </tr>
                <tr className="border-t">
                  <td colSpan={4} className="py-3 text-right font-bold">Grand Total</td>
                  <td className="py-3 pr-2 text-right font-bold text-lg text-primary">{fmt(grandTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Supplier picker dialog */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Supplier</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Cari supplier..."
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
          />
          <div className="border rounded-md max-h-72 overflow-y-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada supplier</div>
            ) : (
              filteredSuppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSupplier(s); setSupplierOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent border-b last:border-b-0 ${
                    supplier?.id === s.id ? "bg-accent" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.notes && <div className="text-xs text-muted-foreground line-clamp-1">{s.notes}</div>}
                  </div>
                  {supplier?.id === s.id && <Check className="h-4 w-4" />}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddProductDialog
        open={productOpen}
        onClose={() => setProductOpen(false)}
        onAdd={(p) => setItems((prev) => [...prev, p])}
      />
    </div>
  );
}
