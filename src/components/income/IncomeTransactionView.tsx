import { useState, useEffect, useMemo } from "react";
import { createAutoHutang, handleHutangOnEdit } from "@/utils/autoHutang";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Copy, FileText, CalendarIcon, Trash2, Printer, ChevronLeft, Upload, Loader2, X, Image as ImageIcon, Pencil } from "lucide-react";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "../reports/ReportDateFilter";
import { DateRange } from "react-day-picker";

interface Income {
  id: string;
  bid: string;
  description: string | null;
  amount: number;
  customer_name: string | null;
  category: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  verification_status: string;
  status: string;
  process_status: string;
  reference_no: string | null;
  date: string;
  created_by: string;
  store_id: string;
}

const PROCESS_TABS = [
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
  { key: "batal", label: "Batal" },
  { key: "dihapus", label: "Dihapus" },
];

interface IncomeTransactionViewProps {
  timeRange: ReportTimeRange;
  customDateRange?: DateRange;
  searchQuery: string;
}

export default function IncomeTransactionView({ timeRange, customDateRange, searchQuery }: IncomeTransactionViewProps) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions();
  const { isFeatureEnabled } = useStoreFeatures(currentStore?.id);
  const showVerification = isFeatureEnabled("reports.accounting");
  const { activeMethodNames } = usePaymentMethods();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [processTab, setProcessTab] = useState("proses");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [noteDialogData, setNoteDialogData] = useState<Income | null>(null);
  const [printPreviewId, setPrintPreviewId] = useState<string | null>(null);

  // Detail/Edit income inline state
  const [viewingIncome, setViewingIncome] = useState<Income | null>(null);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [editIncomeForm, setEditIncomeForm] = useState({ description: "", amount: "", customer_name: "", payment_method: "", date: "" });

  const openDetailView = (income: Income) => {
    setViewingIncome(income);
    setIsEditingIncome(false);
    setEditIncomeForm({
      description: income.description || "",
      amount: formatAmountInput(String(income.amount)),
      customer_name: income.customer_name || "",
      payment_method: income.payment_method || "",
      date: income.date,
    });
  };

  const closeDetailView = () => {
    setViewingIncome(null);
    setIsEditingIncome(false);
  };

  const handleSaveEditIncome = async () => {
    if (!viewingIncome) return;
    if (!editIncomeForm.customer_name.trim()) { toast.error("Nama pelanggan harus diisi"); return; }
    if (!editIncomeForm.amount) { toast.error("Jumlah harus diisi"); return; }
    try {
      const { error } = await supabase
        .from("incomes")
        .update({
          description: editIncomeForm.description || null,
          amount: parseFloat(editIncomeForm.amount.replace(/\./g, "")) || 0,
          customer_name: editIncomeForm.customer_name,
          payment_method: editIncomeForm.payment_method || null,
          date: editIncomeForm.date,
        })
        .eq("id", viewingIncome.id);
      if (error) throw error;

      await handleHutangOnEdit({
        previousPaymentMethod: viewingIncome.payment_method,
        newPaymentMethod: editIncomeForm.payment_method,
        amount: parseFloat(editIncomeForm.amount.replace(/\./g, "")) || 0,
        supplierName: editIncomeForm.customer_name,
        description: `Pemasukan - ${editIncomeForm.customer_name}`,
        storeId: currentStore!.id,
        userId: (await supabase.auth.getUser()).data.user!.id,
        bid: viewingIncome.bid,
      });

      toast.success("Pemasukan berhasil diperbarui");
      closeDetailView();
      fetchIncomes();
    } catch (error) {
      toast.error("Gagal memperbarui pemasukan");
    }
  };

  // Add income dialog state
  const [addingIncome, setAddingIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ description: "", amount: "", customer_name: "", customer_phone: "", payment_method: "", reference_no: "", date: format(new Date(), "yyyy-MM-dd") });
  const [incomePaymentProof, setIncomePaymentProof] = useState<string | null>(null);
  const [incomeProducts, setIncomeProducts] = useState<{ product_id: string; product_name: string; product_price: number; quantity: number; subtotal: number; discount_type: "percentage" | "fixed"; discount_value: string }[]>([]);
  const [incomeDiscount, setIncomeDiscount] = useState({ type: "percentage" as "percentage" | "fixed", value: "" });
  const [showDiscountPopover, setShowDiscountPopover] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const formatAmountInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const fetchProducts = async () => {
    if (!currentStore) return;
    const { data } = await supabase.from("products").select("id, name, price").eq("store_id", currentStore.id).order("name");
    setAvailableProducts(data || []);
  };

  const fetchCustomers = async () => {
    if (!currentStore) return;
    const { data } = await supabase.from("customers").select("id, name, phone").eq("store_id", currentStore.id).order("name");
    setCustomers(data || []);
  };

  const calcItemSubtotal = (qty: number, price: number, discType: "percentage" | "fixed", discVal: string) => {
    const gross = qty * price;
    const dv = parseFloat(discVal) || 0;
    const discAmount = discType === "percentage" ? gross * (dv / 100) : dv;
    return Math.max(0, gross - discAmount);
  };

  const getIncomeTotal = () => {
    const productsTotal = incomeProducts.reduce((sum, p) => sum + p.subtotal, 0);
    const manualAmount = parseFloat(incomeForm.amount.replace(/\./g, "")) || 0;
    const subtotal = incomeProducts.length > 0 ? productsTotal : manualAmount;
    let discountAmount = 0;
    const discountVal = parseFloat(incomeDiscount.value) || 0;
    if (incomeDiscount.type === "percentage") {
      discountAmount = subtotal * (discountVal / 100);
    } else {
      discountAmount = discountVal;
    }
    return Math.max(0, subtotal - discountAmount);
  };

  const updateProductField = (index: number, updates: Partial<typeof incomeProducts[0]>) => {
    setIncomeProducts(prev => prev.map((ip, idx) => {
      if (idx !== index) return ip;
      const updated = { ...ip, ...updates };
      updated.subtotal = calcItemSubtotal(updated.quantity, updated.product_price, updated.discount_type, updated.discount_value);
      return updated;
    }));
  };

  const handleAddProductToIncome = (product: { id: string; name: string; price: number }) => {
    const existing = incomeProducts.find(p => p.product_id === product.id);
    if (existing) {
      setIncomeProducts(incomeProducts.map(p =>
        p.product_id === product.id
          ? { ...p, quantity: p.quantity + 1, subtotal: calcItemSubtotal(p.quantity + 1, p.product_price, p.discount_type, p.discount_value) }
          : p
      ));
    } else {
      setIncomeProducts([...incomeProducts, {
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity: 1,
        subtotal: product.price,
        discount_type: "percentage",
        discount_value: "",
      }]);
    }
    setProductSearch("");
    setShowProductSearch(false);
  };

  const handleAddIncome = async () => {
    if (!currentStore) return;
    if (!incomeForm.customer_name.trim()) { toast.error("Nama pelanggan harus diisi"); return; }
    if (!incomeForm.payment_method) { toast.error("Metode bayar harus diisi"); return; }
    const totalAmount = getIncomeTotal();
    if (totalAmount <= 0 && incomeProducts.length === 0 && !incomeForm.amount) { toast.error("Jumlah harus diisi"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Anda harus login"); return; }
      const paidAmount = parseFloat(incomeForm.amount.replace(/\./g, "")) || 0;
      const { data: incomeData, error } = await supabase.from("incomes").insert([{
        description: incomeForm.description || null,
        amount: totalAmount,
        paid_amount: paidAmount,
        customer_name: incomeForm.customer_name,
        payment_method: incomeForm.payment_method,
        payment_proof_url: incomePaymentProof,
        reference_no: incomeForm.reference_no || null,
        date: incomeForm.date,
        created_by: user.id,
        store_id: currentStore.id,
      }]).select().single();
      if (error) throw error;
      if (incomeProducts.length > 0 && incomeData) {
        const { error: prodError } = await supabase.from("income_products").insert(
          incomeProducts.map(p => ({
            income_id: incomeData.id,
            product_id: p.product_id,
            product_name: p.product_name,
            product_price: p.product_price,
            quantity: p.quantity,
            subtotal: p.subtotal,
          }))
        );
        if (prodError) console.error("Error inserting income products:", prodError);
      }

      // Auto-create hutang if payment method is Hutang
      await createAutoHutang({
        paymentMethod: incomeForm.payment_method,
        amount: totalAmount,
        supplierName: incomeForm.customer_name,
        description: `Pemasukan - ${incomeForm.customer_name}${incomeForm.description ? ` - ${incomeForm.description}` : ''}`,
        storeId: currentStore.id,
        userId: user.id,
        bid: incomeData?.bid || null,
      });

      toast.success("Pemasukan berhasil ditambahkan");
      // Show print preview
      if (incomeData?.id) {
        setPrintPreviewId(incomeData.id);
      }
      setAddingIncome(false);
      setIncomeForm({ description: "", amount: "", customer_name: "", customer_phone: "", payment_method: "", reference_no: "", date: format(new Date(), "yyyy-MM-dd") });
      setIncomePaymentProof(null);
      setIncomeProducts([]);
      setIncomeDiscount({ type: "percentage", value: "" });
      fetchIncomes();
    } catch (error) {
      toast.error("Gagal menambahkan pemasukan");
    }
  };

  const fetchIncomes = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange, customDateRange);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("store_id", currentStore.id)
        .eq("process_status", processTab)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: false });

      if (error) throw error;
      setIncomes((data as any[]) || []);
    } catch (error) {
      console.error("Error fetching incomes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes();
    fetchProducts();
    fetchCustomers();
  }, [currentStore, processTab, timeRange, customDateRange]);

  const filteredIncomes = useMemo(() => {
    let result = incomes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.customer_name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.bid?.toLowerCase().includes(q)
      );
    }
    if (paymentFilter !== "all") {
      result = result.filter((i) => i.payment_method === paymentFilter);
    }
    if (verificationFilter !== "all") {
      result = result.filter((i) => i.verification_status === verificationFilter);
    }
    return result;
  }, [incomes, searchQuery, paymentFilter, verificationFilter]);

  const total = useMemo(() => filteredIncomes.reduce((s, i) => s + Number(i.amount), 0), [filteredIncomes]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const updateField = async (id: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      if (field === "status") {
        if (value === "tunda") updateData.process_status = "proses";
        else if (value === "selesai") updateData.process_status = "selesai";
        else if (value === "batal") updateData.process_status = "batal";
      }
      const { error } = await supabase
        .from("incomes")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      if (field === "status" && updateData.process_status && updateData.process_status !== processTab) {
        setIncomes((prev) => prev.filter((i) => i.id !== id));
      } else {
        setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, ...updateData } : i)));
      }
      toast.success("Data berhasil diperbarui");
    } catch (error) {
      console.error("Error updating income:", error);
      toast.error("Gagal memperbarui data");
    }
  };

  const copyBid = (bid: string) => {
    navigator.clipboard.writeText(bid);
    toast.success("BID disalin!");
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set(incomes.map((i) => i.payment_method).filter(Boolean));
    return Array.from(methods) as string[];
  }, [incomes]);

  const dateRangeLabel = getDateRangeDisplay(timeRange, customDateRange);

  // If adding income, show inline form
  if (addingIncome) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => {
                  setAddingIncome(false);
                  setIncomeProducts([]);
                  setIncomeDiscount({ type: "percentage", value: "" });
                  setProductSearch("");
                  setShowProductSearch(false);
                  setIncomePaymentProof(null);
                }}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-xl font-bold">Tambah Pemasukan Manual</CardTitle>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tanggal</Label>
                <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} className="w-auto" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Nama Pelanggan & No. HP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label>Nama Pelanggan</Label>
                <Input
                  value={customerSearch || incomeForm.customer_name}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => { setCustomerSearch(""); setShowCustomerDropdown(true); }}
                  placeholder="Ketik nama pelanggan..."
                />
                {showCustomerDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-md">
                    {customers
                      .filter(c => c.name.toLowerCase().includes((customerSearch || "").toLowerCase()) || c.phone.includes(customerSearch || ""))
                      .map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 cursor-pointer hover:bg-accent text-sm"
                          onClick={() => {
                            setIncomeForm({ ...incomeForm, customer_name: c.name, customer_phone: c.phone });
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        </div>
                      ))}
                    {customers.filter(c => c.name.toLowerCase().includes((customerSearch || "").toLowerCase()) || c.phone.includes(customerSearch || "")).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>No. HP</Label>
                <Input
                  value={incomeForm.customer_phone}
                  onChange={(e) => setIncomeForm({ ...incomeForm, customer_phone: e.target.value })}
                  placeholder="Ketik nomor HP..."
                />
              </div>
            </div>


            {/* Produk section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produk (opsional)</Label>
                <Button variant="outline" size="sm" onClick={() => setShowProductSearch(!showProductSearch)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Produk
                </Button>
              </div>
              {showProductSearch && (
                <div className="relative">
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Cari produk..."
                    autoFocus
                  />
                  {productSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {availableProducts
                        .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                        .map(product => (
                          <div
                            key={product.id}
                            className="px-3 py-2 hover:bg-accent cursor-pointer text-sm flex justify-between"
                            onClick={() => handleAddProductToIncome(product)}
                          >
                            <span>{product.name}</span>
                            <span className="text-muted-foreground">{formatCurrency(product.price)}</span>
                          </div>
                        ))
                      }
                      {availableProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Produk tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              )}
               {incomeProducts.length > 0 && (
                <div className="space-y-1">
                  {incomeProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm w-full">
                      <div className="font-medium min-w-[120px] shrink-0">{p.product_name}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          if (p.quantity > 1) {
                            updateProductField(i, { quantity: p.quantity - 1 });
                          } else {
                            setIncomeProducts(incomeProducts.filter((_, idx) => idx !== i));
                          }
                        }}>
                          <span className="text-sm">−</span>
                        </Button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={p.quantity}
                          onChange={(e) => updateProductField(i, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-14 h-8 text-center text-sm px-1"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateProductField(i, { quantity: p.quantity + 1 })}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="text-muted-foreground shrink-0">@</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatAmountInput(String(p.product_price))}
                        onChange={(e) => updateProductField(i, { product_price: parseFloat(e.target.value.replace(/\./g, "")) || 0 })}
                        className="w-28 h-8 text-sm px-2"
                      />
                      {/* Per-item discount */}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex rounded-md border overflow-hidden shrink-0 h-8">
                          <button
                            type="button"
                            className={`px-2.5 text-xs font-semibold transition-colors ${p.discount_type === "percentage" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                            onClick={() => updateProductField(i, { discount_type: "percentage", discount_value: "" })}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            className={`px-2.5 text-xs font-semibold transition-colors border-l ${p.discount_type === "fixed" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                            onClick={() => updateProductField(i, { discount_type: "fixed", discount_value: "" })}
                          >
                            Rp
                          </button>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={p.discount_type === "fixed" ? formatAmountInput(p.discount_value) : p.discount_value}
                          onChange={(e) => {
                            if (p.discount_type === "percentage") {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              const num = parseInt(raw) || 0;
                              updateProductField(i, { discount_value: num > 100 ? "100" : raw });
                            } else {
                              const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                              updateProductField(i, { discount_value: raw });
                            }
                          }}
                          placeholder="0"
                          className="w-24 h-8 text-sm px-2"
                        />
                      </div>
                      <div className="text-right flex-1 min-w-[90px] shrink-0">
                        {(parseFloat(p.discount_value) || 0) > 0 ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.quantity * p.product_price)}</span>
                            <span className="text-sm font-medium text-destructive">= {formatCurrency(p.subtotal)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">= {formatCurrency(p.subtotal)}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIncomeProducts(incomeProducts.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diskon */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDiscountPopover(!showDiscountPopover)} type="button">
                  Diskon
                </Button>
              </div>
              {showDiscountPopover && (
                <div className="flex gap-2 items-center p-3 border rounded-md bg-muted/30">
                  <div className="flex rounded-md border overflow-hidden shrink-0">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${incomeDiscount.type === "percentage" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                      onClick={() => setIncomeDiscount({ ...incomeDiscount, type: "percentage", value: "" })}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${incomeDiscount.type === "fixed" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                      onClick={() => setIncomeDiscount({ ...incomeDiscount, type: "fixed", value: "" })}
                    >
                      Rp
                    </button>
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={incomeDiscount.type === "fixed" ? formatAmountInput(incomeDiscount.value) : incomeDiscount.value}
                    onChange={(e) => {
                      if (incomeDiscount.type === "percentage") {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const num = parseInt(raw) || 0;
                        setIncomeDiscount({ ...incomeDiscount, value: num > 100 ? "100" : raw });
                      } else {
                        const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                        setIncomeDiscount({ ...incomeDiscount, value: raw });
                      }
                    }}
                    placeholder={incomeDiscount.type === "percentage" ? "0 - 100" : "0"}
                    className="flex-1"
                  />
                </div>
              )}
            </div>

            {/* Subtotal Produk & Total Bayar */}
            {incomeProducts.length > 0 && (
              <div className="p-3 bg-muted/50 rounded space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal Produk</span>
                  <span className="font-medium">{formatCurrency(incomeProducts.reduce((s, p) => s + p.subtotal, 0))}</span>
                </div>
                {incomeDiscount.value && parseFloat(incomeDiscount.value) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon {incomeDiscount.type === 'percentage' ? `${incomeDiscount.value}%` : ''}</span>
                    <span>-{formatCurrency(
                      incomeDiscount.type === 'percentage'
                        ? incomeProducts.reduce((s, p) => s + p.subtotal, 0) * (parseFloat(incomeDiscount.value) / 100)
                        : parseFloat(incomeDiscount.value) || 0
                    )}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total Bayar</span>
                  <span>{formatCurrency(getIncomeTotal())}</span>
                </div>
              </div>
            )}

            {/* Metode Pembayaran, Jumlah Bayar & No. Referensi */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Metode Pembayaran <span className="text-destructive">*</span></Label>
                <Select value={incomeForm.payment_method} onValueChange={(v) => setIncomeForm({ ...incomeForm, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                  <SelectContent>
                    {activeMethodNames.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah Bayar <span className="text-destructive">*</span></Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: formatAmountInput(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>No. Referensi</Label>
                <Input
                  value={incomeForm.reference_no}
                  onChange={(e) => setIncomeForm({ ...incomeForm, reference_no: e.target.value })}
                  placeholder="No. referensi (opsional)"
                />
              </div>
            </div>

            {/* Keterangan Pembayaran */}
            {(() => {
              const totalBayar = getIncomeTotal();
              const jumlahBayar = parseFloat(incomeForm.amount.replace(/\./g, "")) || 0;
              if (jumlahBayar > 0 && totalBayar > 0) {
                const selisih = jumlahBayar - totalBayar;
                if (selisih < 0) {
                  return (
                    <div className="p-3 bg-destructive/10 rounded text-sm font-medium text-destructive flex justify-between">
                      <span>Kurang Bayar</span>
                      <span>{formatCurrency(Math.abs(selisih))}</span>
                    </div>
                  );
                } else if (selisih === 0) {
                  return (
                    <div className="p-3 bg-emerald-500/10 rounded text-sm font-medium text-emerald-600 flex justify-between">
                      <span>LUNAS</span>
                      <span>{formatCurrency(jumlahBayar)}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-amber-500/10 rounded text-sm font-medium text-amber-600 flex justify-between">
                      <span>Uang Lebih (Kembalian)</span>
                      <span>{formatCurrency(selisih)}</span>
                    </div>
                  );
                }
              }
              return null;
            })()}

            {/* Deskripsi - di bawah */}
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                placeholder="Deskripsi pemasukan..."
                rows={3}
              />
            </div>

            {/* Bukti Bayar */}
            <PaymentProofUpload
              value={incomePaymentProof}
              onChange={setIncomePaymentProof}
              required
            />
            {!incomePaymentProof && (
              <p className="text-xs text-destructive">* Wajib upload bukti bayar</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => {
                setAddingIncome(false);
                setIncomeProducts([]);
                setIncomeDiscount({ type: "percentage", value: "" });
                setIncomePaymentProof(null);
              }}>
                Batal
              </Button>
              <Button onClick={handleAddIncome}>
                Simpan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-xl font-bold">Transaksi Pemasukan</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-green-600">Total: {formatCurrency(total)}</span>
              {hasPermission("manage_income") && (
                <Button onClick={() => setAddingIncome(true)} className="bg-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pemasukan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={processTab} onValueChange={setProcessTab}>
            <TabsList className="grid w-full grid-cols-4">
              {PROCESS_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2 flex-wrap">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Semua Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                {uniquePaymentMethods.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showVerification && (
              <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Semua Verifikasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Verifikasi</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
          ) : filteredIncomes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Tidak ada data pemasukan</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>BID</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Bukti Bayar</TableHead>
                    {showVerification && <TableHead>Verifikasi</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(income.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => openEditIncomeDialog(income)}
                          >
                            {income.bid || '-'}
                          </Badge>
                          {income.bid && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyBid(income.bid)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{income.customer_name || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-blue-600"
                          onClick={() => {
                            const url = `/receipt/transaction?id=${income.id}&type=income`;
                            window.open(url, '_blank');
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Lihat
                        </Button>
                      </TableCell>
                      <TableCell>{income.payment_method || '-'}</TableCell>
                      <TableCell>
                        {income.payment_proof_url ? (
                          <a href={income.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                            Lihat
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {showVerification && (
                        <TableCell>
                          <Select
                            value={income.verification_status}
                            onValueChange={(val) => updateField(income.id, "verification_status", val)}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <Badge
                                variant="outline"
                                className={
                                  income.verification_status === "Verified"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-orange-50 text-orange-700 border-orange-200"
                                }
                              >
                                {income.verification_status === "Verified" ? "✓" : "⚠"} {income.verification_status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Unverified">Unverified</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={income.status}
                          onValueChange={(val) => updateField(income.id, "status", val)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <Badge
                              variant="outline"
                              className={
                                income.status === "selesai"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : income.status === "batal"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {income.status === "selesai" ? "Selesai" : income.status === "batal" ? "Batal" : "Tunda"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tunda">Tunda</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                            <SelectItem value="batal">Batal</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(Number(income.amount))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const url = `/receipt/transaction?id=${income.id}&type=income`;
                            window.open(url, '_blank');
                          }}
                          title="Print Nota"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {noteDialogData && (
        <IncomeNoteDialog
          income={noteDialogData}
          onClose={() => setNoteDialogData(null)}
        />
      )}

      {/* Edit Income Dialog */}
      <Dialog open={!!editingIncome} onOpenChange={(open) => !open && setEditingIncome(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pemasukan - {editingIncome?.bid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={editIncomeForm.date} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nama Pelanggan</Label>
              <Input value={editIncomeForm.customer_name} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, customer_name: e.target.value })} placeholder="Nama pelanggan" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input value={editIncomeForm.description} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, description: e.target.value })} placeholder="Deskripsi pemasukan" />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input value={editIncomeForm.amount} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, amount: formatAmountInput(e.target.value) })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={editIncomeForm.payment_method} onValueChange={(v) => setEditIncomeForm({ ...editIncomeForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {activeMethodNames.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEditIncome}>Simpan Perubahan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={!!printPreviewId} onOpenChange={(open) => !open && setPrintPreviewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Preview Nota Pemasukan
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md">
            {printPreviewId && (
              <iframe
                src={`/receipt/transaction?id=${printPreviewId}&type=income`}
                className="w-full h-[60vh] border-0"
                title="Print Preview"
              />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" onClick={() => setPrintPreviewId(null)}>
              Tutup
            </Button>
            <Button onClick={() => {
              if (printPreviewId) {
                const url = `/receipt/transaction?id=${printPreviewId}&type=income`;
                window.open(url, '_blank');
                setPrintPreviewId(null);
              }
            }}>
              <Printer className="h-4 w-4 mr-2" />
              Print Nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncomeNoteDialog({ income, onClose }: { income: Income; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Detail Pemasukan</h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">BID:</span>
            <p className="font-mono text-sm">{income.bid || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Pelanggan:</span>
            <p className="text-sm">{income.customer_name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Deskripsi:</span>
            <p className="text-sm">{income.description || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Tanggal:</span>
            <p className="text-sm">{format(new Date(income.date), "dd MMMM yyyy", { locale: localeId })}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Total:</span>
            <p className="text-sm font-bold text-green-600">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(income.amount)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}
