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
import { Loader2, Clock, DollarSign, Users, Plus, Trash2, TrendingDown, TrendingUp, CalendarIcon, Pencil, Copy, LayoutGrid, ShoppingCart, Receipt, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useStore } from "@/contexts/StoreContext";

// Import sub-reports
import SalesReport from "./reports/SalesReport";
import IncomeExpenseReport from "./reports/IncomeExpenseReport";
import PurchaseReport from "./reports/PurchaseReport";
import EmployeePerformanceReport from "./reports/EmployeePerformanceReport";
import ReportDateFilter, { ReportTimeRange, getDateRange, getDateRangeDisplay } from "./reports/ReportDateFilter";

interface ReportStats {
  totalTransactions: number;
  paymentMethodTotals: { method: string; total: number }[];
  additionalIncomePaymentTotals: { method: string; total: number }[];
  newCustomers: number;
  totalExpenses: number;
  totalAdditionalIncome: number;
  totalBookingRevenue: number;
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
  });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
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
    }
  }, [timeRange, customDateRange, currentStore, activeTab]);

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

      const [bookingsResult, customersResult, expensesResult, incomesResult] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, customer_name, duration, price, price_2, payment_method, payment_method_2, date, created_at")
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
          .order("date", { ascending: false })
      ]);

      if (bookingsResult.error) throw bookingsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (incomesResult.error) throw incomesResult.error;

      const bookings = bookingsResult.data || [];
      const customersData = customersResult.data || [];
      const expensesData = (expensesResult.data || []) as any[];
      const incomesData = (incomesResult.data || []) as any[];

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

      const totalTransactions = bookings.filter(b => (b as any).status !== 'Cancelled' && (b as any).status !== 'BATAL').length;
      
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

      const totalBookingRevenue = Object.values(paymentTotals).reduce((sum, total) => sum + total, 0);

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

      setStats({
        totalTransactions,
        paymentMethodTotals,
        additionalIncomePaymentTotals,
        newCustomers: customersData.length,
        totalExpenses,
        totalAdditionalIncome,
        totalBookingRevenue,
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

      const { startDate } = getDateRangeInternal(timeRange);
      const dateStr = format(startDate, "yyyy-MM-dd");

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            description: expenseForm.description,
            amount: expenseForm.amount ? parseFloat(expenseForm.amount.replace(/\./g, "")) : 0,
            category: expenseForm.category,
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
            date: dateStr,
            created_by: user.id,
            store_id: currentStore.id,
          }]);

        if (error) throw error;
        toast.success("Pengeluaran berhasil ditambahkan");
      }

      setExpenseForm({ description: "", amount: "", category: "" });
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
    });
    setShowExpenseForm(true);
  };

  const handleViewExpense = (expense: Expense) => {
    setViewingExpense(expense);
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

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

      const { startDate } = getDateRangeInternal(timeRange);
      const dateStr = format(startDate, "yyyy-MM-dd");

      const calculatedAmount = selectedProducts.length > 0 
        ? calculateProductsTotal()
        : (incomeForm.amount ? parseFloat(incomeForm.amount.replace(/\./g, "")) : 0);

      if (editingIncome) {
        const { error: incomeError } = await supabase
          .from("incomes")
          .update({
            description: incomeForm.description || null,
            amount: calculatedAmount,
            customer_name: incomeForm.customer_name,
            payment_method: incomeForm.payment_method,
            reference_no: incomeForm.reference_no || null,
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

      setIncomeForm({ description: "", amount: "", customer_name: "", payment_method: "", reference_no: "" });
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Hours Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions} transaksi</div>
              <p className="text-xs text-muted-foreground mt-1">
                {getDateRangeDisplayLocal(timeRange)}
              </p>
            </CardContent>
          </Card>

          {/* New Customers Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pelanggan Baru</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {getDateRangeDisplayLocal(timeRange)}
              </p>
            </CardContent>
          </Card>

          {/* Payment Methods Card */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total per Metode Payment</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.paymentMethodTotals.length === 0 && stats.additionalIncomePaymentTotals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada data</p>
              ) : (
                <div className="space-y-2">
                  {stats.paymentMethodTotals.map((item, index) => (
                    <button
                      key={`booking-${index}`}
                      className="flex justify-between items-center w-full p-2 -mx-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedPaymentMethod(item.method);
                        setSelectedPaymentType('booking');
                      }}
                    >
                      <div className="text-left">
                        <span className="text-sm font-medium">{item.method}</span>
                      </div>
                      <span className="text-sm font-bold">{formatCurrency(item.total)}</span>
                    </button>
                  ))}

                  {stats.additionalIncomePaymentTotals.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {stats.additionalIncomePaymentTotals.map((item, index) => (
                        <button
                          key={`income-${index}`}
                          className="w-full text-left p-2 -mx-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedPaymentMethod(item.method);
                            setSelectedPaymentType('income');
                          }}
                        >
                          <div className="text-sm text-muted-foreground">
                            Pemasukan {item.method} (Tambahan)
                          </div>
                          <div className="text-sm font-bold">
                            {formatCurrency(item.total)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">Total Pemasukan</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(
                          stats.paymentMethodTotals.reduce((sum, item) => sum + item.total, 0) +
                          stats.additionalIncomePaymentTotals.reduce((sum, item) => sum + item.total, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Card */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pengeluaran</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getDateRangeDisplayLocal(timeRange)}
                </p>
                
                <Dialog open={showExpenseForm} onOpenChange={(open) => {
                  setShowExpenseForm(open);
                  if (!open) {
                    setEditingExpense(null);
                    setExpenseForm({ description: "", amount: "", category: "" });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full mt-2">
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Pengeluaran
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingExpense ? "Edit" : "Tambah"} Pengeluaran</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi</Label>
                        <Input
                          id="description"
                          value={expenseForm.description}
                          onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                          placeholder="Contoh: Listrik, Air, dll"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Jumlah</Label>
                        <Input
                          id="amount"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: formatExpenseAmount(e.target.value) })}
                          placeholder="0"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Kategori</Label>
                        <Input
                          id="category"
                          value={expenseForm.category}
                          onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                          placeholder="Contoh: Operasional, Utilitas"
                        />
                      </div>
                      <Button type="submit" className="w-full">Simpan</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {expenses.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-start text-xs bg-muted/50 p-2 rounded">
                        <div className="flex-1 cursor-pointer" onClick={() => handleViewExpense(expense)}>
                          {expense.bid && (
                            <div className="flex items-center gap-1 mb-1">
                              <div className="text-[10px] font-mono text-primary">{expense.bid}</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(expense.bid || '');
                                  toast.success("BID berhasil disalin");
                                }}
                                title="Salin BID"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                          <div className="font-medium">{expense.description}</div>
                          {expense.category && (
                            <div className="text-muted-foreground">{expense.category}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Dibuat oleh: {expense.creator_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatCurrency(expense.amount)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEditExpense(expense)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Income Card */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pemasukan</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalAdditionalIncome)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getDateRangeDisplayLocal(timeRange)}
                </p>
                
                <Dialog open={showIncomeForm} onOpenChange={(open) => {
                  setShowIncomeForm(open);
                  if (!open) {
                    setEditingIncome(null);
                    setIncomeForm({ description: "", amount: "", customer_name: "", payment_method: "", reference_no: "" });
                    setSelectedProducts([]);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full mt-2">
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Pemasukan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingIncome ? "Edit" : "Tambah"} Pemasukan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddIncome} className="space-y-4">
                      <div className="space-y-2 relative">
                        <Label htmlFor="income-customer-name">Nama Pelanggan <span className="text-red-500">*</span></Label>
                        <Input
                          id="income-customer-name"
                          value={incomeForm.customer_name}
                          onChange={(e) => handleCustomerNameChange(e.target.value)}
                          onFocus={() => {
                            if (incomeForm.customer_name.trim().length > 0) {
                              const filtered = customers.filter(
                                (customer) =>
                                  customer.name.toLowerCase().includes(incomeForm.customer_name.toLowerCase()) ||
                                  customer.phone.includes(incomeForm.customer_name)
                              );
                              setFilteredCustomers(filtered);
                              setShowCustomerSuggestions(true);
                            }
                          }}
                          placeholder="Nama pelanggan"
                          required
                          autoComplete="off"
                        />
                        {showCustomerSuggestions && filteredCustomers.length > 0 && (
                          <div className="customer-suggestions absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredCustomers.map((customer) => (
                              <div
                                key={customer.id}
                                className="px-3 py-2 hover:bg-accent cursor-pointer"
                                onClick={() => selectCustomer(customer)}
                              >
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-sm text-muted-foreground">{customer.phone}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="income-payment-method">Metode Bayar <span className="text-red-500">*</span></Label>
                        <Select
                          value={incomeForm.payment_method}
                          onValueChange={(value) => setIncomeForm({ ...incomeForm, payment_method: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih metode bayar" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="QRIS">QRIS</SelectItem>
                            <SelectItem value="Transfer">Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(incomeForm.payment_method === "QRIS" || incomeForm.payment_method === "Transfer") && (
                        <div className="space-y-2">
                          <Label htmlFor="income-reference-no">Nomor Referensi <span className="text-red-500">*</span></Label>
                          <Input
                            id="income-reference-no"
                            value={incomeForm.reference_no}
                            onChange={(e) => setIncomeForm({ ...incomeForm, reference_no: e.target.value })}
                            placeholder="Nomor referensi pembayaran"
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="income-description">Deskripsi (opsional)</Label>
                        <Input
                          id="income-description"
                          value={incomeForm.description}
                          onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                          placeholder="Deskripsi pemasukan"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label>Produk (opsional)</Label>
                          <Button type="button" size="sm" variant="outline" onClick={handleAddProduct}>
                            <Plus className="h-3 w-3 mr-1" />
                            Tambah Produk
                          </Button>
                        </div>

                        {selectedProducts.map((product, index) => (
                          <div key={index} className="flex gap-2 items-start p-2 bg-muted/50 rounded">
                            <div className="flex-1 space-y-2">
                              <Select
                                value={product.product_id}
                                onValueChange={(value) => handleProductChange(index, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih produk" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} - {formatCurrency(p.price)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={product.quantity}
                                  onChange={(e) => handleProductQuantityChange(index, parseInt(e.target.value) || 1)}
                                  className="w-20"
                                  placeholder="Qty"
                                />
                                <div className="flex-1 flex items-center justify-end text-sm font-medium">
                                  {formatCurrency(product.subtotal)}
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleRemoveProduct(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        {selectedProducts.length > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-medium">Total Produk</span>
                            <span className="font-bold text-green-600">{formatCurrency(calculateProductsTotal())}</span>
                          </div>
                        )}
                      </div>

                      {selectedProducts.length === 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="income-amount">Jumlah (jika tidak pakai produk)</Label>
                          <Input
                            id="income-amount"
                            value={incomeForm.amount}
                            onChange={(e) => setIncomeForm({ ...incomeForm, amount: formatExpenseAmount(e.target.value) })}
                            placeholder="0"
                          />
                        </div>
                      )}

                      <Button type="submit" className="w-full">Simpan</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {additionalIncomes.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                    {additionalIncomes.map((income) => (
                      <div key={income.id} className="flex justify-between items-start text-xs bg-muted/50 p-2 rounded">
                        <div className="flex-1 cursor-pointer" onClick={() => handleViewIncome(income)}>
                          {income.bid && (
                            <div className="flex items-center gap-1 mb-1">
                              <div className="text-[10px] font-mono text-primary">{income.bid}</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(income.bid || '');
                                  toast.success("BID berhasil disalin");
                                }}
                                title="Salin BID"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                          <div className="font-medium">{income.customer_name || income.description}</div>
                          {income.payment_method && (
                            <div className="text-muted-foreground">{income.payment_method}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Dibuat oleh: {income.creator_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{formatCurrency(income.amount)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEditIncome(income)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleDeleteIncome(income.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Net Profit Card */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bersih</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${
                  (stats.totalBookingRevenue + stats.totalAdditionalIncome - stats.totalExpenses) >= 0 
                    ? "text-green-600" 
                    : "text-red-600"
                }`}>
                  {formatCurrency(
                    stats.totalBookingRevenue + stats.totalAdditionalIncome - stats.totalExpenses
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pemasukan - Pengeluaran
                </p>
                <p className="text-xs text-muted-foreground">
                  {getDateRangeDisplayLocal(timeRange)}
                </p>
                
                <div className="mt-4 space-y-1 text-xs text-muted-foreground border-t pt-2">
                  <div className="flex justify-between">
                    <span>Pemasukan dari Booking:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(stats.totalBookingRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pemasukan Tambahan:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(stats.totalAdditionalIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pengeluaran:</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(stats.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold">Laporan</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Keseluruhan</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Penjualan</span>
          </TabsTrigger>
          <TabsTrigger value="income-expense" className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Pemasukan/Pengeluaran</span>
          </TabsTrigger>
          <TabsTrigger value="purchase" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Pembelian</span>
          </TabsTrigger>
          <TabsTrigger value="employee" className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Kinerja</span>
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="sales" className="mt-4">
          <SalesReport />
        </TabsContent>

        <TabsContent value="income-expense" className="mt-4">
          <IncomeExpenseReport />
        </TabsContent>

        <TabsContent value="purchase" className="mt-4">
          <PurchaseReport />
        </TabsContent>

        <TabsContent value="employee" className="mt-4">
          <EmployeePerformanceReport />
        </TabsContent>
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
