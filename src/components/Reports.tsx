import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, DollarSign, Users, Plus, Trash2, TrendingDown, TrendingUp, CalendarIcon, Pencil, Copy, LayoutGrid, ShoppingCart, Receipt, UserCheck, Settings, Printer } from "lucide-react";
import PaymentProofUpload from "@/components/PaymentProofUpload";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { logActivity } from "@/utils/activityLogger";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useStore } from "@/contexts/StoreContext";
import { usePermissions } from "@/hooks/usePermissions";

// Import sub-reports
import SalesReport from "./reports/SalesReport";
import IncomeExpenseReport from "./reports/IncomeExpenseReport";
import PurchaseReport from "./reports/PurchaseReport";
import EmployeePerformanceReport from "./reports/EmployeePerformanceReport";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./reports/ReportDateFilter";
import OccupancyChart from "./reports/OccupancyChart";
import RoomOccupancyList from "./reports/RoomOccupancyList";
import NoAccessMessage from "./NoAccessMessage";

interface ReportStats {
  totalTransactions: number;
  paymentMethodTotals: { method: string; total: number }[];
  additionalIncomePaymentTotals: { method: string; total: number }[];
  newCustomers: number;
  totalExpenses: number;
  totalAdditionalIncome: number;
  totalBookingRevenue: number;
  totalPurchase: number;
  purchaseTransactionCount: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
}

