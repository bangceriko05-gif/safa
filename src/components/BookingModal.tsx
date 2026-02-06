import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, CalendarIcon, Shield, Banknote, CreditCard } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";
import { validateBookingInputs } from "@/utils/bookingValidation";
import { cn } from "@/lib/utils";
import PaymentProofUpload from "@/components/PaymentProofUpload";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedSlot: { roomId: string; time: string } | null;
  editingBooking: any;
  userId: string;
}

interface Room {
  id: string;
  name: string;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface RoomVariant {
  id: string;
  room_id: string;
  variant_name: string;
  duration: number;
  price: number;
  visibility_type?: string | null;
  visible_days?: number[] | null;
  booking_duration_type?: string | null;
  booking_duration_value?: number | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface SelectedProduct {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export default function BookingModal({
  isOpen,
  onClose,
  selectedDate,
  selectedSlot,
  editingBooking,
  userId,
}: BookingModalProps) {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [roomVariants, setRoomVariants] = useState<RoomVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [originalProducts, setOriginalProducts] = useState<SelectedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [isPrice2ManuallyEdited, setIsPrice2ManuallyEdited] = useState(false);
  const [lastFetchedStoreId, setLastFetchedStoreId] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(undefined);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  
  // Deposit state
  const [enableDeposit, setEnableDeposit] = useState(false);
  const [depositType, setDepositType] = useState<"uang" | "identitas">("uang");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositIdentityType, setDepositIdentityType] = useState("KTP");
  
  const [formData, setFormData] = useState({
    customer_name: "",
    phone: "",
    reference_no: "",
    room_id: "",
    variant_id: "",
    start_time: "",
    end_time: "",
    payment_method: "",
    price: "",
    note: "",
    dual_payment: false,
    payment_method_2: "",
    price_2: "",
    reference_no_2: "",
    status: "BO",
    discount_type: "percentage" as "percentage" | "amount",
    discount_value: "",
    has_discount: false,
    discount_applies_to: "variant" as "variant" | "product",
    booking_type: "walk_in" as "walk_in" | "ota",
  });

  // Check if PMS mode based on store calendar_type
  const isPMSMode = (currentStore as any)?.calendar_type === "pms";

  // Fetch data when modal opens or store changes
  useEffect(() => {
    if (!currentStore || !isOpen) return;
    
    // Refetch if store changed or no data yet
    const storeChanged = lastFetchedStoreId !== currentStore.id;
    if (storeChanged || rooms.length === 0) {
      fetchRooms();
    }
    if (storeChanged || customers.length === 0) {
      fetchCustomers();
    }
    if (storeChanged || products.length === 0) {
      fetchProducts();
    }
    
    if (storeChanged) {
      setLastFetchedStoreId(currentStore.id);
    }
  }, [currentStore, isOpen]);

  // When rooms are loaded and we have a selectedSlot, ensure room_id is set
  useEffect(() => {
    if (isOpen && rooms.length > 0 && selectedSlot?.roomId && !editingBooking) {
      // Check if the selected room exists in the rooms list
      const roomExists = rooms.some(room => room.id === selectedSlot.roomId);
      if (roomExists && formData.room_id !== selectedSlot.roomId) {
        setFormData(prev => ({
          ...prev,
          room_id: selectedSlot.roomId,
        }));
      }
    }
  }, [isOpen, rooms, selectedSlot, editingBooking]);

  useEffect(() => {
    if (formData.room_id) {
      fetchRoomVariants(formData.room_id);
    } else {
      setRoomVariants([]);
    }
  }, [formData.room_id]);

  // Calculate room subtotal based on variant price and duration (for display only)
  const calculateRoomSubtotal = () => {
    // For OTA, return the manual price entered
    if (formData.booking_type === "ota") {
      return parseFloat(formData.price.replace(/\./g, '')) || 0;
    }

    if (isPMSMode) {
      // For PMS mode, calculate based on nights
      if (formData.variant_id && checkInDate && checkOutDate) {
        const selectedVariant = roomVariants.find(v => v.id === formData.variant_id);
        if (selectedVariant) {
          // If variant has monthly duration type, price is already for the full period - don't multiply by nights
          if (selectedVariant.booking_duration_type === "months") {
            return selectedVariant.price;
          }
          
          const nights = differenceInCalendarDays(checkOutDate, checkInDate);
          if (nights > 0) {
            return selectedVariant.price * nights;
          }
        }
      }
      return 0;
    } else {
      // For time-based mode
      if (formData.variant_id && formData.start_time && formData.end_time) {
        const selectedVariant = roomVariants.find(v => v.id === formData.variant_id);
        if (selectedVariant) {
          const currentDuration = calculateDuration(formData.start_time, formData.end_time);
          if (currentDuration > 0) {
            return selectedVariant.price * currentDuration;
          }
        }
      }
      return 0;
    }
  };

  // Auto-fill Total Bayar with Grand Total (only if dual payment is NOT active and NOT OTA)
  useEffect(() => {
    // Skip auto-fill if dual payment is active - user should manually split the payment
    // Skip auto-fill if OTA - user inputs price manually
    if (formData.dual_payment || formData.booking_type === "ota") return;
    
    const grandTotal = calculateGrandTotal();
    if (grandTotal > 0) {
      setFormData(prev => ({
        ...prev,
        price: formatPrice(grandTotal.toString()),
      }));
    }
  }, [formData.variant_id, formData.start_time, formData.end_time, selectedProducts, formData.has_discount, formData.discount_value, formData.discount_type, formData.discount_applies_to, roomVariants, formData.dual_payment, checkInDate, checkOutDate, isPMSMode, formData.booking_type]);

  // Auto-fill Total Bayar Kedua when dual_payment is enabled
  useEffect(() => {
    if (formData.dual_payment && !isPrice2ManuallyEdited) {
      const grandTotal = calculateGrandTotal();
      const price1 = parseFloat(formData.price.replace(/\./g, '')) || 0;
      const calculatedPrice2 = grandTotal - price1;
      
      if (calculatedPrice2 >= 0) {
        setFormData(prev => ({
          ...prev,
          price_2: formatPrice(calculatedPrice2.toString()),
        }));
      }
    } else if (!formData.dual_payment) {
      setFormData(prev => ({
        ...prev,
        price_2: "",
      }));
      setIsPrice2ManuallyEdited(false);
    }
  }, [formData.dual_payment, formData.price, formData.variant_id, formData.start_time, formData.end_time, selectedProducts, formData.has_discount, formData.discount_value, formData.discount_type, formData.discount_applies_to, roomVariants, isPrice2ManuallyEdited, checkInDate, checkOutDate, isPMSMode]);

  // Initialize form when modal opens or data changes
  useEffect(() => {
    if (!isOpen) return; // Only run when modal is open
    
    if (editingBooking) {
      // Format time from "HH:MM:SS" or "HH:MM" to "HH:MM"
      const formatTime = (time: string) => {
        if (!time) return "";
        const parts = time.split(":");
        return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
      };
      
      // Determine booking type: if no variant, it's OTA
      const isOTA = !editingBooking.variant_id;
      
      setFormData({
        customer_name: editingBooking.customer_name,
        phone: editingBooking.phone,
        reference_no: editingBooking.reference_no,
        room_id: editingBooking.room_id,
        variant_id: editingBooking.variant_id || "",
        start_time: formatTime(editingBooking.start_time),
        end_time: formatTime(editingBooking.end_time),
        payment_method: editingBooking.payment_method || "",
        price: formatPrice(editingBooking.price.toString()),
        note: editingBooking.note || "",
        dual_payment: editingBooking.dual_payment || false,
        payment_method_2: editingBooking.payment_method_2 || "",
        status: editingBooking.status || "BO",
        price_2: editingBooking.price_2 ? formatPrice(editingBooking.price_2.toString()) : "",
        reference_no_2: editingBooking.reference_no_2 || "",
        discount_type: editingBooking.discount_type || "percentage",
        discount_value: editingBooking.discount_value ? editingBooking.discount_value.toString() : "",
        has_discount: !!editingBooking.discount_value && editingBooking.discount_value > 0,
        discount_applies_to: editingBooking.discount_applies_to || "variant",
        booking_type: isOTA ? "ota" : "walk_in",
      });
      // Set payment proof URL from existing booking
      setPaymentProofUrl(editingBooking.payment_proof_url || null);
      // If booking has price_2, treat it as manually edited
      setIsPrice2ManuallyEdited(!!editingBooking.price_2);

      // For PMS mode, set check-in/out dates from booking date and duration
      if (isPMSMode && editingBooking.date) {
        const bookingDate = new Date(editingBooking.date);
        setCheckInDate(bookingDate);
        if (editingBooking.duration) {
          setCheckOutDate(addDays(bookingDate, Math.ceil(editingBooking.duration)));
        } else {
          setCheckOutDate(addDays(bookingDate, 1));
        }
      }

      // Fetch booking products
      fetchBookingProducts(editingBooking.id);
    } else if (selectedSlot && selectedSlot.roomId) {
      // New booking from slot click - auto-fill room_id
      setFormData({
        customer_name: "",
        phone: "",
        reference_no: "",
        room_id: selectedSlot.roomId,
        variant_id: "",
        start_time: isPMSMode ? "" : selectedSlot.time,
        end_time: "",
        payment_method: "",
        price: "",
        note: "",
        dual_payment: false,
        payment_method_2: "",
        price_2: "",
        reference_no_2: "",
        status: "BO",
        discount_type: "percentage",
        discount_value: "",
        has_discount: false,
        discount_applies_to: "variant",
        booking_type: "walk_in",
      });
      setSelectedProducts([]);
      setOriginalProducts([]);
      setIsPrice2ManuallyEdited(false);
      setPaymentProofUrl(null);

      // For PMS mode, initialize check-in date from selected date
      if (isPMSMode) {
        // If selectedSlot.time is a date string (from PMSCalendar)
        const slotDate = new Date(selectedSlot.time);
        if (!isNaN(slotDate.getTime())) {
          setCheckInDate(slotDate);
          setCheckOutDate(addDays(slotDate, 1));
        } else {
          setCheckInDate(selectedDate);
          setCheckOutDate(addDays(selectedDate, 1));
        }
      }
    } else {
      // Reset form if no slot selected
      setFormData({
        customer_name: "",
        phone: "",
        reference_no: "",
        room_id: "",
        variant_id: "",
        start_time: "",
        end_time: "",
        payment_method: "",
        price: "",
        note: "",
        dual_payment: false,
        payment_method_2: "",
        price_2: "",
        reference_no_2: "",
        status: "BO",
        discount_type: "percentage",
        discount_value: "",
        has_discount: false,
        discount_applies_to: "variant",
        booking_type: "walk_in",
      });
      setSelectedProducts([]);
      setOriginalProducts([]);
      setIsPrice2ManuallyEdited(false);
      setPaymentProofUrl(null);
      
      // Reset check-in/out dates for PMS mode
      if (isPMSMode) {
        setCheckInDate(selectedDate);
        setCheckOutDate(addDays(selectedDate, 1));
      }
    }
  }, [isOpen, editingBooking, selectedSlot, isPMSMode, selectedDate]);

  const fetchRooms = async () => {
    try {
      if (!currentStore) return;
      
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, status")
        .eq("status", "Aktif")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      if (!currentStore) return;
      
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

  const fetchProducts = async () => {
    try {
      if (!currentStore) return;
      
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchBookingProducts = async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from("booking_products")
        .select("*")
        .eq("booking_id", bookingId);

      if (error) throw error;

      const bookingProducts = (data || []).map(item => ({
        product_id: item.product_id,
        name: item.product_name,
        price: item.product_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      }));

      setSelectedProducts(bookingProducts);
      setOriginalProducts(bookingProducts);
    } catch (error) {
      console.error("Error fetching booking products:", error);
    }
  };

  const fetchRoomVariants = async (roomId: string) => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("room_variants")
        .select("*")
        .eq("room_id", roomId)
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("variant_name");

      if (error) throw error;
      setRoomVariants(data || []);
    } catch (error) {
      console.error("Error fetching room variants:", error);
    }
  };

  // Filter variants based on selected date's day of week
  const getFilteredVariants = useMemo(() => {
    const bookingDate = isPMSMode ? checkInDate : selectedDate;
    if (!bookingDate) return roomVariants;

    const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday

    return roomVariants.filter(variant => {
      const visibilityType = variant.visibility_type || "all";
      const visibleDays = variant.visible_days;

      if (visibilityType === "all" || !visibilityType) {
        return true;
      }

      if (visibilityType === "weekdays") {
        // Show only on weekdays (Mon-Fri: 1-5)
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      }

      if (visibilityType === "weekends") {
        // Show only on weekends (Sat-Sun: 0, 6)
        return dayOfWeek === 0 || dayOfWeek === 6;
      }

      if (visibilityType === "specific_days" && visibleDays) {
        // Show only on specific days
        return visibleDays.includes(dayOfWeek);
      }

      return true;
    });
  }, [roomVariants, selectedDate, checkInDate, isPMSMode]);

  // Calculate booking end date based on variant duration settings
  const calculateBookingEndDate = (variant: RoomVariant, startDate: Date): Date => {
    const durationType = variant.booking_duration_type || "hours";
    const durationValue = variant.booking_duration_value || variant.duration || 1;

    const endDate = new Date(startDate);

    switch (durationType) {
      case "months":
        // Same date next month (not 30 days)
        endDate.setMonth(endDate.getMonth() + durationValue);
        break;
      case "weeks":
        endDate.setDate(endDate.getDate() + (durationValue * 7));
        break;
      case "days":
        endDate.setDate(endDate.getDate() + durationValue);
        break;
      case "hours":
      default:
        // For hours, we don't modify the date, just time calculation happens elsewhere
        endDate.setHours(endDate.getHours() + durationValue);
        break;
    }

    return endDate;
  };

  const handleVariantChange = (variantId: string) => {
    const selectedVariant = roomVariants.find(v => v.id === variantId);
    if (selectedVariant) {
      // For PMS mode with duration types (months, weeks, days), auto-set checkout date
      if (isPMSMode && checkInDate) {
        const durationType = selectedVariant.booking_duration_type || "hours";
        if (durationType !== "hours") {
          const newCheckoutDate = calculateBookingEndDate(selectedVariant, checkInDate);
          setCheckOutDate(newCheckoutDate);
        }
      }
      
      // Calculate end time based on start time and duration (for non-PMS mode)
      if (formData.start_time && !isPMSMode) {
        const [startHour, startMinute] = formData.start_time.split(":").map(Number);
        const totalMinutes = startHour * 60 + startMinute + selectedVariant.duration * 60;
        const endHour = Math.floor(totalMinutes / 60) % 24;
        const endMinute = totalMinutes % 60;
        const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
        
        setFormData({
          ...formData,
          variant_id: variantId,
          end_time: endTime,
        });
      } else {
        setFormData({
          ...formData,
          variant_id: variantId,
        });
      }
    } else {
      setFormData({ ...formData, variant_id: variantId });
    }
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, customer_name: value });
    setShowNameSuggestions(value.length > 0);
    
    // Auto-fill phone if exact match found
    const matchedCustomer = customers.find(
      c => c.name.toLowerCase() === value.toLowerCase()
    );
    if (matchedCustomer) {
      setFormData({ ...formData, customer_name: value, phone: matchedCustomer.phone });
      setShowNameSuggestions(false);
    }
  };

