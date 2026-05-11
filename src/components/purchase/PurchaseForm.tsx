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
import { ChevronLeft, Plus, Trash2, Calendar as CalendarIcon, Check, FileText, ShieldCheck, PackageCheck, ClipboardList, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import AddProductDialog, { PickedProduct } from "./AddProductDialog";
import FileUploadGrid, { UploadedFile } from "./FileUploadGrid";
import DiscountDialog from "./DiscountDialog";
import PaymentDialog from "./PaymentDialog";

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
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [bid, setBid] = useState<string>("");
  const [creatingDraft, setCreatingDraft] = useState(true);

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
  const [verificationStatus, setVerificationStatus] = useState<"Unverified" | "Verified">("Unverified");
  const [items, setItems] = useState<Item[]>([]);
  const [discountAll, setDiscountAll] = useState(0);
  const [discountAllMode, setDiscountAllMode] = useState<"rp" | "pct">("rp");
  const [discountAllInput, setDiscountAllInput] = useState(0);
  const [discountAllOpen, setDiscountAllOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [roundingMode, setRoundingMode] = useState<"none" | "up" | "down">("none");
  const [roundingStep, setRoundingStep] = useState(100);
  const [roundingAmount, setRoundingAmount] = useState(0);
  const [roundingManual, setRoundingManual] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<UploadedFile[]>([]);
  const [paymentProofFiles, setPaymentProofFiles] = useState<UploadedFile[]>([]);

  const [productOpen, setProductOpen] = useState(false);

  // Activity log entries (from saved record)
  const [activityLog, setActivityLog] = useState<
    { icon: any; label: string; user: string; at: string }[]
  >([]);
  const [savedOnce, setSavedOnce] = useState(false);

  const refreshActivityLog = async (id: string) => {
    const { data } = await supabase
      .from("purchases" as any)
      .select("posted_by,posted_at,received_by,received_at,verified_by,verified_at")
      .eq("id", id)
      .single();
    if (!data) return;
    const d: any = data;
    const ids = [d.posted_by, d.received_by, d.verified_by].filter(Boolean);
    const nameMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", ids as string[]);
      (profs as any[])?.forEach((p) => nameMap.set(p.id, p.name || p.email || "Pengguna"));
    }
    const fmtAt = (iso: string) =>
      format(new Date(iso), "dd MMM yyyy HH:mm", { locale: localeId });
    const log: { icon: any; label: string; user: string; at: string }[] = [];
    if (d.posted_at)
      log.push({ icon: ClipboardList, label: "Diposting oleh", user: nameMap.get(d.posted_by) || "-", at: fmtAt(d.posted_at) });
    if (d.received_at)
      log.push({ icon: PackageCheck, label: "Diterima oleh", user: nameMap.get(d.received_by) || "-", at: fmtAt(d.received_at) });
    if (d.verified_at)
      log.push({ icon: ShieldCheck, label: "Diverifikasi oleh", user: nameMap.get(d.verified_by) || "-", at: fmtAt(d.verified_at) });
    setActivityLog(log);
  };

  // Auto-create draft purchase row when form opens to obtain a BID
  useEffect(() => {
    if (!currentStore) return;
    if (purchaseId) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data, error } = await supabase
          .from("purchases" as any)
          .insert({
            store_id: currentStore.id,
            supplier_name: "",
            date,
            amount: 0,
            status: "tunda",
            process_status: "proses",
            verification_status: "Unverified",
            receipt_status: "Belum Diterima",
            is_draft: true,
            created_by: user.id,
          } as any)
          .select()
          .single();
        if (error) throw error;
        setPurchaseId((data as any).id);
        setBid((data as any).bid || "");
      } catch (e) {
        console.error(e);
        toast.error("Gagal membuat draft pembelian");
      } finally {
        setCreatingDraft(false);
      }
    })();
  }, [currentStore]);

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
  const beforeRounding = Math.max(0, subtotal - discountItems - discountAll);

  // Auto rounding (unless user manually overrode)
  useEffect(() => {
    if (roundingManual) return;
    if (roundingMode === "none" || roundingStep <= 0) {
      setRoundingAmount(0);
      return;
    }
    const remainder = beforeRounding % roundingStep;
    if (remainder === 0) {
      setRoundingAmount(0);
      return;
    }
    if (roundingMode === "up") {
      setRoundingAmount(roundingStep - remainder);
    } else {
      setRoundingAmount(-remainder);
    }
  }, [beforeRounding, roundingMode, roundingStep, roundingManual]);

  const grandTotal = Math.max(0, beforeRounding + roundingAmount);
  const remainingPayment = Math.max(0, grandTotal - paidAmount);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!currentStore || !purchaseId) return;
    if (!supplier) return toast.error("Pilih supplier terlebih dahulu");
    if (items.length === 0) return toast.error("Tambahkan minimal 1 produk");

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const update: any = {
        supplier_name: supplier.name,
        supplier_description: supplier.notes || null,
        date,
        payment_method: paymentMethod,
        reff_no: reffNo || null,
        notes: notes || null,
        amount: grandTotal,
        discount_all: discountAll,
        rounding_amount: roundingAmount,
        rounding_mode: roundingMode,
        paid_amount: paidAmount,
        receipt_files: receiptFiles as any,
        payment_proof_files: paymentProofFiles as any,
        payment_proof_url: paymentProofFiles[0]?.url || null,
        status,
        receipt_status: receiptStatus,
        verification_status: verificationStatus,
        is_draft: false,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
        process_status: verificationStatus === "Verified" ? "selesai" : "proses",
      };
      if (verificationStatus === "Verified") {
        update.verified_by = user.id;
        update.verified_at = new Date().toISOString();
      }
      if (receiptStatus === "Diterima") {
        update.received_by = user.id;
        update.received_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("purchases" as any)
        .update(update)
        .eq("id", purchaseId);
      if (error) throw error;

      // Replace items
      await supabase.from("purchase_items" as any).delete().eq("purchase_id", purchaseId);
      if (items.length > 0) {
        const itemsData = items.map((item) => ({
          purchase_id: purchaseId,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price - (item.discount || 0),
        }));
        const { error: itemsError } = await supabase.from("purchase_items" as any).insert(itemsData);
        if (itemsError) throw itemsError;
      }

      toast.success("Pembelian berhasil disimpan!");
      setSavedOnce(true);
      await refreshActivityLog(purchaseId);
      // If verified -> finished, close form to return to list
      if (verificationStatus === "Verified") {
        onSuccess();
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan pembelian");
    } finally {
      setLoading(false);
    }
  };

  const isPaid = grandTotal > 0 && paidAmount >= grandTotal;

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
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">BID:</span>
                  <span className="font-mono font-semibold text-sm">
                    {creatingDraft ? "Membuat draft..." : bid || "-"}
                  </span>
                  {bid && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        navigator.clipboard.writeText(bid);
                        toast.success("BID disalin");
                      }}
                      title="Salin BID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Badge variant="secondary" className="text-[10px] h-5">Draft tersimpan</Badge>
                </div>
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
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Verifikasi
              </Label>
              <Select value={verificationStatus} onValueChange={(v) => setVerificationStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unverified">Unverified</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tidak ada"
              rows={3}
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
                  <td className="py-2 pr-2 text-right font-bold">{fmt(discountAll)}</td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-7 px-1"
                      onClick={() => setDiscountAllOpen(true)}
                    >
                      Diskon
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">
                    Pembulatan
                    <Select
                      value={roundingMode}
                      onValueChange={(v) => { setRoundingManual(false); setRoundingMode(v as any); }}
                    >
                      <SelectTrigger className="inline-flex h-7 w-32 ml-2 align-middle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa</SelectItem>
                        <SelectItem value="up">Ke Atas</SelectItem>
                        <SelectItem value="down">Ke Bawah</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Input
                      type="number"
                      value={roundingAmount}
                      onChange={(e) => { setRoundingManual(true); setRoundingAmount(parseFloat(e.target.value) || 0); }}
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min={1}
                      value={roundingStep}
                      onChange={(e) => { setRoundingManual(false); setRoundingStep(parseInt(e.target.value) || 100); }}
                      className="h-8 text-right"
                      title="Kelipatan pembulatan"
                    />
                  </td>
                </tr>
                <tr className="border-t">
                  <td colSpan={4} className="py-3 text-right font-bold">Total Ditagihkan</td>
                  <td className="py-3 pr-2 text-right font-bold text-lg text-primary">{fmt(grandTotal)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">Jumlah Terbayar</td>
                  <td className="py-2 pr-2 text-right">
                    <span className="font-bold">{fmt(paidAmount)}</span>
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-7 px-1"
                      onClick={() => setPaymentDialogOpen(true)}
                    >
                      Pembayaran
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 text-right text-muted-foreground">Pembayaran yang belum lunas</td>
                  <td className={`py-2 pr-2 text-right font-bold ${remainingPayment > 0 ? "text-destructive" : ""}`}>
                    {fmt(remainingPayment)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* File Lampiran */}
      {currentStore && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">File Lampiran</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileUploadGrid
              label="Bukti Nota (opsional)"
              files={receiptFiles}
              onChange={setReceiptFiles}
              storeId={currentStore.id}
              folder="nota"
            />
            <FileUploadGrid
              label="Bukti Pembayaran (opsional)"
              files={paymentProofFiles}
              onChange={setPaymentProofFiles}
              storeId={currentStore.id}
              folder="bukti-bayar"
            />
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Log Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLog.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {savedOnce
                ? "Belum ada aktivitas tercatat."
                : "Aktivitas akan tercatat setelah pembelian disimpan."}
            </div>
          ) : (
            <ul className="space-y-2">
              {activityLog.map((e, i) => {
                const Icon = e.icon;
                return (
                  <li key={i} className="flex items-start gap-3 text-sm border-l-2 border-primary pl-3 py-1">
                    <Icon className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div>
                        <span className="text-muted-foreground">{e.label}</span>{" "}
                        <span className="font-medium">{e.user}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{e.at}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

      <DiscountDialog
        open={discountAllOpen}
        onClose={() => setDiscountAllOpen(false)}
        baseAmount={Math.max(0, subtotal - discountItems)}
        initialMode={discountAllMode}
        initialValue={discountAllInput}
        title="Diskon Semua Transaksi"
        onApply={(abs, mode, value) => {
          setDiscountAll(abs);
          setDiscountAllMode(mode);
          setDiscountAllInput(value);
        }}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        remaining={Math.max(0, grandTotal - paidAmount)}
        paymentMethods={paymentMethods}
        initialMethod={paymentMethod}
        initialReff={reffNo}
        initialAmount={Math.max(0, grandTotal - paidAmount)}
        onApply={(method, reff, amount) => {
          setPaymentMethod(method);
          setReffNo(reff);
          setPaidAmount((prev) => prev + amount);
        }}
      />
    </div>
  );
}