interface ExpenseCategory {
  id: string;
  name: string;
  store_id: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  bid?: string;
  created_by: string;
  creator_name?: string;
  payment_method?: string;
  payment_proof_url?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface SelectedProduct {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface AdditionalIncome {
  id: string;
  description: string;
  amount: number;
  date: string;
  bid?: string;
  created_by: string;
  creator_name?: string;
  customer_name?: string;
  payment_method?: string;
  reference_no?: string;
  products?: SelectedProduct[];
}

interface BookingPaymentDetail {
  id: string;
  customer_name: string;
  amount: number;
  date: string;
  created_at: string;
  payment_method: string;
  type: 'booking' | 'booking_2';
}

type ReportTab = "overview" | "sales" | "income-expense" | "purchase" | "employee";

export default function Reports() {
  const { currentStore } = useStore();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [stats, setStats] = useState<ReportStats>({
    totalTransactions: 0,
    paymentMethodTotals: [],
    additionalIncomePaymentTotals: [],
    newCustomers: 0,
    totalExpenses: 0,
    totalAdditionalIncome: 0,
    totalBookingRevenue: 0,
    totalPurchase: 0,
    purchaseTransactionCount: 0,
    incomeTransactionCount: 0,
    expenseTransactionCount: 0,
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [additionalIncomes, setAdditionalIncomes] = useState<AdditionalIncome[]>([]);
  const [bookingPayments, setBookingPayments] = useState<BookingPaymentDetail[]>([]);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    description: "",
    amount: "",
    customer_name: "",
    payment_method: "",
    reference_no: "",
    date: format(new Date(), "yyyy-MM-dd"),
    discount_type: "" as "" | "percentage" | "fixed",
    discount_value: "",
  });
  const [editingIncome, setEditingIncome] = useState<AdditionalIncome | null>(null);
  const [viewingIncome, setViewingIncome] = useState<AdditionalIncome | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "",
    payment_method: "",
    payment_proof_url: null as string | null,
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const [productSearches, setProductSearches] = useState<Record<number, string>>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'booking' | 'income' | null>(null);

  const getDateRangeInternal = (range: ReportTimeRange) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (range) {
      case "today":
        startDate = now;
        endDate = now;
        break;
      case "yesterday":
        startDate = subDays(now, 1);
        endDate = subDays(now, 1);
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case "custom":
        if (customDateRange?.from) {
          startDate = customDateRange.from;
          endDate = customDateRange.to || customDateRange.from;
        } else {
          startDate = now;
          endDate = now;
        }
        break;
      default:
        startDate = now;
        endDate = now;
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    if (!currentStore) return;
    if (activeTab === "overview") {
      fetchData();
      fetchProducts();
      fetchCustomers();
      fetchExpenseCategories();
    }
  }, [timeRange, customDateRange, currentStore, activeTab]);

  const fetchExpenseCategories = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");
      if (error) throw error;
      setExpenseCategories(data || []);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!currentStore || !newCategoryName.trim()) return;
    try {
      const { error } = await supabase
        .from("expense_categories")
        .insert([{ name: newCategoryName.trim(), store_id: currentStore.id }]);
      if (error) throw error;
      toast.success("Kategori berhasil ditambahkan");
      setNewCategoryName("");
      fetchExpenseCategories();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Kategori sudah ada");
      } else {
        toast.error("Gagal menambahkan kategori");
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Kategori berhasil dihapus");
      fetchExpenseCategories();
    } catch (error) {
      toast.error("Gagal menghapus kategori");
    }
  };

  const fetchProducts = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchCustomers = async () => {
    if (!currentStore) return;
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("store_id", currentStore.id)
        .order("name");
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchData = async () => {
    if (!currentStore) return;
    
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRangeInternal(timeRange);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");
      const startTimestamp = startOfDay(startDate).toISOString();
      const endTimestamp = endOfDay(endDate).toISOString();

      const [bookingsResult, customersResult, expensesResult, incomesResult, incomeProductsResult] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, customer_name, duration, price, price_2, payment_method, payment_method_2, date, created_at, status")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr),
        supabase
          .from("customers")
          .select("id")
          .eq("store_id", currentStore.id)
          .gte("created_at", startTimestamp)
          .lte("created_at", endTimestamp),
        supabase
          .from("expenses")
          .select("*, bid")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false }),
        supabase
          .from("incomes")
          .select("*, bid")
          .eq("store_id", currentStore.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false }),
        supabase
          .from("income_products")
          .select("subtotal, income_id, incomes!inner(date, store_id)")
          .eq("incomes.store_id", currentStore.id)
          .gte("incomes.date", startDateStr)
          .lte("incomes.date", endDateStr)
      ]);

      if (bookingsResult.error) throw bookingsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (incomesResult.error) throw incomesResult.error;

      const bookings = bookingsResult.data || [];
      const customersData = customersResult.data || [];
      const expensesData = (expensesResult.data || []) as any[];
      const incomesData = (incomesResult.data || []) as any[];
      const incomeProductsData = (incomeProductsResult.data || []) as any[];

      const creatorIds = Array.from(
        new Set([
          ...expensesData.map((e) => e.created_by).filter(Boolean),
          ...incomesData.map((i) => i.created_by).filter(Boolean),
        ])
      );

      let profilesById: Record<string, string> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", creatorIds);

        if (profiles) {
          profilesById = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        }
      }

      const expensesWithCreator = expensesData.map((expense) => ({
        ...expense,
        creator_name: profilesById[expense.created_by] || "Unknown",
      }));

      const incomesWithCreator = incomesData.map((income) => ({
        ...income,
        creator_name: profilesById[income.created_by] || "Unknown",
      }));

      const activeBookings = bookings.filter(b => (b as any).status !== 'Cancelled' && (b as any).status !== 'BATAL');
      const totalTransactions = activeBookings.length;
      
      const paymentTotals: { [key: string]: number } = {};
      const bookingPaymentDetails: BookingPaymentDetail[] = [];
      
      bookings.forEach((booking) => {
        if (booking.payment_method) {
          const method = booking.payment_method;
          const price = Number(booking.price) || 0;
          paymentTotals[method] = (paymentTotals[method] || 0) + price;
          
          bookingPaymentDetails.push({
            id: booking.id,
            customer_name: booking.customer_name,
            amount: price,
            date: booking.date,
            created_at: booking.created_at,
            payment_method: method,
            type: 'booking',
          });
        } else if (Number(booking.price) > 0) {
          const price = Number(booking.price) || 0;
          paymentTotals["Belum Diisi"] = (paymentTotals["Belum Diisi"] || 0) + price;
          
          bookingPaymentDetails.push({
            id: booking.id,
            customer_name: booking.customer_name,
            amount: price,
            date: booking.date,
            created_at: booking.created_at,
            payment_method: "Belum Diisi",
            type: 'booking',
          });
        }
        
        if (booking.payment_method_2) {
          const method = booking.payment_method_2;
          const price = Number(booking.price_2) || 0;
          paymentTotals[method] = (paymentTotals[method] || 0) + price;
          
          bookingPaymentDetails.push({
            id: booking.id,
            customer_name: booking.customer_name,
            amount: price,
            date: booking.date,
            created_at: booking.created_at,
            payment_method: method,
            type: 'booking_2',
          });
        } else if (Number(booking.price_2) > 0) {
          const price = Number(booking.price_2) || 0;
          paymentTotals["Belum Diisi"] = (paymentTotals["Belum Diisi"] || 0) + price;
          
          bookingPaymentDetails.push({
            id: booking.id,
            customer_name: booking.customer_name,
            amount: price,
            date: booking.date,
            created_at: booking.created_at,
            payment_method: "Belum Diisi",
            type: 'booking_2',
          });
        }
      });

      const totalBookingRevenue = activeBookings.reduce((sum, b) => sum + (Number(b.price) || 0) + (Number(b.price_2) || 0), 0);

      const paymentMethodTotals = Object.entries(paymentTotals).map(([method, total]) => ({
        method,
        total,
      }));

      const incomePaymentTotals: { [key: string]: number } = {};
      incomesData.forEach((income) => {
        if (income.payment_method && income.amount) {
          const method = income.payment_method;
          const amount = Number(income.amount) || 0;
          incomePaymentTotals[method] = (incomePaymentTotals[method] || 0) + amount;
        }
      });

      const additionalIncomePaymentTotals = Object.entries(incomePaymentTotals).map(([method, total]) => ({
        method,
        total,
      }));

      const totalExpenses = expensesData.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const totalAdditionalIncome = incomesData.reduce((sum, income) => sum + Number(income.amount), 0);
      
      // Calculate purchase total from income_products
      const totalPurchase = incomeProductsData.reduce((sum: number, ip: any) => sum + (Number(ip.subtotal) || 0), 0);
      const purchaseTransactionCount = new Set(incomeProductsData.map((ip: any) => ip.income_id)).size;

      setStats({
        totalTransactions,
        paymentMethodTotals,
        additionalIncomePaymentTotals,
        newCustomers: customersData.length,
        totalExpenses,
        totalAdditionalIncome,
        totalBookingRevenue,
        totalPurchase,
        purchaseTransactionCount,
        incomeTransactionCount: incomesData.length,
        expenseTransactionCount: expensesData.length,
      });

      setExpenses(expensesWithCreator);
      setAdditionalIncomes(incomesWithCreator);
      setBookingPayments(bookingPaymentDetails);
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentStore) {
      toast.error("Silakan pilih cabang terlebih dahulu");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Anda harus login terlebih dahulu");
        return;
      }

      const dateStr = expenseForm.date;

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            description: expenseForm.description,
            amount: expenseForm.amount ? parseFloat(expenseForm.amount.replace(/\./g, "")) : 0,
            category: expenseForm.category,
            payment_method: expenseForm.payment_method || null,
            payment_proof_url: expenseForm.payment_proof_url || null,
            date: dateStr,
          })
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Pengeluaran berhasil diperbarui");
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert([{
            description: expenseForm.description,
            amount: expenseForm.amount ? parseFloat(expenseForm.amount.replace(/\./g, "")) : 0,
            category: expenseForm.category,
            payment_method: expenseForm.payment_method || null,
            payment_proof_url: expenseForm.payment_proof_url || null,
            date: dateStr,
            created_by: user.id,
            store_id: currentStore.id,
          }]);

        if (error) throw error;
        toast.success("Pengeluaran berhasil ditambahkan");
      }

      setExpenseForm({ description: "", amount: "", category: "", payment_method: "", payment_proof_url: null, date: format(new Date(), "yyyy-MM-dd") });
      setEditingExpense(null);
      setShowExpenseForm(false);
      fetchData();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Gagal menyimpan pengeluaran");
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      category: expense.category || "",
      payment_method: expense.payment_method || "",
      payment_proof_url: expense.payment_proof_url || null,
      date: expense.date,
    });
    setShowExpenseForm(true);
  };

  const handleViewExpense = (expense: Expense) => {
    setViewingExpense(expense);
  };

  const handlePrintExpense = (expense: Expense) => {
    window.open(`/receipt/transaction?id=${expense.id}&type=expense`, '_blank');
  };

  const handlePrintIncome = (income: AdditionalIncome) => {
    window.open(`/receipt/transaction?id=${income.id}&type=income`, '_blank');
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const expense = expenses.find(e => e.id === id);
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'Pengeluaran',
        entityId: id,
        description: `Menghapus pengeluaran: ${expense?.description || 'Unknown'}`,
        storeId: currentStore?.id,
      });

      toast.success("Pengeluaran berhasil dihapus");
      fetchData();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Gagal menghapus pengeluaran");
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentStore) {
      toast.error("Silakan pilih cabang terlebih dahulu");
      return;
    }

    if (!incomeForm.customer_name.trim()) {
      toast.error("Nama pelanggan harus diisi");
      return;
    }

    if (!incomeForm.payment_method) {
      toast.error("Metode bayar harus diisi");
      return;
    }

    if ((incomeForm.payment_method === "QRIS" || incomeForm.payment_method === "Transfer") && !incomeForm.reference_no.trim()) {
      toast.error("Nomor referensi wajib diisi untuk metode QRIS dan Transfer");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Anda harus login terlebih dahulu");
        return;
      }

      const dateStr = incomeForm.date;

      let calculatedAmount = selectedProducts.length > 0 
        ? calculateProductsTotal()
        : (incomeForm.amount ? parseFloat(incomeForm.amount.replace(/\./g, "")) : 0);

      // Apply discount
      if (incomeForm.discount_type && incomeForm.discount_value) {
        const discountVal = parseFloat(incomeForm.discount_value.replace(/\./g, ""));
        if (discountVal > 0) {
          if (incomeForm.discount_type === "percentage") {
            calculatedAmount = calculatedAmount - (calculatedAmount * Math.min(discountVal, 100) / 100);
          } else {
            calculatedAmount = Math.max(0, calculatedAmount - discountVal);
          }
        }
      }
      calculatedAmount = Math.round(calculatedAmount);

      if (editingIncome) {
        const { error: incomeError } = await supabase
          .from("incomes")
          .update({
            description: incomeForm.description || null,
            amount: calculatedAmount,
            customer_name: incomeForm.customer_name,
            payment_method: incomeForm.payment_method,
            reference_no: incomeForm.reference_no || null,
            date: dateStr,
          })
          .eq("id", editingIncome.id);

        if (incomeError) throw incomeError;

        await supabase
          .from("income_products")
          .delete()
          .eq("income_id", editingIncome.id);

        if (selectedProducts.length > 0) {
          const productsToInsert = selectedProducts.map(p => ({
            income_id: editingIncome.id,
            product_id: p.product_id,
            product_name: p.product_name,
            product_price: p.product_price,
            quantity: p.quantity,
            subtotal: p.subtotal,
          }));

          const { error: productsError } = await supabase
            .from("income_products")
            .insert(productsToInsert);

          if (productsError) throw productsError;
        }

        toast.success("Pemasukan berhasil diperbarui");
      } else {
        const { data: incomeData, error: incomeError } = await supabase
          .from("incomes")
          .insert([{
            description: incomeForm.description || null,
            amount: calculatedAmount,
            date: dateStr,
            created_by: user.id,
            store_id: currentStore.id,
            customer_name: incomeForm.customer_name,
            payment_method: incomeForm.payment_method,
            reference_no: incomeForm.reference_no || null,
          }])
          .select()
          .single();

        if (incomeError) throw incomeError;

        if (selectedProducts.length > 0 && incomeData) {
          const productsToInsert = selectedProducts.map(p => ({
            income_id: incomeData.id,
            product_id: p.product_id,
            product_name: p.product_name,
            product_price: p.product_price,
            quantity: p.quantity,
            subtotal: p.subtotal,
          }));

          const { error: productsError } = await supabase
            .from("income_products")
            .insert(productsToInsert);

          if (productsError) throw productsError;
        }

        toast.success("Pemasukan berhasil ditambahkan");
      }

      setIncomeForm({ description: "", amount: "", customer_name: "", payment_method: "", reference_no: "", date: format(new Date(), "yyyy-MM-dd"), discount_type: "", discount_value: "" });
      setSelectedProducts([]);
      setEditingIncome(null);
      setShowIncomeForm(false);
      fetchData();
    } catch (error) {
      console.error("Error saving income:", error);
      toast.error("Gagal menyimpan pemasukan");
    }
  };

  const handleEditIncome = async (income: AdditionalIncome) => {
    setEditingIncome(income);
    setIncomeForm({
      description: income.description || "",
      amount: income.amount ? income.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : "",
      customer_name: income.customer_name || "",
      payment_method: income.payment_method || "",
      reference_no: income.reference_no || "",
      date: income.date,
      discount_type: "",
      discount_value: "",
    });

    try {
      const { data, error } = await supabase
        .from("income_products")
        .select("*")
        .eq("income_id", income.id);

      if (error) throw error;

      if (data) {
        const productsList = data.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          product_price: p.product_price,
          quantity: p.quantity,
          subtotal: p.subtotal,
        }));
        setSelectedProducts(productsList);
      }
    } catch (error) {
      console.error("Error fetching income products:", error);
    }

    setShowIncomeForm(true);
  };

  const handleViewIncome = async (income: AdditionalIncome) => {
    try {
      const { data: incomeProducts, error } = await supabase
        .from('income_products')
        .select('*')
        .eq('income_id', income.id);

      if (error) throw error;

      const productsList: SelectedProduct[] = incomeProducts?.map(ip => ({
        product_id: ip.product_id,
        product_name: ip.product_name,
        product_price: ip.product_price,
        quantity: ip.quantity,
        subtotal: ip.subtotal
      })) || [];

      setViewingIncome({
        ...income,
        products: productsList
      });
    } catch (error) {
      console.error("Error fetching income products:", error);
      setViewingIncome(income);
    }
  };

  const handleAddProduct = () => {
    setSelectedProducts([...selectedProducts, {
      product_id: "",
      product_name: "",
      product_price: 0,
      quantity: 1,
      subtotal: 0,
    }]);
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newProducts = [...selectedProducts];
    newProducts[index] = {
      ...newProducts[index],
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      subtotal: product.price * newProducts[index].quantity,
    };
    setSelectedProducts(newProducts);
  };

  const handleProductQuantityChange = (index: number, quantity: number) => {
    const newProducts = [...selectedProducts];
    newProducts[index].quantity = quantity;
    newProducts[index].subtotal = newProducts[index].product_price * quantity;
    setSelectedProducts(newProducts);
  };

  const calculateProductsTotal = () => {
    return selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);
  };

  const handleCustomerNameChange = (value: string) => {
    setIncomeForm({ ...incomeForm, customer_name: value });
    
    if (value.trim().length > 0) {
      const filtered = customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(value.toLowerCase()) ||
          customer.phone.includes(value)
      );
      setFilteredCustomers(filtered);
      setShowCustomerSuggestions(true);
    } else {
      setFilteredCustomers([]);
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomer = (customer: { id: string; name: string; phone: string }) => {
    setIncomeForm({ ...incomeForm, customer_name: customer.name });
    setShowCustomerSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#income-customer-name') && !target.closest('.customer-suggestions')) {
        setShowCustomerSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteIncome = async (id: string) => {
    try {
      const { error } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await logActivity({
        actionType: 'deleted',
        entityType: 'Pemasukan',
        entityId: id,
        description: `Menghapus data pemasukan`,
        storeId: currentStore?.id,
      });

      toast.success("Pemasukan berhasil dihapus");
      fetchData();
    } catch (error) {
      console.error("Error deleting income:", error);
      toast.error("Gagal menghapus pemasukan");
    }
  };

  const formatExpenseAmount = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getDateRangeDisplayLocal = (range: ReportTimeRange) => {
    const { startDate, endDate } = getDateRangeInternal(range);
    
    if (range === "today" || range === "yesterday") {
      return format(startDate, "d MMMM yyyy", { locale: localeId });
    } else {
      const isSameDate = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
      if (isSameDate) {
        return format(startDate, "d MMMM yyyy", { locale: localeId });
      }
      return `${format(startDate, "d MMM", { locale: localeId })} - ${format(endDate, "d MMM yyyy", { locale: localeId })}`;
    }
  };

  const renderOverviewContent = () => {
    if (loading) {
      return (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
        {/* Summary Cards - like reference image */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Penjualan */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("sales")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Penjualan</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalBookingRevenue)}</div>
              <p className="text-xs text-muted-foreground">{stats.totalTransactions} transaksi</p>
            </CardContent>
          </Card>

          {/* Pemasukan */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("income-expense")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-600">Pemasukan</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalAdditionalIncome)}</div>
              <p className="text-xs text-muted-foreground">{stats.incomeTransactionCount} transaksi</p>
            </CardContent>
          </Card>

          {/* Pembelian */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("purchase")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Receipt className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-medium text-orange-500">Pembelian</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalPurchase)}</div>
              <p className="text-xs text-muted-foreground">{stats.purchaseTransactionCount} transaksi</p>
            </CardContent>
          </Card>

          {/* Pengeluaran */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("income-expense")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">Pengeluaran</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">{stats.expenseTransactionCount} transaksi</p>
            </CardContent>
          </Card>

          {/* Total Pendapatan */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">Total Pendapatan</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalBookingRevenue + stats.totalAdditionalIncome)}</div>
            </CardContent>
          </Card>

          {/* Total Biaya */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                <span className="text-xs font-medium text-rose-600">Total Biaya</span>
              </div>
              <div className="text-base font-bold">{formatCurrency(stats.totalExpenses + stats.totalPurchase)}</div>
            </CardContent>
          </Card>

          {/* Profit Bersih */}
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="h-3.5 w-3.5 text-green-700" />
                <span className="text-xs font-medium text-green-700">Profit Bersih</span>
              </div>
              <div className="text-base font-bold text-green-700">
                {formatCurrency(
                  (stats.totalBookingRevenue + stats.totalAdditionalIncome) - (stats.totalExpenses + stats.totalPurchase)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Occupancy Chart & Room List */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OccupancyChart
            startDate={getDateRangeInternal(timeRange).startDate}
            endDate={getDateRangeInternal(timeRange).endDate}
          />
          <RoomOccupancyList
            startDate={getDateRangeInternal(timeRange).startDate}
            endDate={getDateRangeInternal(timeRange).endDate}
          />
        </div>
      </div>
    );
  };

  const allReportPermissions = [
    "report_overview_view", "report_overview_detail",
    "report_sales_view", "report_sales_detail",
    "report_income_view", "report_income_detail",
    "report_expense_view", "report_expense_detail",
    "report_purchase_view", "report_purchase_detail",
    "report_performance_view", "report_performance_detail",
  ];

  const hasAnyReportAccess = hasAnyPermission(allReportPermissions);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold">Laporan</h2>
      </div>

      {!hasAnyReportAccess ? (
        <NoAccessMessage featureName="Laporan" />
      ) : (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)}>
        <TabsList className="flex w-full">
          {hasAnyPermission(["report_overview_view", "report_overview_detail"]) && (
            <TabsTrigger value="overview" className="flex items-center gap-1.5 flex-1">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Keseluruhan</span>
            </TabsTrigger>
          )}
          {hasAnyPermission(["report_sales_view", "report_sales_detail"]) && (
            <TabsTrigger value="sales" className="flex items-center gap-1.5 flex-1">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Penjualan</span>
            </TabsTrigger>
          )}
          {hasAnyPermission(["report_income_view", "report_income_detail", "report_expense_view", "report_expense_detail"]) && (
            <TabsTrigger value="income-expense" className="flex items-center gap-1.5 flex-1">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Pemasukan/Pengeluaran</span>
            </TabsTrigger>
          )}
          {hasAnyPermission(["report_purchase_view", "report_purchase_detail"]) && (
            <TabsTrigger value="purchase" className="flex items-center gap-1.5 flex-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Pembelian</span>
            </TabsTrigger>
          )}
          {hasAnyPermission(["report_performance_view", "report_performance_detail"]) && (
            <TabsTrigger value="employee" className="flex items-center gap-1.5 flex-1">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Kinerja</span>
            </TabsTrigger>
          )}
        </TabsList>

        {hasAnyPermission(["report_overview_view", "report_overview_detail"]) && (
          <TabsContent value="overview" className="mt-4">
            <div className="flex justify-end mb-4">
              <ReportDateFilter
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                customDateRange={customDateRange}
                onCustomDateRangeChange={setCustomDateRange}
              />
            </div>
            {renderOverviewContent()}
          </TabsContent>
        )}

        {hasAnyPermission(["report_sales_view", "report_sales_detail"]) && (
          <TabsContent value="sales" className="mt-4">
            <SalesReport />
          </TabsContent>
        )}

        {hasAnyPermission(["report_income_view", "report_income_detail", "report_expense_view", "report_expense_detail"]) && (
          <TabsContent value="income-expense" className="mt-4">
            <IncomeExpenseReport />
          </TabsContent>
        )}

        {hasAnyPermission(["report_purchase_view", "report_purchase_detail"]) && (
          <TabsContent value="purchase" className="mt-4">
            <PurchaseReport />
          </TabsContent>
        )}

        {hasAnyPermission(["report_performance_view", "report_performance_detail"]) && (
          <TabsContent value="employee" className="mt-4">
            <EmployeePerformanceReport />
          </TabsContent>
        )}
      </Tabs>

      {/* View Expense Detail Dialog */}
      <Dialog open={!!viewingExpense} onOpenChange={() => setViewingExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Pengeluaran</DialogTitle>
          </DialogHeader>
          {viewingExpense && (
            <div className="space-y-3">
              {viewingExpense.bid && (
                <div>
                  <Label className="text-muted-foreground text-xs">BID</Label>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-medium">{viewingExpense.bid}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingExpense.bid || '');
                        toast.success("BID berhasil disalin");
                      }}
                      title="Salin BID"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Deskripsi</Label>
                <div className="text-sm">{viewingExpense.description || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Jumlah</Label>
                <div className="text-lg font-bold text-red-600">{formatCurrency(viewingExpense.amount)}</div>
              </div>
              {viewingExpense.category && (
                <div>
                  <Label className="text-muted-foreground text-xs">Kategori</Label>
                  <div className="text-sm">{viewingExpense.category}</div>
                </div>
              )}
              {viewingExpense.payment_method && (
                <div>
                  <Label className="text-muted-foreground text-xs">Metode Pembayaran</Label>
                  <div className="text-sm">{viewingExpense.payment_method}</div>
                </div>
              )}
              {viewingExpense.payment_proof_url && (
                <div>
                  <Label className="text-muted-foreground text-xs">Bukti Bayar</Label>
                  <img
                    src={viewingExpense.payment_proof_url}
                    alt="Bukti bayar"
                    className="w-full h-40 object-contain rounded-md border cursor-pointer mt-1"
                    onClick={() => window.open(viewingExpense.payment_proof_url!, '_blank')}
                  />
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Tanggal</Label>
                <div className="text-sm">{format(new Date(viewingExpense.date), "d MMMM yyyy", { locale: localeId })}</div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Dibuat Oleh</Label>
                <div className="text-sm">{viewingExpense.creator_name}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  className="flex-1" 
                  onClick={() => {
                    setViewingExpense(null);
                    handleEditExpense(viewingExpense);
                  }}
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => {
                    setViewingExpense(null);
                    handleDeleteExpense(viewingExpense.id);
                  }}
                >
                  Hapus
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Income Detail Dialog */}
      <Dialog open={!!viewingIncome} onOpenChange={() => setViewingIncome(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Pemasukan</DialogTitle>
          </DialogHeader>
          {viewingIncome && (
            <div className="space-y-3">
              {viewingIncome.bid && (
                <div>
                  <Label className="text-muted-foreground text-xs">BID</Label>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-medium">{viewingIncome.bid}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingIncome.bid || '');
                        toast.success("BID berhasil disalin");
                      }}
                      title="Salin BID"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Pelanggan</Label>
                <div className="text-sm">{viewingIncome.customer_name || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Metode Bayar</Label>
                <div className="text-sm">{viewingIncome.payment_method || "-"}</div>
              </div>
              {viewingIncome.reference_no && (
                <div>
                  <Label className="text-muted-foreground text-xs">Nomor Referensi</Label>
                  <div className="text-sm">{viewingIncome.reference_no}</div>
                </div>
              )}
              {viewingIncome.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Deskripsi</Label>
                  <div className="text-sm">{viewingIncome.description}</div>
                </div>
              )}
              {viewingIncome.amount > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Jumlah</Label>
                  <div className="text-lg font-bold text-green-600">{formatCurrency(viewingIncome.amount)}</div>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Tanggal</Label>
                <div className="text-sm">{format(new Date(viewingIncome.date), "d MMMM yyyy", { locale: localeId })}</div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Dibuat Oleh</Label>
                <div className="text-sm">{viewingIncome.creator_name}</div>
              </div>

              {viewingIncome.products && viewingIncome.products.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <Label className="text-muted-foreground text-xs">Detail Produk</Label>
                  <div className="mt-2 space-y-2">
                    {viewingIncome.products.map((product, index) => (
                      <div key={index} className="bg-muted/50 p-2 rounded text-xs">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{product.product_name}</div>
                            <div className="text-muted-foreground">
                              {formatCurrency(product.product_price)} × {product.quantity}
                            </div>
                          </div>
                          <div className="font-medium">
                            {formatCurrency(product.subtotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between items-center font-medium">
                      <span>Total Produk:</span>
                      <span className="text-green-600">
                        {formatCurrency(viewingIncome.products.reduce((sum, p) => sum + p.subtotal, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  className="flex-1" 
                  onClick={() => {
                    setViewingIncome(null);
                    handleEditIncome(viewingIncome);
                  }}
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => {
                    setViewingIncome(null);
                    handleDeleteIncome(viewingIncome.id);
                  }}
                >
                  Hapus
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Method Detail Dialog */}
      <Dialog open={!!selectedPaymentMethod} onOpenChange={() => {
        setSelectedPaymentMethod(null);
        setSelectedPaymentType(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPaymentType === 'income' 
                ? `Detail Pemasukan Tambahan • ${selectedPaymentMethod}`
                : `Detail Pembayaran Booking • ${selectedPaymentMethod}`
              }
            </DialogTitle>
          </DialogHeader>
          {selectedPaymentMethod && selectedPaymentType && (() => {
            if (selectedPaymentType === 'booking') {
              const bookingTransactions = bookingPayments
                .filter(b => b.payment_method === selectedPaymentMethod)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              
              const totalBooking = bookingTransactions.reduce((sum, t) => sum + t.amount, 0);
              
              return (
                <div className="space-y-4">
                  {bookingTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Tidak ada transaksi booking
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {bookingTransactions.map((transaction, idx) => (
                        <div
                          key={`booking-${transaction.id}-${idx}`}
                          className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                Booking
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(transaction.date), "d MMM yyyy", { locale: localeId })}
                              </span>
                            </div>
                            <div className="font-medium mt-1">{transaction.customer_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {transaction.payment_method}
                            </div>
                          </div>
                          <div className="text-sm font-bold">
                            {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Booking:</span>
                      <span className="text-green-600">{formatCurrency(totalBooking)}</span>
                    </div>
                  </div>
                </div>
              );
            } else {
              const incomeTransactions = additionalIncomes
                .filter(i => i.payment_method === selectedPaymentMethod)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              const totalIncome = incomeTransactions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
              
              return (
                <div className="space-y-4">
                  {incomeTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Tidak ada pemasukan tambahan
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {incomeTransactions.map((income, idx) => (
                        <div
                          key={`income-${income.id}-${idx}`}
                          className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                                Income
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(income.date), "d MMM yyyy", { locale: localeId })}
                              </span>
                            </div>
                            <div className="font-medium mt-1">
                              {income.customer_name || income.description || 'Pemasukan Tambahan'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {income.payment_method}
                              {income.reference_no && ` • Ref: ${income.reference_no}`}
                            </div>
                            {income.description && income.customer_name && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {income.description}
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-bold">
                            {formatCurrency(Number(income.amount) || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Pemasukan Tambahan:</span>
                      <span className="text-green-600">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