  const handlePhoneChange = async (value: string) => {
    setFormData({ ...formData, phone: value });
    
    // Auto-fill name if phone matches
    if (value.length >= 10) {
      const { data } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("phone", value)
        .maybeSingle();
      
      if (data) {
        setFormData({ ...formData, phone: value, customer_name: data.name });
        setShowPhoneSuggestions(false);
      }
    }
  };

  const selectCustomer = (customer: Customer) => {
    setFormData({ ...formData, customer_name: customer.name, phone: customer.phone });
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  // Format number with dots as thousand separators
  const formatPrice = (value: string) => {
    // Remove all non-digit characters
    const numericValue = value.replace(/\D/g, '');
    // Add dots as thousand separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse formatted price back to number
  const parsePrice = (value: string) => {
    return value.replace(/\./g, '');
  };

  const handlePriceChange = (value: string) => {
    const formatted = formatPrice(value);
    setFormData({ ...formData, price: formatted });
  };

  const handlePrice2Change = (value: string) => {
    const formatted = formatPrice(value);
    setFormData({ ...formData, price_2: formatted });
    setIsPrice2ManuallyEdited(true);
  };

  const handleAddProduct = () => {
    if (!productName || !productPrice || !productQuantity) {
      toast.error("Lengkapi data produk");
      return;
    }

    const qty = parseInt(productQuantity);
    const price = parseFloat(productPrice.replace(/\./g, ''));
    
    if (qty <= 0 || price <= 0) {
      toast.error("Jumlah dan harga harus lebih dari 0");
      return;
    }

    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
    const productId = product?.id || selectedProductId || crypto.randomUUID();

    // Check if product already added
    const existingIndex = selectedProducts.findIndex(p => p.product_id === productId);
    if (existingIndex >= 0) {
      const updated = [...selectedProducts];
      updated[existingIndex].quantity = qty;
      updated[existingIndex].price = price;
      updated[existingIndex].subtotal = price * qty;
      setSelectedProducts(updated);
    } else {
      setSelectedProducts([...selectedProducts, {
        product_id: productId,
        name: productName,
        price: price,
        quantity: qty,
        subtotal: price * qty,
      }]);
    }

    setProductName("");
    setProductPrice("");
    setSelectedProductId("");
    setProductQuantity("1");
  };

  const handleProductNameChange = (value: string) => {
    setProductName(value);
    setShowProductSuggestions(value.length > 0);
    
    const matchedProduct = products.find(p => p.name.toLowerCase() === value.toLowerCase());
    if (matchedProduct) {
      setSelectedProductId(matchedProduct.id);
      setProductPrice(matchedProduct.price.toLocaleString('id-ID'));
      setShowProductSuggestions(false);
    }
  };

  const selectProduct = (product: Product) => {
    setProductName(product.name);
    setProductPrice(product.price.toLocaleString('id-ID'));
    setSelectedProductId(product.id);
    setShowProductSuggestions(false);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId));
  };

