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
import { ChevronLeft, Plus, Trash2, Calendar as CalendarIcon, Check, FileText, ShieldCheck, PackageCheck, ClipboardList, Copy, UserPlus, Pencil, X } from "lucide-react";
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
  existingPurchaseId,
}: {
  onCancel: () => void;
  onSuccess: () => void;
  existingPurchaseId?: string | null;
}) {
  const { currentStore } = useStore();
  const { methods: paymentMethods } = usePaymentMethods();
  const [loading, setLoading] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(existingPurchaseId || null);
  const [bid, setBid] = useState<string>("");
  const [creatingDraft, setCreatingDraft] = useState(!existingPurchaseId);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [receiptStatus, setReceiptStatus] = useState("Belum Diterima");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reffNo, setReffNo] = useState("");
  const [notes, setNotes] = useState("");
  // UI status mirrors process_status: "proses" | "selesai" | "batal"
  const [status, setStatus] = useState<"proses" | "selesai" | "batal">("proses");
  const [verificationStatus, setVerificationStatus] = useState<"Unverified" | "Verified">("Unverified");
  const [items, setItems] = useState<Item[]>([]);
  const [discountAll, setDiscountAll] = useState(0);
  const [discountAllMode, setDiscountAllMode] = useState<"rp" | "pct">("rp");
  const [discountAllInput, setDiscountAllInput] = useState(0);
  const [discountAllOpen, setDiscountAllOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPaymentIdx, setEditingPaymentIdx] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [roundingMode, setRoundingMode] = useState<"none" | "up" | "down">("none");
  const [roundingStep, setRoundingStep] = useState(100);
  const [roundingAmount, setRoundingAmount] = useState(0);
  const [roundingManual, setRoundingManual] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<UploadedFile[]>([]);
  const [paymentProofFiles, setPaymentProofFiles] = useState<UploadedFile[]>([]);

  const [productOpen, setProductOpen] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  type PaymentEntry = { method: string; reff: string; amount: number; date: string };
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  // Activity log entries (from saved record)
  const [activityLog, setActivityLog] = useState<
    { icon: any; label: string; user: string; at: string }[]
  >([]);
  const [savedOnce, setSavedOnce] = useState(false);

  const refreshActivityLog = async (id: string) => {
    const { data } = await supabase
      .from("purchases" as any)
      .select("created_by,created_at,posted_by,posted_at,received_by,received_at,verified_by,verified_at")
      .eq("id", id)
      .single();
    if (!data) return;
    const d: any = data;
    const ids = [d.created_by, d.posted_by, d.received_by, d.verified_by].filter(Boolean);
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
    if (d.created_at)
      log.push({ icon: UserPlus, label: "Dibuat oleh", user: nameMap.get(d.created_by) || "-", at: fmtAt(d.created_at) });
    if (d.posted_at)
      log.push({ icon: ClipboardList, label: "Diposting oleh", user: nameMap.get(d.posted_by) || "-", at: fmtAt(d.posted_at) });
    if (d.received_at)
      log.push({ icon: PackageCheck, label: "Diterima oleh", user: nameMap.get(d.received_by) || "-", at: fmtAt(d.received_at) });
    if (d.verified_at)
      log.push({ icon: ShieldCheck, label: "Diverifikasi oleh", user: nameMap.get(d.verified_by) || "-", at: fmtAt(d.verified_at) });
    setActivityLog(log);
  };

  // Auto-create draft purchase row when form opens to obtain a BID,
  // OR load an existing draft if existingPurchaseId is provided
  useEffect(() => {
    if (!currentStore) return;
    if (purchaseId && !existingPurchaseId) return;
    if (existingPurchaseId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("purchases" as any)
            .select("*")
            .eq("id", existingPurchaseId)
            .single();
          if (error) throw error;
          const d: any = data;
          setBid(d.bid || "");
          setDate(d.date || new Date().toISOString().split("T")[0]);
          setPaymentMethod(d.payment_method || "cash");
          setReffNo(d.reff_no || "");
          setNotes(d.notes || "");
          setStatus(
            (d.process_status as "proses" | "selesai" | "batal") ||
              (d.status === "batal" ? "batal" : d.status === "disetujui" ? "selesai" : "proses")
          );
          setVerificationStatus(d.verification_status || "Unverified");
          setReceiptStatus(d.receipt_status || "Belum Diterima");
          setDiscountAll(Number(d.discount_all) || 0);
          setRoundingAmount(Number(d.rounding_amount) || 0);
          setRoundingMode(d.rounding_mode || "none");
          setPaidAmount(Number(d.paid_amount) || 0);
          setPayments(((d.payments as any[]) || []) as PaymentEntry[]);
          setReceiptFiles((d.receipt_files as any) || []);
          setPaymentProofFiles((d.payment_proof_files as any) || []);
          if (d.supplier_name) {
            setSupplier({
              id: "",
              name: d.supplier_name,
              phone: null,
              address: null,
              notes: d.supplier_description || null,
            });
          }
          // Load items
          const { data: itemsData } = await supabase
            .from("purchase_items" as any)
            .select("*")
            .eq("purchase_id", existingPurchaseId);
          if (itemsData) {
            setItems(
              (itemsData as any[]).map((it) => ({
                product_id: it.product_id || null,
                product_name: it.product_name,
                quantity: Number(it.quantity),
                unit_price: Number(it.unit_price),
                discount: Number(it.quantity) * Number(it.unit_price) - Number(it.subtotal),
              }))
            );
          }
          await refreshActivityLog(existingPurchaseId);
        } catch (e) {
          console.error(e);
          toast.error("Gagal memuat draft pembelian");
        } finally {
          setCreatingDraft(false);
        }
      })();
      return;
    }
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
        await refreshActivityLog((data as any).id);
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

  // Autosave draft (debounced) so progress persists when user navigates away
  useEffect(() => {
    if (!purchaseId || creatingDraft) return;
    const handle = setTimeout(async () => {
      try {
        await supabase
          .from("purchases" as any)
          .update({
            supplier_name: supplier?.name || "",
            supplier_description: supplier?.notes || null,
            date,
            payment_method: paymentMethod,
            reff_no: reffNo || null,
            notes: notes || null,
            amount: Math.max(0, items.reduce((s, i) => s + i.quantity * i.unit_price, 0) - items.reduce((s, i) => s + (i.discount || 0), 0) - discountAll) + roundingAmount,
            discount_all: discountAll,
            rounding_amount: roundingAmount,
            rounding_mode: roundingMode,
            paid_amount: paidAmount,
            payments: payments as any,
            receipt_files: receiptFiles as any,
            payment_proof_files: paymentProofFiles as any,
            status,
            receipt_status: receiptStatus,
            verification_status: verificationStatus,
          })
          .eq("id", purchaseId)
          .eq("is_draft", true);
        // Replace items
        await supabase.from("purchase_items" as any).delete().eq("purchase_id", purchaseId);
        if (items.length > 0) {
          await supabase.from("purchase_items" as any).insert(
            items.map((item) => ({
              purchase_id: purchaseId,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.quantity * item.unit_price - (item.discount || 0),
            }))
          );
        }
      } catch (e) {
        console.error("Autosave draft failed", e);
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [purchaseId, creatingDraft, supplier, date, paymentMethod, reffNo, notes, items, discountAll, roundingAmount, roundingMode, paidAmount, payments, receiptFiles, paymentProofFiles, status, receiptStatus, verificationStatus]);

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
    const isCancelled = status === "batal";
    const isDone = status === "selesai";
    if (!isCancelled && !supplier) return toast.error("Pilih supplier terlebih dahulu");
    if (!isCancelled && items.length === 0) return toast.error("Tambahkan minimal 1 produk");

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const update: any = {
        supplier_name: supplier?.name || "",
        supplier_description: supplier?.notes || null,
        date,
        payment_method: paymentMethod,
        reff_no: reffNo || null,
        notes: notes || null,
        amount: grandTotal,
        discount_all: discountAll,
        rounding_amount: roundingAmount,
        rounding_mode: roundingMode,
        paid_amount: paidAmount,
        payments: payments as any,
        receipt_files: receiptFiles as any,
        payment_proof_files: paymentProofFiles as any,
        payment_proof_url: paymentProofFiles[0]?.url || null,
        status: isCancelled ? "batal" : isDone ? "disetujui" : "tunda",
        receipt_status: receiptStatus,
        verification_status: verificationStatus,
        is_draft: false,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
        process_status: status,
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

      // If received, mirror items into Inventory > Stock Masuk using the same BID
      if (receiptStatus === "Diterima") {
        const validItems = items.filter((it) => it.product_id);
        if (validItems.length === 0) {
          toast.warning("Penerimaan dicatat, namun tidak ada produk dengan referensi inventori untuk dikirim ke stok masuk.");
        } else {
          // Find existing stock_in with same BID (idempotent)
          const { data: existing } = await supabase
            .from("stock_in" as any)
            .select("id")
            .eq("store_id", currentStore.id)
            .eq("bid", bid)
            .maybeSingle();

          const totalAmount = validItems.reduce(
            (s, it) => s + it.quantity * it.unit_price - (it.discount || 0),
            0
          );

          let stockInId = (existing as any)?.id as string | undefined;

          if (stockInId) {
            await supabase
              .from("stock_in" as any)
              .update({
                date,
                supplier_name: supplier.name,
                notes: notes || null,
                total_amount: totalAmount,
                status: "posted",
                posted_at: new Date().toISOString(),
                posted_by: user.id,
              })
              .eq("id", stockInId);
            await supabase.from("stock_in_items" as any).delete().eq("stock_in_id", stockInId);
          } else {
            const { data: created, error: siErr } = await supabase
              .from("stock_in" as any)
              .insert({
                store_id: currentStore.id,
                bid,
                date,
                supplier_name: supplier.name,
                notes: notes || null,
                total_amount: totalAmount,
                status: "posted",
                posted_at: new Date().toISOString(),
                posted_by: user.id,
                created_by: user.id,
              })
              .select("id")
              .single();
            if (siErr) throw siErr;
            stockInId = (created as any).id;
          }

          const stockItems = validItems.map((it) => ({
            stock_in_id: stockInId,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: it.quantity * it.unit_price - (it.discount || 0),
          }));
          const { error: siiErr } = await supabase
            .from("stock_in_items" as any)
            .insert(stockItems);
          if (siiErr) throw siiErr;
        }
      }

      toast.success("Pembelian berhasil disimpan!");
      setSavedOnce(true);
      await refreshActivityLog(purchaseId);
      // If user marked Selesai or Batal, return to transaction list
      if (isDone || isCancelled) {
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
              <Select value={status} onValueChange={(v) => setStatus(v as "proses" | "selesai" | "batal")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
              <SelectItem value="proses">Proses</SelectItem>
              <SelectItem value="selesai">Selesai</SelectItem>
              <SelectItem value="batal">Batal</SelectItem>
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

      {/* List Produk Pesanan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">List Produk Pesanan</CardTitle>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-blue-600 hover:text-blue-700"
                            onClick={() => { setEditingItemIdx(i); setProductOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Ubah
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => removeItem(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                          </Button>
                        </div>
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
                      onClick={() => {
                        // If a payment already exists, edit the most recent one
                        if (payments.length > 0) {
                          setEditingPaymentIdx(payments.length - 1);
                        } else {
                          setEditingPaymentIdx(null);
                        }
                        setPaymentDialogOpen(true);
                      }}
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
                {payments.length > 0 && (
                  <tr>
                    <td colSpan={6} className="py-3">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {payments.map((p, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-3 rounded-md bg-green-600 text-white px-3 py-2 text-xs shadow-sm"
                          >
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold">{p.method}</span>
                              <span className="opacity-90">{p.reff || "-"}</span>
                            </div>
                            <div className="flex flex-col leading-tight text-right">
                              <span className="font-semibold">{fmt(p.amount)}</span>
                              <span className="opacity-90">
                                {format(new Date(p.date), "dd-MMM-yyyy", { locale: localeId })}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPayments((prev) => prev.filter((_, j) => j !== idx));
                                setPaidAmount((prev) => Math.max(0, prev - p.amount));
                              }}
                              className="ml-1 rounded-full hover:bg-white/20 p-0.5"
                              title="Hapus pembayaran"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
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
        onClose={() => { setProductOpen(false); setEditingItemIdx(null); }}
        editing={editingItemIdx !== null ? items[editingItemIdx] : null}
        onAdd={(p) => {
          if (editingItemIdx !== null) {
            setItems((prev) => prev.map((it, idx) => idx === editingItemIdx ? p : it));
            setEditingItemIdx(null);
          } else {
            setItems((prev) => [...prev, p]);
          }
        }}
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
        onClose={() => { setPaymentDialogOpen(false); setEditingPaymentIdx(null); }}
        remaining={
          editingPaymentIdx !== null
            ? Math.max(0, grandTotal - paidAmount + (payments[editingPaymentIdx]?.amount || 0))
            : Math.max(0, grandTotal - paidAmount)
        }
        paymentMethods={paymentMethods}
        initialMethod={
          editingPaymentIdx !== null ? payments[editingPaymentIdx]?.method : paymentMethod
        }
        initialReff={
          editingPaymentIdx !== null ? payments[editingPaymentIdx]?.reff : reffNo
        }
        initialAmount={
          editingPaymentIdx !== null
            ? payments[editingPaymentIdx]?.amount
            : Math.max(0, grandTotal - paidAmount)
        }
        onApply={({ method, reff, amount }) => {
          setPaymentMethod(method);
          setReffNo(reff);
          if (editingPaymentIdx !== null) {
            const oldAmount = payments[editingPaymentIdx]?.amount || 0;
            setPaidAmount((prev) => Math.max(0, prev - oldAmount + amount));
            setPayments((prev) =>
              prev.map((p, j) =>
                j === editingPaymentIdx
                  ? { ...p, method, reff, amount, date: new Date().toISOString() }
                  : p,
              ),
            );
            setEditingPaymentIdx(null);
          } else {
            setPaidAmount((prev) => prev + amount);
            setPayments((prev) => [
              ...prev,
              { method, reff, amount, date: new Date().toISOString() },
            ]);
          }
        }}
      />
    </div>
  );
}