  const calculateProductsTotal = () => {
    return selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);
  };

  const calculateDiscount = () => {
    if (!formData.has_discount || !formData.discount_value) return 0;

    const roomPrice = calculateRoomSubtotal();
    const productsTotal = calculateProductsTotal();
    
    // Determine which amount to apply discount to
    const targetAmount = formData.discount_applies_to === "variant" ? roomPrice : productsTotal;

    if (formData.discount_type === "percentage") {
      const percentage = parseFloat(formData.discount_value);
      return (targetAmount * percentage) / 100;
    } else {
      return parseFloat(formData.discount_value);
    }
  };

  const calculateGrandTotal = () => {
    const roomPrice = calculateRoomSubtotal();
    const productsTotal = calculateProductsTotal();
    const discount = calculateDiscount();
    return Math.max(0, roomPrice + productsTotal - discount);
  };

  const calculatePaymentDifference = () => {
    const grandTotal = calculateGrandTotal();
    const price1 = parseFloat(formData.price.replace(/\./g, '')) || 0;
    const price2 = formData.dual_payment ? (parseFloat(formData.price_2.replace(/\./g, '')) || 0) : 0;
    const totalPaid = price1 + price2;
    const difference = totalPaid - grandTotal;
    
    return {
      difference,
      isDifferent: Math.abs(difference) > 0,
      isOverpayment: difference > 0,
      isUnderpayment: difference < 0
    };
  };

  const filteredCustomersByName = customers.filter(c =>
    c.name.toLowerCase().includes(formData.customer_name.toLowerCase())
  ).slice(0, 5);

  const filteredCustomersByPhone = customers.filter(c =>
    c.phone.includes(formData.phone)
  ).slice(0, 5);

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    let startHour = parseInt(start.split(":")[0]);
    let endHour = parseInt(end.split(":")[0]);
    const startMinute = parseInt(start.split(":")[1] || "0");
    const endMinute = parseInt(end.split(":")[1] || "0");
    
    // Handle overnight bookings (e.g., 23:00 to 02:00)
    if (endHour < startHour) {
      endHour += 24;
    }
    
    return (endHour - startHour) + (endMinute - startMinute) / 60;
  };

  // Calculate duration in nights/days for blocking calendar
  // For monthly variants, use the actual number of days between check-in and check-out
  const duration = isPMSMode 
    ? (checkInDate && checkOutDate ? differenceInCalendarDays(checkOutDate, checkInDate) : 0)
    : calculateDuration(formData.start_time, formData.end_time);
  
  // Ensure duration is at least 1 for valid bookings
  const finalDuration = duration > 0 ? duration : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate user inputs with zod schema
      const inputValidation = validateBookingInputs({
        customer_name: formData.customer_name,
        phone: formData.phone,
        reference_no: formData.reference_no,
        reference_no_2: formData.reference_no_2,
        note: formData.note,
      }, formData.booking_type === "ota");

      if (!inputValidation.success) {
        inputValidation.errors.forEach(error => toast.error(error));
        setLoading(false);
        return;
      }

      if (!formData.room_id) {
        toast.error("Silakan pilih ruangan terlebih dahulu");
        setLoading(false);
        return;
      }

      // Validate variant is selected (only for walk_in type)
      if (formData.booking_type === "walk_in" && !formData.variant_id) {
        toast.error("Varian kamar wajib dipilih untuk Walk-in");
        setLoading(false);
        return;
      }

      // Validate payment method is selected
      if (!formData.payment_method) {
        toast.error("Metode pembayaran wajib dipilih");
        setLoading(false);
        return;
      }

      // Validate payment proof is uploaded
      if (!paymentProofUrl) {
        toast.error("Bukti bayar wajib diupload");
        setLoading(false);
        return;
      }

      // Validate dual payment
      if (formData.dual_payment) {
        const price2Value = parseFloat(formData.price_2.replace(/\./g, '')) || 0;
        if (price2Value === 0) {
          toast.error("Total Bayar Kedua tidak boleh 0");
          setLoading(false);
          return;
        }
        if (!formData.payment_method_2) {
          toast.error("Metode Pembayaran Kedua wajib diisi saat Dual Payment aktif");
          setLoading(false);
          return;
        }
      }

      // Validate duration/dates
      if (isPMSMode) {
        if (!checkInDate || !checkOutDate) {
          toast.error("Tanggal Check In dan Check Out wajib diisi");
          setLoading(false);
          return;
        }
        if (differenceInCalendarDays(checkOutDate, checkInDate) <= 0) {
          toast.error("Tanggal Check Out harus setelah Check In");
          setLoading(false);
          return;
        }
      } else {
        if (duration <= 0) {
          toast.error("Jam selesai harus lebih besar dari jam mulai");
          setLoading(false);
          return;
        }
      }

      // Check if room is active
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", formData.room_id)
        .single();

      if (roomError) throw roomError;

      if (roomData.status !== "Aktif") {
        toast.error("Ruangan ini sedang tidak tersedia. Silakan pilih ruangan lain.");
        return;
      }

      // Check for overlapping bookings - ONLY if time or room changed (skip for PMS mode for now)
      const dateStr = isPMSMode && checkInDate 
        ? format(checkInDate, "yyyy-MM-dd") 
        : format(selectedDate, "yyyy-MM-dd");
      
      // Skip overlap check for PMS mode - will implement date range overlap check later
      if (!isPMSMode) {
        // Skip overlap check if editing and only status changed (no time/room change)
        const timeOrRoomChanged = !editingBooking || 
          editingBooking.room_id !== formData.room_id ||
          editingBooking.start_time?.substring(0, 5) !== formData.start_time ||
          editingBooking.end_time?.substring(0, 5) !== formData.end_time;
        
        if (timeOrRoomChanged) {
          let query = supabase
            .from("bookings")
            .select("*")
            .eq("room_id", formData.room_id)
            .eq("date", dateStr);
          
          // Only exclude current booking if editing
          if (editingBooking?.id) {
            query = query.neq("id", editingBooking.id);
          }
          
          const { data: existingBookings, error: checkError } = await query;

          if (checkError) throw checkError;

          const hasOverlap = existingBookings?.some((booking) => {
            let existingStart = parseInt(booking.start_time.split(":")[0]);
            let existingEnd = parseInt(booking.end_time.split(":")[0]);
            let newStart = parseInt(formData.start_time.split(":")[0]);
            let newEnd = parseInt(formData.end_time.split(":")[0]);

            // Handle overnight bookings - convert hours after midnight to 24+ format
            // If end time is 00:00-08:00, treat it as next day (24-32)
            if (existingEnd >= 0 && existingEnd < 9 && existingStart >= 9) {
              existingEnd += 24;
            }
            if (newEnd >= 0 && newEnd < 9 && newStart >= 9) {
              newEnd += 24;
            }
            
            // If new booking starts in early morning (00:00-08:00), convert to 24+ format
            // to check against bookings that might extend past midnight
            if (newStart >= 0 && newStart < 9) {
              newStart += 24;
            }
            if (newEnd >= 0 && newEnd < 9) {
              newEnd += 24;
            }

            return (
              (newStart >= existingStart && newStart < existingEnd) ||
              (newEnd > existingStart && newEnd <= existingEnd) ||
              (newStart <= existingStart && newEnd >= existingEnd)
            );
          });

          if (hasOverlap) {
            toast.error("Ruangan sudah dibooking pada waktu tersebut");
            return;
          }
        }
      }

      if (!currentStore) {
        toast.error("Pilih cabang terlebih dahulu");
        return;
      }

      const bookingData: any = {
        customer_name: formData.customer_name,
        phone: formData.phone,
        reference_no: formData.reference_no,
        room_id: formData.room_id,
        variant_id: formData.variant_id || null,
        start_time: isPMSMode ? "14:00" : formData.start_time,
        end_time: isPMSMode ? "12:00" : formData.end_time,
        payment_method: formData.payment_method || null,
        note: formData.note || null,
        dual_payment: formData.dual_payment,
        payment_method_2: formData.payment_method_2 || null,
        reference_no_2: formData.reference_no_2 || null,
        status: formData.status,
        date: dateStr,
        duration: finalDuration,
        price: parseFloat(parsePrice(formData.price)),
        price_2: formData.price_2 ? parseFloat(parsePrice(formData.price_2)) : null,
        discount_type: formData.has_discount ? formData.discount_type : null,
        discount_value: formData.has_discount && formData.discount_value ? parseFloat(formData.discount_value) : 0,
        discount_applies_to: formData.has_discount ? formData.discount_applies_to : null,
        store_id: currentStore.id,
        payment_proof_url: paymentProofUrl,
        payment_status: (() => {
          const grandTotal = calculateGrandTotal();
          const totalPaid = parseFloat(parsePrice(formData.price)) + (formData.dual_payment && formData.price_2 ? parseFloat(parsePrice(formData.price_2)) : 0);
          return totalPaid >= grandTotal && grandTotal > 0 ? "lunas" : "belum_lunas";
        })(),
      };

      // Only set created_by for NEW bookings, never update it for existing bookings
      if (!editingBooking) {
        bookingData.created_by = userId;
      }

      // Track status changes for editing bookings
      if (editingBooking) {
        const previousStatus = editingBooking.status || 'BO';
        const newStatus = formData.status;

        // If status changed to CI, track check-in
        if (newStatus === 'CI' && previousStatus !== 'CI') {
          bookingData.checked_in_by = userId;
          bookingData.checked_in_at = new Date().toISOString();
        }

        // If status changed to CO, track check-out
        if (newStatus === 'CO' && previousStatus !== 'CO') {
          bookingData.checked_out_by = userId;
          bookingData.checked_out_at = new Date().toISOString();
        }

        // If status changed to BO, track confirmation
        if (newStatus === 'BO' && previousStatus !== 'BO') {
          bookingData.confirmed_by = userId;
          bookingData.confirmed_at = new Date().toISOString();
        }
      } else {
        // For new bookings with BO status, set confirmed_by
        if (formData.status === 'BO') {
          bookingData.confirmed_by = userId;
          bookingData.confirmed_at = new Date().toISOString();
        }
      }

      // Auto-save customer to database if new
      const existingCustomer = customers.find(
        c => c.phone === formData.phone
      );
      
      if (!existingCustomer && !editingBooking) {
        try {
          await supabase.from("customers").insert([{
            name: formData.customer_name,
            phone: formData.phone,
            created_by: userId,
            store_id: currentStore.id,
          }]);
          // Refresh customers list
          fetchCustomers();
        } catch (error: any) {
          // If customer already exists (race condition), continue with booking
          if (error.code !== '23505') {
            console.error("Error saving customer:", error);
          }
        }
      }

      const roomName = rooms.find(r => r.id === formData.room_id)?.name || 'Unknown';
      const previousStatus = editingBooking?.status || "BO";
      const isCheckoutTransition = Boolean(editingBooking && formData.status === "CO" && previousStatus !== "CO");

      if (editingBooking) {
        // Log what we're updating for debugging
        console.log('Updating booking with data:', bookingData);
        
        const { error } = await supabase
          .from("bookings")
          .update(bookingData)
          .eq("id", editingBooking.id);

        if (error) throw error;

        // If checked-out, mark room as "Kotor" for TODAY (the actual checkout date)
        if (isCheckoutTransition) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const { error: dailyError } = await supabase
            .from("room_daily_status")
            .upsert(
              {
                room_id: formData.room_id,
                date: todayStr,
                status: "Kotor",
                updated_by: userId,
              },
              { onConflict: "room_id,date" }
            );

          if (dailyError) throw dailyError;
        }

        // Delete existing products
        await supabase
          .from("booking_products")
          .delete()
          .eq("booking_id", editingBooking.id);

        // Insert new products
        if (selectedProducts.length > 0) {
          const bookingProducts = selectedProducts.map(p => ({
            booking_id: editingBooking.id,
            product_id: p.product_id,
            product_name: p.name,
            product_price: p.price,
            quantity: p.quantity,
            subtotal: p.subtotal,
          }));

          const { error: productsError } = await supabase
            .from("booking_products")
            .insert(bookingProducts);

          if (productsError) throw productsError;
        }
        
        // Build detailed change description (singkat tapi jelas)
        const changes: string[] = [];

        const shortText = (value: string, max = 24) => {
          const v = (value || "").trim();
          if (!v) return "-";
          return v.length > max ? `${v.slice(0, max - 1)}…` : v;
        };

        const formatMoney = (value: number | null | undefined) => {
          const n = Number(value || 0);
          return `Rp ${n.toLocaleString("id-ID")}`;
        };

        const addChange = (label: string, from: string, to: string) => {
          const f = from || "-";
          const t = to || "-";
          if (f === t) return;
          changes.push(`${label} ${f}→${t}`);
        };

        const statusLabels: Record<string, string> = {
          BO: "Reservasi",
          CI: "Check In",
          CO: "Check Out",
          BATAL: "Batal",
        };

        addChange(
          "status",
          statusLabels[editingBooking.status] || editingBooking.status || "-",
          statusLabels[formData.status] || formData.status || "-"
        );

        if (editingBooking.room_id !== formData.room_id) {
          const prevRoomName = rooms.find((r) => r.id === editingBooking.room_id)?.name || "Unknown";
          addChange("kamar", prevRoomName, roomName);
        }

        addChange("tgl", editingBooking.date || "-", dateStr || "-");

        const prevTime = `${editingBooking.start_time?.substring(0, 5) || "-"}-${editingBooking.end_time?.substring(0, 5) || "-"}`;
        const newTime = `${formData.start_time || "-"}-${formData.end_time || "-"}`;
        addChange("waktu", prevTime, newTime);

        if ((editingBooking.variant_id || "") !== (formData.variant_id || "")) {
          const prevVariant =
            roomVariants.find((v) => v.id === editingBooking.variant_id)?.variant_name ||
            editingBooking.variant_id ||
            "-";
          const nextVariant =
            roomVariants.find((v) => v.id === formData.variant_id)?.variant_name ||
            formData.variant_id ||
            "-";
          addChange("varian", prevVariant, nextVariant);
        }

        const pay1Old = `${editingBooking.payment_method || "-"}${editingBooking.reference_no ? ` (${editingBooking.reference_no})` : ""}`;
        const pay1New = `${formData.payment_method || "-"}${formData.reference_no ? ` (${formData.reference_no})` : ""}`;
        addChange("bayar", pay1Old, pay1New);

        const dualOld = Boolean(editingBooking.dual_payment);
        const dualNew = Boolean(formData.dual_payment);
        if (dualOld !== dualNew) {
          changes.push(`split ${dualOld ? "ON" : "OFF"}→${dualNew ? "ON" : "OFF"}`);
        }

        const prevPrice1 = Number(editingBooking.price || 0);
        const newPrice1 = parseFloat(formData.price.replace(/\./g, "")) || 0;
        if (prevPrice1 !== newPrice1) {
          changes.push(`total1 ${formatMoney(prevPrice1)}→${formatMoney(newPrice1)}`);
        }

        const prevPrice2Num = editingBooking.price_2 == null ? null : Number(editingBooking.price_2);
        const newPrice2Num = formData.price_2 ? parseFloat(formData.price_2.replace(/\./g, "")) || 0 : null;
        const prevPrice2Str = prevPrice2Num == null ? "-" : formatMoney(prevPrice2Num);
        const newPrice2Str = newPrice2Num == null ? "-" : formatMoney(newPrice2Num);
        addChange("total2", prevPrice2Str, newPrice2Str);

        const pay2Old = `${editingBooking.payment_method_2 || "-"}${editingBooking.reference_no_2 ? ` (${editingBooking.reference_no_2})` : ""}`;
        const pay2New = `${formData.payment_method_2 || "-"}${formData.reference_no_2 ? ` (${formData.reference_no_2})` : ""}`;
        addChange("bayar2", pay2Old, pay2New);

        addChange("catatan", shortText(editingBooking.note || ""), shortText(formData.note || ""));

        const formatDiscount = (type: string | null | undefined, value: number | null | undefined) => {
          const v = Number(value || 0);
          if (!v) return "-";
          return type === "amount" ? formatMoney(v) : `${v}%`;
        };
        const prevDiscount = formatDiscount(editingBooking.discount_type, editingBooking.discount_value);
        const nextDiscount = formatDiscount(formData.discount_type, parseFloat(formData.discount_value) || 0);
        addChange("diskon", prevDiscount, nextDiscount);

        // Products diff
        const oldById = new Map(originalProducts.map((p) => [p.product_id, p] as const));
        const newById = new Map(selectedProducts.map((p) => [p.product_id, p] as const));
        const allIds = Array.from(new Set([...oldById.keys(), ...newById.keys()]));
        const productChanges: string[] = [];

        allIds.forEach((id) => {
          const oldP = oldById.get(id);
          const newP = newById.get(id);

          if (!oldP && newP) {
            productChanges.push(`+${newP.name} x${newP.quantity}`);
            return;
          }

          if (oldP && !newP) {
            productChanges.push(`-${oldP.name}`);
            return;
          }

          if (oldP && newP) {
            if (oldP.quantity !== newP.quantity) {
              productChanges.push(`${newP.name} x${oldP.quantity}→${newP.quantity}`);
              return;
            }
          }
        });

        if (productChanges.length > 0) {
          const shown = productChanges.slice(0, 3).join(", ");
          const extra = productChanges.length > 3 ? ` +${productChanges.length - 3} lagi` : "";
          changes.push(`produk ${shown}${extra}`);
        }

        const bookingContext = `${formData.customer_name} (${roomName}, ${dateStr})`;
        const description =
          changes.length === 0
            ? `Simpan booking ${bookingContext} (tanpa perubahan)`
            : `Ubah booking ${bookingContext}: ${changes.join("; ")}`;
        
        // Log activity
        await logActivity({
          actionType: 'updated',
          entityType: 'Booking',
          entityId: editingBooking.id,
          description,
          storeId: currentStore?.id,
        });
        
        toast.success("Booking berhasil diupdate");
      } else {
        const { data: newBooking, error } = await supabase
          .from("bookings")
          .insert([bookingData])
          .select()
          .single();

        if (error) throw error;

        // Insert products
        if (selectedProducts.length > 0) {
          const bookingProducts = selectedProducts.map(p => ({
            booking_id: newBooking.id,
            product_id: p.product_id,
            product_name: p.name,
            product_price: p.price,
            quantity: p.quantity,
            subtotal: p.subtotal,
          }));

          const { error: productsError } = await supabase
            .from("booking_products")
            .insert(bookingProducts);

          if (productsError) throw productsError;
        }
        
        // Create deposit if enabled
        if (enableDeposit && currentStore) {
          const depositData = {
            room_id: formData.room_id,
            store_id: currentStore.id,
            deposit_type: depositType,
            amount: depositType === "uang" ? parseFloat(depositAmount.replace(/\D/g, "")) : null,
            identity_type: depositType === "identitas" ? depositIdentityType : null,
            identity_owner_name: depositType === "identitas" ? formData.customer_name : null,
            created_by: userId,
            status: "active",
          };

          const { error: depositError } = await supabase
            .from("room_deposits")
            .insert(depositData);

          if (depositError) {
            console.error("Error creating deposit:", depositError);
            // Don't fail the booking, just log the error
          } else {
            const depositDescription = depositType === "uang" 
              ? `Rp ${depositAmount}` 
              : `Identitas (${depositIdentityType})`;
            
            await logActivity({
              actionType: "created",
              entityType: "Deposit",
              description: `Menambahkan deposit ${depositDescription} untuk kamar ${roomName} (Booking ${formData.customer_name})`,
            });
          }
        }
        
        // Log activity
        await logActivity({
          actionType: 'created',
          entityType: 'Booking',
          entityId: newBooking.id,
          description: `Membuat booking ${formData.customer_name} di kamar ${roomName} pada ${dateStr}`,
          storeId: currentStore?.id,
        });
        
        toast.success("Booking berhasil ditambahkan");
      }

      onClose();
      setSelectedProducts([]);
      setOriginalProducts([]);
      setSelectedProductId("");
      setProductName("");
      setProductPrice("");
      setProductQuantity("1");
      setFormData({
        customer_name: "",
        phone: "",
        reference_no: "",
        room_id: "",
        variant_id: "",
        start_time: "",
        end_time: "",
        payment_method: "",
        price: "",
        note: "",
        dual_payment: false,
        payment_method_2: "",
        price_2: "",
        reference_no_2: "",
        status: "BO",
        discount_type: "percentage",
        discount_value: "",
        has_discount: false,
        discount_applies_to: "variant",
        booking_type: "walk_in",
      });
      // Reset deposit state
      setEnableDeposit(false);
      setDepositType("uang");
      setDepositAmount("");
      setDepositIdentityType("KTP");

      // Trigger refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent("booking-changed"));
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingBooking ? "Ubah Booking" : "Tambah Booking"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Booking Type Selection */}
          <div className="space-y-2">
            <Label>Tipe Booking *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.booking_type === "walk_in" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormData({ ...formData, booking_type: "walk_in", variant_id: "" })}
              >
                Walk-in
              </Button>
              <Button
                type="button"
                variant={formData.booking_type === "ota" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormData({ ...formData, booking_type: "ota", variant_id: "" })}
              >
                OTA
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Nama Pelanggan</Label>
            <div className="relative">
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setShowNameSuggestions(formData.customer_name.length > 0)}
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                placeholder="Ketik nama pelanggan..."
                required
              />
              {showNameSuggestions && filteredCustomersByName.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomersByName.map((customer) => (
                    <div
                      key={customer.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onMouseDown={() => selectCustomer(customer)}
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-gray-600">{customer.phone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Nomor HP {formData.booking_type !== "ota" && "*"}
            </Label>
            <div className="relative">
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={formData.booking_type === "ota" ? "Opsional untuk OTA..." : "Ketik nomor HP..."}
                required={formData.booking_type !== "ota"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room_id">Ruangan *</Label>
            <Select
              value={formData.room_id}
              onValueChange={(value) => setFormData({ ...formData, room_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih ruangan" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {rooms.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Tidak ada ruangan aktif
                  </div>
                ) : (
                  rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Varian Kamar - Only show for Walk-in */}
          {formData.room_id && formData.booking_type === "walk_in" && (
            <div className="space-y-2">
              <Label htmlFor="variant_id">Varian Kamar *</Label>
              {getFilteredVariants.length > 0 ? (
                <>
                  <Select
                    value={formData.variant_id}
                    onValueChange={(value) => handleVariantChange(value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih varian" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {getFilteredVariants.map((variant) => {
                        const durationType = variant.booking_duration_type || "hours";
                        const durationValue = variant.booking_duration_value || variant.duration || 1;
                        const durationLabel = durationType === "months" ? `${durationValue} bulan` :
                                             durationType === "weeks" ? `${durationValue} minggu` :
                                             durationType === "days" ? `${durationValue} hari` :
                                             `${durationValue} jam`;
                        
                        return (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.variant_name} - Rp {variant.price.toLocaleString('id-ID')} ({durationLabel})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {roomVariants.length !== getFilteredVariants.length && (
                      <span className="text-amber-600">
                        {roomVariants.length - getFilteredVariants.length} varian tidak ditampilkan (tidak tersedia di hari ini). 
                      </span>
                    )}
                    Wajib memilih varian untuk mengisi harga otomatis
                  </p>
                </>
              ) : roomVariants.length > 0 ? (
                <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md border border-amber-200">
                  Tidak ada varian yang tersedia untuk hari ini. Varian kamar ini hanya tersedia di hari-hari tertentu.
                </div>
              ) : (
                <div className="text-sm text-red-500 p-3 bg-red-50 rounded-md border border-red-200">
                  Belum ada varian untuk kamar ini. Silakan tambahkan varian kamar terlebih dahulu di menu Pengaturan.
                </div>
              )}
            </div>
          )}

          {/* OTA Manual Price Input */}
          {formData.room_id && formData.booking_type === "ota" && (
            <div className="space-y-2">
              <Label htmlFor="ota_price">Harga (Input Manual) *</Label>
              <Input
                id="ota_price"
                value={formData.price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="Masukkan harga"
                required
              />
              <p className="text-sm text-muted-foreground">
                Masukkan harga booking dari OTA secara manual
              </p>
            </div>
          )}

          {/* Check-In/Check-Out for PMS Mode OR Start/End Time for regular mode */}
          {isPMSMode ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check In</Label>
                <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkInDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkInDate ? format(checkInDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkInDate}
                      onSelect={(date) => {
                        setCheckInDate(date);
                        // Auto-set checkout to next day if not set or if before check-in
                        if (date && (!checkOutDate || checkOutDate <= date)) {
                          setCheckOutDate(addDays(date, 1));
                        }
                        setCheckInOpen(false);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Check Out</Label>
                <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkOutDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOutDate ? format(checkOutDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkOutDate}
                      onSelect={(date) => {
                        setCheckOutDate(date);
                        setCheckOutOpen(false);
                      }}
                      disabled={(date) => checkInDate ? date <= checkInDate : false}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Jam Mulai</Label>
                <Select
                  value={formData.start_time}
                  onValueChange={(value) => {
                    setFormData({ ...formData, start_time: value });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jam mulai" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[200px]">
                    {/* Generate time slots from 09:00 to 05:00 (next day) */}
                    {Array.from({ length: 20 }, (_, i) => {
                      const hour = i + 9;
                      const displayHour = hour >= 24 ? hour - 24 : hour;
                      const timeValue = `${displayHour.toString().padStart(2, "0")}:00`;
                      return (
                        <SelectItem key={`start-${i}`} value={timeValue}>
                          {timeValue}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">Jam Selesai</Label>
                <Select
                  value={formData.end_time}
                  onValueChange={(value) =>
                    setFormData({ ...formData, end_time: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jam selesai" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[200px]">
                    {/* Generate all time slots from 10:00 to 06:00 (next day) */}
                    {Array.from({ length: 21 }, (_, i) => {
                      const hour = i + 10;
                      const displayHour = hour >= 24 ? hour - 24 : hour;
                      const timeValue = `${displayHour.toString().padStart(2, "0")}:00`;
                      return (
                        <SelectItem key={`end-${i}`} value={timeValue}>
                          {timeValue}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Tambah Produk (Opsional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Label htmlFor="product_name" className="text-xs">Nama Produk</Label>
                <Input
                  id="product_name"
                  value={productName}
                  onChange={(e) => handleProductNameChange(e.target.value)}
                  onFocus={() => setShowProductSuggestions(productName.length > 0)}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProduct();
                    }
                  }}
                  placeholder="Pilih atau ketik nama produk"
                />
                {showProductSuggestions && products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase())).length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase())).slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="px-3 py-2 hover:bg-accent cursor-pointer"
                        onMouseDown={() => selectProduct(product)}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">Rp {product.price.toLocaleString('id-ID')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="product_price" className="text-xs">Harga</Label>
                <Input
                  id="product_price"
                  value={productPrice}
                  onChange={(e) => setProductPrice(formatPrice(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProduct();
                    }
                  }}
                  placeholder="25000"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="product_qty" className="text-xs">Qty</Label>
                <Input
                  id="product_qty"
                  type="number"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProduct();
                    }
                  }}
                  placeholder="1"
                  min="1"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={handleAddProduct} className="w-full">
                  Tambah
                </Button>
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 mt-2">
                {selectedProducts.map((product) => (
                  <div key={product.product_id} className="flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground"> x{product.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Rp {product.subtotal.toLocaleString('id-ID')}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(product.product_id)}
                        className="h-6 w-6 p-0"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount Section */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_discount"
                checked={formData.has_discount}
                onCheckedChange={(checked) => 
                  setFormData({ 
                    ...formData, 
                    has_discount: checked as boolean,
                    discount_value: checked ? formData.discount_value : ""
                  })
                }
              />
              <Label
                htmlFor="has_discount"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Tambah Diskon
              </Label>
            </div>

            {formData.has_discount && (
              <div className="space-y-2 pl-6">
                <div>
                  <Label htmlFor="discount_applies_to" className="text-xs">Diskon Untuk</Label>
                  <Select
                    value={formData.discount_applies_to}
                    onValueChange={(value: "variant" | "product") => 
                      setFormData({ ...formData, discount_applies_to: value })
                    }
                  >
                    <SelectTrigger id="discount_applies_to">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="variant">Varian Ruangan</SelectItem>
                      <SelectItem value="product">Produk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="discount_type" className="text-xs">Tipe Diskon</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value: "percentage" | "amount") => 
                        setFormData({ ...formData, discount_type: value })
                      }
                    >
                      <SelectTrigger id="discount_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="percentage">Persentase (%)</SelectItem>
                        <SelectItem value="amount">Rupiah (Rp)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="discount_value" className="text-xs">
                      {formData.discount_type === "percentage" ? "Persentase" : "Jumlah"}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder={formData.discount_type === "percentage" ? "10" : "50000"}
                      min="0"
                      max={formData.discount_type === "percentage" ? "100" : undefined}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {(duration > 0 || formData.booking_type === "ota") && (
            <div className="border rounded-lg p-4 space-y-3 bg-card">
              <h3 className="font-semibold text-base border-b pb-2">Billing / Nota</h3>
              
              <div className="space-y-2 text-sm">
                {/* OTA Info */}
                {formData.booking_type === "ota" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipe:</span>
                      <span className="font-medium text-blue-600">OTA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isPMSMode ? "Total Malam:" : "Total Jam:"}</span>
                      <span className="font-medium">{isPMSMode ? `${finalDuration} malam` : `${duration > 0 ? duration.toFixed(1) : '-'} jam`}</span>
                    </div>
                  </>
                )}

                {/* Walk-in Variant Info */}
                {formData.booking_type === "walk_in" && formData.variant_id && roomVariants.length > 0 && (() => {
                  const selectedVariant = roomVariants.find(v => v.id === formData.variant_id);
                  const isMonthlyVariant = selectedVariant?.booking_duration_type === "months";
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode:</span>
                        <span className="font-medium">
                          {selectedVariant?.variant_name || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {isMonthlyVariant ? "Harga per bulan:" : isPMSMode ? "Harga per malam:" : "Harga per jam:"}
                        </span>
                        <span className="font-medium">
                          Rp {selectedVariant?.price.toLocaleString('id-ID') || '0'}
                        </span>
                      </div>
                      {/* Show duration info */}
                      {isMonthlyVariant ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Durasi:</span>
                          <span className="font-medium">
                            {selectedVariant?.booking_duration_value || 1} bulan ({finalDuration} malam)
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{isPMSMode ? "Total Malam:" : "Total Jam:"}</span>
                          <span className="font-medium">{isPMSMode ? `${finalDuration} malam` : `${duration.toFixed(1)} jam`}</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {selectedProducts.length > 0 && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <div className="font-medium mb-2">Produk:</div>
                      {selectedProducts.map((product) => (
                        <div key={product.product_id} className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">
                            {product.name} x{product.quantity}
                          </span>
                          <span className="font-medium">
                            Rp {product.subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                 
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{formData.booking_type === "ota" ? "Harga OTA:" : "Subtotal Kamar:"}</span>
                    <span className="font-bold text-primary">
                      Rp {calculateRoomSubtotal().toLocaleString('id-ID')}
                    </span>
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold">Subtotal Produk:</span>
                      <span className="font-bold text-primary">
                        Rp {calculateProductsTotal().toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  
                  {formData.has_discount && formData.discount_value && (
                    <div className="flex justify-between items-center mt-1 text-red-600">
                      <span className="font-semibold">
                        Diskon ({formData.discount_type === "percentage" ? `${formData.discount_value}%` : `Rp ${parseFloat(formData.discount_value).toLocaleString('id-ID')}`}):
                      </span>
                      <span className="font-bold">
                        - Rp {calculateDiscount().toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <span className="font-bold text-base">TOTAL KESELURUHAN:</span>
                    <span className="font-bold text-xl text-primary">
                      Rp {calculateGrandTotal().toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Total Bayar Section */}
                  {(formData.price || formData.price_2) && (
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Bayar:</span>
                        <span className="font-semibold text-base">
                          Rp {(parseFloat(formData.price.replace(/\./g, '')) || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {formData.dual_payment && formData.price_2 && (
                        <>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-semibold">Total Bayar 2:</span>
                            <span className="font-semibold text-base">
                              Rp {(parseFloat(formData.price_2.replace(/\./g, '')) || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1 pt-1 border-t">
                            <span className="font-bold">Total Dibayar:</span>
                            <span className="font-bold text-base">
                              Rp {((parseFloat(formData.price.replace(/\./g, '')) || 0) + (parseFloat(formData.price_2.replace(/\./g, '')) || 0)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Payment Difference in Billing */}
                      {(() => {
                        const paymentDiff = calculatePaymentDifference();
                        if (paymentDiff.isDifferent) {
                          return (
                            <div className={`flex justify-between items-center mt-2 pt-2 border-t ${paymentDiff.isOverpayment ? 'text-green-600' : 'text-yellow-600'}`}>
                              <span className="font-bold">
                                {paymentDiff.isOverpayment ? "Kelebihan Bayar:" : "Kekurangan Bayar:"}
                              </span>
                              <span className="font-bold text-base">
                                Rp {Math.abs(paymentDiff.difference).toLocaleString('id-ID')}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-2 mt-2 hidden">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Harga:</span>
                    <span className="font-bold text-lg text-primary">
                      Rp {formData.price ? parsePrice(formData.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment_method">Metode Pembayaran *</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => {
                console.log('Payment method changed to:', value);
                setFormData({ ...formData, payment_method: value });
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih metode pembayaran" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="Qris">Qris</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Proof Upload */}
          <PaymentProofUpload
            value={paymentProofUrl}
            onChange={setPaymentProofUrl}
            required
            disabled={loading}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Total Bayar {formData.dual_payment ? "Pertama *" : ""}</Label>
              <Input
                id="price"
                type="text"
                value={formData.price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder={formData.dual_payment ? "Masukkan nilai pembayaran pertama" : "Masukan total bayar"}
                required
              />
              {formData.dual_payment && (
                <p className="text-xs text-muted-foreground">
                  Masukkan nilai pembayaran pertama (misal: setengah dari total keseluruhan)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_no">No. Reff</Label>
              <Input
                id="reference_no"
                value={formData.reference_no}
                onChange={(e) =>
                  setFormData({ ...formData, reference_no: e.target.value })
                }
                placeholder="Nomor referensi (opsional)"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dual_payment"
              checked={formData.dual_payment}
              onCheckedChange={(checked) => {
                if (checked) {
                  // When enabling dual payment, reset price fields so user can split payment correctly
                  setFormData({ 
                    ...formData, 
                    dual_payment: true,
                    price: "",
                    price_2: ""
                  });
                  setIsPrice2ManuallyEdited(false);
                  toast.info("Masukkan nilai pembayaran pertama dan kedua yang terpisah");
                } else {
                  // When disabling dual payment, set price back to grand total
                  const grandTotal = calculateGrandTotal();
                  setFormData({ 
                    ...formData, 
                    dual_payment: false,
                    price: grandTotal.toLocaleString('id-ID'),
                    price_2: "",
                    payment_method_2: "",
                    reference_no_2: ""
                  });
                  setIsPrice2ManuallyEdited(false);
                }
              }}
            />
            <Label
              htmlFor="dual_payment"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Dual Payment
            </Label>
          </div>

          {formData.dual_payment && (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment_method_2">Metode Pembayaran Kedua *</Label>
                <Select
                  value={formData.payment_method_2}
                  onValueChange={(value) => setFormData({ ...formData, payment_method_2: value })}
                  required={formData.dual_payment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode pembayaran kedua *" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="Qris">Qris</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_2">Total Bayar Kedua *</Label>
                  <Input
                    id="price_2"
                    type="text"
                    value={formData.price_2}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = parseFloat(value.replace(/\./g, '')) || 0;
                      if (numValue === 0 && value !== "") {
                        toast.error("Total Bayar Kedua tidak boleh 0");
                      }
                      handlePrice2Change(value);
                    }}
                    placeholder="Masukkan nilai pembayaran kedua"
                    required={formData.dual_payment}
                  />
                  <p className="text-xs text-muted-foreground">
                    Masukkan nilai pembayaran kedua (sisanya dari total keseluruhan)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_no_2">No. Reff Kedua</Label>
                  <Input
                    id="reference_no_2"
                    value={formData.reference_no_2}
                    onChange={(e) =>
                      setFormData({ ...formData, reference_no_2: e.target.value })
                    }
                    placeholder="Nomor referensi kedua (opsional)"
                  />
                </div>
              </div>
            </>
          )}

          {/* Payment Difference Alert */}
          {(() => {
            const paymentDiff = calculatePaymentDifference();
            if (paymentDiff.isDifferent) {
              return (
                <Alert className={paymentDiff.isOverpayment ? "border-green-500 bg-green-50" : "border-yellow-500 bg-yellow-50"}>
                  <div className="flex items-start gap-2">
                    {paymentDiff.isOverpayment ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    )}
                    <AlertDescription className={paymentDiff.isOverpayment ? "text-green-800" : "text-yellow-800"}>
                      <strong>
                        {paymentDiff.isOverpayment ? "Kelebihan Bayar: " : "Kekurangan Bayar: "}
                      </strong>
                      Rp {Math.abs(paymentDiff.difference).toLocaleString('id-ID')}
                    </AlertDescription>
                  </div>
                </Alert>
              );
            }
            return null;
          })()}


          {editingBooking && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="BO">BO (Booking)</SelectItem>
                  <SelectItem value="CI">CI (Check In)</SelectItem>
                  <SelectItem value="CO">CO (Check Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Deposit Section - Only for new bookings */}
          {!editingBooking && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <Label className="font-medium">Deposit (Opsional)</Label>
                </div>
                <Checkbox
                  id="enable_deposit"
                  checked={enableDeposit}
                  onCheckedChange={(checked) => setEnableDeposit(checked === true)}
                />
              </div>
              
              {enableDeposit && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Deposit Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Jenis Deposit</Label>
                    <RadioGroup
                      value={depositType}
                      onValueChange={(value) => setDepositType(value as "uang" | "identitas")}
                      className="grid grid-cols-2 gap-2"
                    >
                      <Label
                        htmlFor="deposit-type-uang"
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                          depositType === "uang" 
                            ? "bg-primary/10 border-primary shadow-sm" 
                            : "hover:bg-muted border-border"
                        }`}
                      >
                        <RadioGroupItem value="uang" id="deposit-type-uang" />
                        <Banknote className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Uang</span>
                      </Label>
                      <Label
                        htmlFor="deposit-type-identitas"
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                          depositType === "identitas" 
                            ? "bg-primary/10 border-primary shadow-sm" 
                            : "hover:bg-muted border-border"
                        }`}
                      >
                        <RadioGroupItem value="identitas" id="deposit-type-identitas" />
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Identitas</span>
                      </Label>
                    </RadioGroup>
                  </div>

                  {/* Money Deposit Fields */}
                  {depositType === "uang" && (
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount">Nominal Deposit (Rp)</Label>
                      <Input
                        id="deposit-amount"
                        placeholder="Contoh: 100.000"
                        value={depositAmount}
                        onChange={(e) => {
                          const number = e.target.value.replace(/\D/g, "");
                          const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          setDepositAmount(formatted);
                        }}
                        className="font-medium"
                      />
                    </div>
                  )}

                  {/* Identity Deposit Fields */}
                  {depositType === "identitas" && (
                    <div className="space-y-2">
                      <Label>Jenis Identitas</Label>
                      <RadioGroup
                        value={depositIdentityType}
                        onValueChange={setDepositIdentityType}
                        className="grid grid-cols-4 gap-2"
                      >
                        {["KTP", "SIM", "Paspor", "Lainnya"].map((type) => (
                          <Label
                            key={type}
                            htmlFor={`deposit-identity-${type}`}
                            className={`flex items-center justify-center gap-1 p-2 border rounded-lg cursor-pointer transition-colors text-center ${
                              depositIdentityType === type 
                                ? "bg-primary/10 border-primary" 
                                : "hover:bg-muted"
                            }`}
                          >
                            <RadioGroupItem value={type} id={`deposit-identity-${type}`} className="sr-only" />
                            <span className="text-xs font-medium">{type}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Pemilik: <strong>{formData.customer_name || "-"}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBooking ? "Update" : "Tambah"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
