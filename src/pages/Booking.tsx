import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon, Clock, Upload, CheckCircle, MapPin, Home, User, Phone, CreditCard, Loader2, AlertTriangle, Tags } from "lucide-react";
import { toast } from "sonner";
import PaymentTimer from "@/components/PaymentTimer";
import BookingSummary from "@/components/BookingSummary";

// Branch data matching stores with minimum booking hours
const BRANCHES = [
  { id: "malang", name: "Treebox Malang", searchKey: "malang", minHours: 2 },
  { id: "jember", name: "Treebox Jember", searchKey: "jember", minHours: 1 },
];


interface Room {
  id: string;
  name: string;
  store_id: string;
  category_id: string | null;
  category: string | null;
}

interface RoomVariant {
  id: string;
  room_id: string;
  variant_name: string;
  duration: number;
  price: number;
}

interface RoomCategory {
  id: string;
  name: string;
  is_active: boolean;
}

interface BookingConfirmation {
  id: string;
  branch: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  paymentMethod: string;
  customerName: string;
}

interface ExistingBooking {
  id: string;
  room_id: string;
  start_time: string;
  end_time: string;
}

export default function Booking() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [variants, setVariants] = useState<RoomVariant[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  
  // Category availability state - tracks which categories have available rooms for selected time
  const [categoryAvailability, setCategoryAvailability] = useState<Record<string, { available: boolean; count: number }>>({});
  const [isCheckingCategoryAvailability, setIsCheckingCategoryAvailability] = useState(false);
  
  // Form state
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Payment timer state
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const [paymentExpiredAt, setPaymentExpiredAt] = useState<Date | null>(null);
  const [isPaymentExpired, setIsPaymentExpired] = useState(false);

  // Fetch stores on mount
  useEffect(() => {
    fetchStores();
  }, []);

  // Fetch rooms and categories when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchRooms(selectedBranch);
      fetchCategories(selectedBranch);
      setSelectedCategory("");
      setSelectedRoom("");
      setSelectedVariant("");
      setExistingBookings([]);
      setVariants([]);
    }
  }, [selectedBranch]);

  // Fetch existing bookings when date changes
  useEffect(() => {
    if (selectedBranch && bookingDate) {
      fetchExistingBookings();
      setSelectedRoom("");
      setSelectedVariant("");
      setStartTime("");
      setEndTime("");
      setSelectedCategory("");
    }
  }, [selectedBranch, bookingDate]);

  // Check category availability when time is selected
  useEffect(() => {
    if (bookingDate && startTime && endTime && calculateDuration() > 0) {
      checkCategoryAvailability();
    } else {
      setCategoryAvailability({});
    }
  }, [bookingDate, startTime, endTime, existingBookings, categories]);

  // Fetch variants when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchVariantsByCategory(selectedCategory);
      setSelectedVariant("");
    }
  }, [selectedCategory]);

  // Check for existing booking request with timer on load (from localStorage)
  useEffect(() => {
    const savedRequestId = localStorage.getItem("booking_request_id");
    const savedExpiredAt = localStorage.getItem("booking_expired_at");
    
    if (savedRequestId && savedExpiredAt) {
      const expiredAtDate = new Date(savedExpiredAt);
      if (expiredAtDate > new Date()) {
        setBookingRequestId(savedRequestId);
        setPaymentExpiredAt(expiredAtDate);
        setStep(3); // Go to payment step
      } else {
        // Clear expired data
        localStorage.removeItem("booking_request_id");
        localStorage.removeItem("booking_expired_at");
      }
    }
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true);
      
      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchCategories = async (branchId: string) => {
    try {
      const branch = BRANCHES.find(b => b.id === branchId);
      if (!branch) return;

      const store = stores.find(s => 
        s.name.toLowerCase().includes(branch.searchKey.toLowerCase())
      );
      
      if (!store) return;

      const { data, error } = await supabase
        .from("room_categories")
        .select("id, name, is_active")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchRooms = async (branchId: string) => {
    try {
      // Find the store that matches the branch
      const branch = BRANCHES.find(b => b.id === branchId);
      if (!branch) return;

      const store = stores.find(s => 
        s.name.toLowerCase().includes(branch.searchKey.toLowerCase())
      );
      
      if (!store) return;

      const { data, error } = await supabase
        .from("rooms")
        .select("*, room_categories(name)")
        .eq("store_id", store.id)
        .eq("status", "Aktif");

      if (error) throw error;
      
      // Transform data to include category name
      const roomsWithCategory = (data || []).map(room => ({
        ...room,
        category: room.room_categories?.name || room.category || "Regular"
      }));
      
      setRooms(roomsWithCategory);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchVariants = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from("room_variants")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_active", true)
        .order("duration");

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error("Error fetching variants:", error);
    }
  };

  // Fetch variants by category - get variants from all rooms in the category
  const fetchVariantsByCategory = async (categoryId: string) => {
    try {
      const store = getSelectedStore();
      if (!store) return;

      // First get all rooms in this category
      const { data: categoryRooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id")
        .eq("store_id", store.id)
        .eq("category_id", categoryId)
        .eq("status", "Aktif");

      if (roomsError) throw roomsError;

      if (!categoryRooms || categoryRooms.length === 0) {
        setVariants([]);
        return;
      }

      const roomIds = categoryRooms.map(r => r.id);

      // Get unique variants from these rooms (by variant_name to avoid duplicates)
      const { data: variantsData, error: variantsError } = await supabase
        .from("room_variants")
        .select("*")
        .in("room_id", roomIds)
        .eq("is_active", true)
        .order("price");

      if (variantsError) throw variantsError;

      // Get unique variants by name (take the first one of each name)
      const uniqueVariants: RoomVariant[] = [];
      const seenNames = new Set<string>();
      
      for (const variant of variantsData || []) {
        if (!seenNames.has(variant.variant_name)) {
          seenNames.add(variant.variant_name);
          uniqueVariants.push(variant);
        }
      }

      setVariants(uniqueVariants);
    } catch (error) {
      console.error("Error fetching variants by category:", error);
    }
  };

  const fetchExistingBookings = async () => {
    setIsCheckingAvailability(true);
    try {
      const store = getSelectedStore();
      if (!store || !bookingDate) return;

      const dateStr = format(bookingDate, "yyyy-MM-dd");
      
      // Fetch from bookings table (confirmed bookings)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, room_id, start_time, end_time")
        .eq("store_id", store.id)
        .eq("date", dateStr)
        .in("status", ["BO", "CI"]); // Only booked and checked-in

      if (bookingsError) throw bookingsError;

      // Also fetch pending booking requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("booking_requests")
        .select("id, room_id, start_time, end_time")
        .eq("store_id", store.id)
        .eq("booking_date", dateStr)
        .in("status", ["pending", "confirmed", "check-in"]);

      if (requestsError) throw requestsError;

      const allBookings: ExistingBooking[] = [
        ...(bookingsData || []).map(b => ({
          id: b.id,
          room_id: b.room_id,
          start_time: b.start_time,
          end_time: b.end_time
        })),
        ...(requestsData || []).map(r => ({
          id: r.id,
          room_id: r.room_id || "", // room_id can be null for requests
          start_time: r.start_time,
          end_time: r.end_time
        }))
      ];

      setExistingBookings(allBookings);
    } catch (error) {
      console.error("Error fetching existing bookings:", error);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Get minimum booking hours for selected branch
  const getMinHours = () => {
    const branch = BRANCHES.find(b => b.id === selectedBranch);
    return branch?.minHours || 1;
  };


  // Check availability for all categories based on selected time
  const checkCategoryAvailability = async () => {
    if (!bookingDate || !startTime || !endTime) {
      setCategoryAvailability({});
      return;
    }

    const duration = calculateDuration();
    if (duration <= 0) {
      setCategoryAvailability({});
      return;
    }

    setIsCheckingCategoryAvailability(true);
    try {
      const store = getSelectedStore();
      if (!store) return;

      const dateStr = format(bookingDate, "yyyy-MM-dd");

      // Get existing bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("room_id, start_time, end_time")
        .eq("store_id", store.id)
        .eq("date", dateStr)
        .in("status", ["BO", "CI"]);

      if (bookingsError) throw bookingsError;

      // Get existing booking requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("booking_requests")
        .select("room_id, start_time, end_time")
        .eq("store_id", store.id)
        .eq("booking_date", dateStr)
        .in("status", ["pending", "confirmed", "check-in"]);

      if (requestsError) throw requestsError;

      const allBookings = [
        ...(bookingsData || []),
        ...(requestsData || [])
      ];

      // Calculate time in minutes for overlap detection
      const [sH, sM] = startTime.split(":").map(Number);
      const [eH, eM] = endTime.split(":").map(Number);
      let requestStartMinutes = sH * 60 + (sM || 0);
      let requestEndMinutes = eH * 60 + (eM || 0);
      
      // Handle overnight
      if (requestEndMinutes <= requestStartMinutes) {
        requestEndMinutes += 24 * 60;
      }

      const availability: Record<string, { available: boolean; count: number }> = {};

      // Check each category
      for (const category of categories) {
        // Get all rooms in this category
        const { data: categoryRooms, error: roomsError } = await supabase
          .from("rooms")
          .select("id, name")
          .eq("store_id", store.id)
          .eq("category_id", category.id)
          .eq("status", "Aktif");

        if (roomsError) {
          console.error("Error fetching rooms for category:", roomsError);
          continue;
        }

        if (!categoryRooms || categoryRooms.length === 0) {
          availability[category.id] = { available: false, count: 0 };
          continue;
        }

        let availableCount = 0;

        for (const room of categoryRooms) {
          const roomBookings = allBookings.filter(b => b.room_id === room.id);
          let roomIsAvailable = true;

          for (const booking of roomBookings) {
            const [bStartHour, bStartMin] = booking.start_time.split(":").map(Number);
            const [bEndHour, bEndMin] = booking.end_time.split(":").map(Number);
            let bookingStartMinutes = bStartHour * 60 + (bStartMin || 0);
            let bookingEndMinutes = bEndHour * 60 + (bEndMin || 0);
            
            // Handle overnight bookings
            if (bookingEndMinutes <= bookingStartMinutes) {
              bookingEndMinutes += 24 * 60;
            }

            // Check for overlap
            const hasOverlap = !(requestEndMinutes <= bookingStartMinutes || requestStartMinutes >= bookingEndMinutes);
            
            if (hasOverlap) {
              roomIsAvailable = false;
              break;
            }
          }

          if (roomIsAvailable) {
            availableCount++;
          }
        }

        availability[category.id] = { 
          available: availableCount > 0, 
          count: availableCount 
        };
      }

      setCategoryAvailability(availability);
    } catch (error) {
      console.error("Error checking category availability:", error);
      setCategoryAvailability({});
    } finally {
      setIsCheckingCategoryAvailability(false);
    }
  };

  const getSelectedStore = () => {
    const branch = BRANCHES.find(b => b.id === selectedBranch);
    if (!branch) return null;
    return stores.find(s => 
      s.name.toLowerCase().includes(branch.searchKey.toLowerCase())
    );
  };

  const getSelectedRoomData = () => {
    return rooms.find(r => r.id === selectedRoom);
  };

  const getSelectedVariantData = () => {
    return variants.find(v => v.id === selectedVariant);
  };

  // Check if a room is available for the selected time slot
  const isRoomAvailable = (roomId: string): boolean => {
    if (!startTime || !endTime) return true;
    
    const [startHour] = startTime.split(":").map(Number);
    const [endHour] = endTime.split(":").map(Number);
    
    // Check for overlapping bookings
    const roomBookings = existingBookings.filter(b => b.room_id === roomId);
    
    for (const booking of roomBookings) {
      const [bookingStartHour] = booking.start_time.split(":").map(Number);
      const [bookingEndHour] = booking.end_time.split(":").map(Number);
      
      // Check for overlap: NOT (new_end <= existing_start OR new_start >= existing_end)
      const hasOverlap = !(endHour <= bookingStartHour || startHour >= bookingEndHour);
      if (hasOverlap) return false;
    }
    
    return true;
  };

  const calculateDuration = () => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let startMinutes = startHour * 60 + (startMin || 0);
    let endMinutes = endHour * 60 + (endMin || 0);
    
    // Handle overnight booking (e.g., 23:00 to 01:00)
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }
    
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  // Check if duration meets minimum requirement
  const isDurationValid = () => {
    const duration = calculateDuration();
    const minHours = getMinHours();
    return duration >= minHours;
  };

  const calculateTotalPrice = () => {
    const variant = getSelectedVariantData();
    if (!variant) return 0;
    
    // Calculate price based on variant price * duration
    const duration = calculateDuration();
    // Variant price is per session (based on variant duration), so calculate accordingly
    const sessions = Math.ceil(duration / variant.duration);
    return variant.price * sessions;
  };
  
  const getSelectedCategoryData = () => {
    return categories.find(c => c.id === selectedCategory);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      setPaymentProof(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPaymentProof = async (): Promise<string | null> => {
    if (!paymentProof) return null;
    
    setIsUploading(true);
    try {
      const fileExt = paymentProof.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, paymentProof);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Gagal mengupload bukti pembayaran");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!selectedBranch) {
      toast.error("Silakan pilih cabang");
      return false;
    }
    if (!selectedCategory) {
      toast.error("Silakan pilih kategori ruangan");
      return false;
    }
    if (!selectedVariant) {
      toast.error("Silakan pilih mode/varian");
      return false;
    }
    if (!bookingDate) {
      toast.error("Silakan pilih tanggal");
      return false;
    }
    if (!startTime) {
      toast.error("Silakan pilih jam mulai");
      return false;
    }
    if (!endTime) {
      toast.error("Silakan pilih jam selesai");
      return false;
    }
    if (calculateDuration() <= 0) {
      toast.error("Jam selesai harus setelah jam mulai");
      return false;
    }
    const minHours = getMinHours();
    if (calculateDuration() < minHours) {
      toast.error(`Minimal booking ${minHours} jam untuk cabang ini`);
      return false;
    }
    if (!customerName.trim()) {
      toast.error("Silakan isi nama");
      return false;
    }
    if (!customerPhone.trim()) {
      toast.error("Silakan isi nomor WhatsApp");
      return false;
    }
    if (!paymentMethod) {
      toast.error("Silakan pilih metode pembayaran");
      return false;
    }
    if ((paymentMethod === "Transfer" || paymentMethod === "QRIS") && !paymentProof) {
      toast.error("Silakan upload bukti pembayaran");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const store = getSelectedStore();
      const category = getSelectedCategoryData();
      const variant = getSelectedVariantData();
      
      if (!store || !category || !variant) {
        toast.error("Data tidak valid");
        return;
      }

      // Upload payment proof if exists
      let paymentProofUrl: string | null = null;
      if (paymentProof) {
        paymentProofUrl = await uploadPaymentProof();
        if ((paymentMethod === "Transfer" || paymentMethod === "QRIS") && !paymentProofUrl) {
          return; // Upload failed
        }
      }

      const duration = calculateDuration();
      const totalPrice = calculateTotalPrice();

      // Insert booking request with category and variant price (room_id will be assigned by admin)
      const { data: bookingRequest, error } = await supabase
        .from("booking_requests")
        .insert({
          store_id: store.id,
          room_id: null, // Will be assigned by admin when processing the request
          room_name: `${category.name} - ${variant.variant_name}`, // Category + variant info
          room_price: variant.price, // Variant price per session
          category_id: category.id,
          category_name: category.name,
          booking_date: format(bookingDate!, "yyyy-MM-dd"),
          start_time: startTime,
          end_time: endTime,
          duration: duration,
          total_price: totalPrice, // Calculated from variant price
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          payment_method: paymentMethod,
          payment_proof_url: paymentProofUrl,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Set confirmation
      setConfirmation({
        id: bookingRequest.id,
        branch: BRANCHES.find(b => b.id === selectedBranch)?.name || "",
        room: `${category.name} - ${variant.variant_name}`,
        date: format(bookingDate!, "EEEE, d MMMM yyyy", { locale: idLocale }),
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        totalPrice: totalPrice,
        paymentMethod: paymentMethod,
        customerName: customerName,
      });

      // Send notification to admins (fire and forget - don't block the user flow)
      try {
        const notificationData = {
          bookingRequestId: bookingRequest.id,
          storeId: store.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          categoryName: category.name,
          bookingDate: format(bookingDate!, "d MMMM yyyy", { locale: idLocale }),
          startTime: startTime,
          endTime: endTime,
          totalPrice: totalPrice,
          paymentMethod: paymentMethod,
        };
        
        supabase.functions.invoke("send-booking-notification", {
          body: notificationData,
        }).then(response => {
          console.log("Notification sent:", response);
        }).catch(notifError => {
          console.error("Failed to send notification:", notifError);
        });
      } catch (notifError) {
        console.error("Error sending notification:", notifError);
        // Don't block the user flow if notification fails
      }

      setStep(4); // Go to confirmation step
      toast.success("Booking berhasil dibuat!");
    } catch (error: any) {
      console.error("Error creating booking:", error);
      toast.error("Gagal membuat booking: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const generateStartTimeOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    const isToday = bookingDate && 
      bookingDate.getDate() === now.getDate() &&
      bookingDate.getMonth() === now.getMonth() &&
      bookingDate.getFullYear() === now.getFullYear();
    
    const currentHour = now.getHours();
    
    // Generate 09:00 to 23:00
    for (let hour = 9; hour <= 23; hour++) {
      if (isToday && hour <= currentHour) continue;
      const time = `${hour.toString().padStart(2, "0")}:00`;
      options.push(time);
    }
    
    // Generate 00:00 to 03:00 (late night / early morning)
    for (let hour = 0; hour <= 3; hour++) {
      // For today, these hours have already passed if current time is after them
      // But if it's today and past midnight, don't show early hours that passed
      if (isToday && currentHour >= hour && currentHour < 9) continue;
      const time = `${hour.toString().padStart(2, "0")}:00`;
      options.push(time);
    }
    
    return options;
  };

  const generateEndTimeOptions = (): string[] => {
    const options: string[] = [];
    if (!startTime) return options;
    
    const startHour = parseInt(startTime.split(":")[0], 10);
    const minHours = getMinHours();
    const minEndHour = startHour + minHours;
    
    // For start times 09:00-23:00, end time can go up to 05:00
    // For start times 00:00-03:00, end time can go up to 05:00
    
    if (startHour >= 9) {
      // Start is in day hours (09:00-23:00)
      // End times: minEndHour to 23:00, then 00:00 to 05:00
      for (let hour = minEndHour; hour <= 23; hour++) {
        options.push(`${hour.toString().padStart(2, "0")}:00`);
      }
      // Add early morning hours (overnight)
      for (let hour = 0; hour <= 5; hour++) {
        options.push(`${hour.toString().padStart(2, "0")}:00`);
      }
    } else {
      // Start is in early morning hours (00:00-03:00)
      // End times: minEndHour to 05:00
      for (let hour = minEndHour; hour <= 5; hour++) {
        options.push(`${hour.toString().padStart(2, "0")}:00`);
      }
    }
    
    return options;
  };

  // Auto-set minimum end time when start time changes
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    
    const startHour = parseInt(value.split(":")[0], 10);
    const minHours = getMinHours();
    let minEndHour = startHour + minHours;
    
    // Handle overflow past midnight
    if (minEndHour > 23 && startHour >= 9) {
      minEndHour = minEndHour - 24; // e.g., 24 becomes 0, 25 becomes 1
    }
    
    const newEndTime = `${minEndHour.toString().padStart(2, "0")}:00`;
    setEndTime(newEndTime);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Confirmation Page
  if (step === 4 && confirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
        <div className="max-w-lg mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700">Booking Berhasil!</CardTitle>
              <CardDescription>
                Terima kasih, {confirmation.customerName}. Booking Anda sedang diproses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cabang</span>
                  <span className="font-medium">{confirmation.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruangan</span>
                  <span className="font-medium">{confirmation.room}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span className="font-medium">{confirmation.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu</span>
                  <span className="font-medium">{confirmation.startTime} - {confirmation.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Durasi</span>
                  <span className="font-medium">{confirmation.duration} jam</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode Bayar</span>
                  <span className="font-medium">{confirmation.paymentMethod}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary text-lg">{formatCurrency(confirmation.totalPrice)}</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Catatan:</strong> Status booking Anda adalah <strong>Pending</strong>. 
                  Admin akan segera mengkonfirmasi booking Anda. Silakan tunggu konfirmasi via WhatsApp.
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={() => window.location.reload()}
              >
                Buat Booking Baru
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Booking Treebox</h1>
          <p className="text-muted-foreground">Pesan ruangan dengan mudah dan cepat</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step >= s 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={cn(
                    "w-12 h-1 mx-1",
                    step > s ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>
              {step === 1 && "Pilih Cabang & Tanggal"}
              {step === 2 && "Pilih Kategori & Mode"}
              {step === 3 && "Data & Pembayaran"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Pilih cabang dan tanggal booking"}
              {step === 2 && "Pilih kategori ruangan dan mode permainan"}
              {step === 3 && "Lengkapi data diri dan metode pembayaran"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Branch & Date Selection */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Pilih Cabang
                  </Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih cabang Treebox" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBranch && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Tanggal Booking
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !bookingDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bookingDate ? format(bookingDate, "PPP", { locale: idLocale }) : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={bookingDate}
                          onSelect={(date) => {
                            setBookingDate(date);
                            // Reset time selection when date changes
                            setStartTime("");
                            setEndTime("");
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={() => setStep(2)}
                  disabled={!selectedBranch || !bookingDate}
                >
                  Lanjutkan
                </Button>
              </>
            )}

            {/* Step 2: Time & Room Selection */}
            {step === 2 && (
              <>
                {/* Summary from Step 1 */}
                <BookingSummary
                  branch={BRANCHES.find(b => b.id === selectedBranch)?.name}
                  date={bookingDate ? format(bookingDate, "EEEE, d MMMM yyyy", { locale: idLocale }) : undefined}
                  variant="compact"
                />

                {/* Helper text for minimum booking */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    ℹ️ Minimal booking <strong>{getMinHours()} jam</strong> untuk cabang {BRANCHES.find(b => b.id === selectedBranch)?.name}
                  </p>
                </div>

                {/* Time Selection FIRST */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Jam Mulai
                    </Label>
                    <Select 
                      value={startTime} 
                      onValueChange={handleStartTimeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jam" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateStartTimeOptions().map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Jam Selesai
                    </Label>
                    <Select 
                      value={endTime} 
                      onValueChange={(value) => {
                        setEndTime(value);
                        setSelectedCategory("");
                        setSelectedVariant("");
                      }} 
                      disabled={!startTime}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={startTime ? "Pilih jam" : "Pilih jam mulai dulu"} />
                      </SelectTrigger>
                      <SelectContent>
                        {generateEndTimeOptions().map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Duration Warning */}
                {startTime && endTime && !isDurationValid() && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Durasi minimal <strong>{getMinHours()} jam</strong>. Durasi saat ini: {calculateDuration()} jam
                    </p>
                  </div>
                )}

                {/* Category Selection - Disabled until time is selected */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Pilih Kategori Ruangan
                  </Label>
                  
                  {(!startTime || !endTime || calculateDuration() <= 0) ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Pilih jam terlebih dahulu untuk melihat ketersediaan ruangan
                      </p>
                      <div className="p-4 border rounded-lg bg-muted/30 text-center opacity-50">
                        <p className="text-muted-foreground">Pilih jam mulai dan jam selesai terlebih dahulu</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Ketersediaan ruangan ditentukan berdasarkan jam yang dipilih
                      </p>
                      {isCheckingCategoryAvailability ? (
                        <div className="p-4 border rounded-lg bg-muted/30 text-center">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground mb-2" />
                          <p className="text-muted-foreground text-sm">Mengecek ketersediaan ruangan...</p>
                        </div>
                      ) : categories.length > 0 ? (
                        <div className="grid gap-2">
                          {categories.map((cat) => {
                            const availability = categoryAvailability[cat.id];
                            const isAvailable = availability?.available ?? true;
                            const roomCount = availability?.count ?? 0;
                            
                            return (
                              <div
                                key={cat.id}
                                onClick={() => {
                                  if (isAvailable) {
                                    setSelectedCategory(cat.id);
                                    setSelectedVariant("");
                                  }
                                }}
                                className={cn(
                                  "p-4 border rounded-lg transition-colors",
                                  !isAvailable && "opacity-50 cursor-not-allowed bg-muted/30",
                                  isAvailable && selectedCategory !== cat.id && "cursor-pointer hover:border-primary/50",
                                  selectedCategory === cat.id && "border-primary bg-primary/5 cursor-pointer"
                                )}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{cat.name}</p>
                                    <span className={cn(
                                      "text-xs px-2 py-0.5 rounded-full",
                                      isAvailable 
                                        ? "bg-green-100 text-green-700" 
                                        : "bg-red-100 text-red-700"
                                    )}>
                                      {isAvailable ? `Tersedia (${roomCount})` : "Full Book"}
                                    </span>
                                  </div>
                                  {selectedCategory === cat.id && (
                                    <span className="text-sm text-primary font-medium">
                                      ✓ Terpilih
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 border rounded-lg bg-muted/30 text-center">
                          <p className="text-muted-foreground">Tidak ada kategori tersedia</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Variant/Mode Selection - Show after category is selected */}
                {selectedCategory && startTime && endTime && calculateDuration() > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Pilih Mode/Varian
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Pilih mode permainan yang Anda inginkan
                    </p>
                    {variants.length > 0 ? (
                      <div className="grid gap-2">
                        {variants.map((variant) => (
                          <div
                            key={variant.id}
                            onClick={() => setSelectedVariant(variant.id)}
                            className={cn(
                              "p-4 border rounded-lg cursor-pointer transition-colors",
                              selectedVariant === variant.id
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{variant.variant_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {variant.duration} jam per sesi
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary">
                                  Rp {variant.price.toLocaleString("id-ID")}
                                </p>
                                <p className="text-xs text-muted-foreground">per sesi</p>
                              </div>
                            </div>
                            {selectedVariant === variant.id && (
                              <span className="text-sm text-primary font-medium mt-2 block">
                                ✓ Terpilih
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border rounded-lg bg-muted/30 text-center">
                        <p className="text-muted-foreground">Tidak ada varian tersedia untuk kategori ini</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                {selectedCategory && selectedVariant && startTime && endTime && calculateDuration() > 0 && isDurationValid() && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Kategori</span>
                      <span className="font-medium">{getSelectedCategoryData()?.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Mode</span>
                      <span className="font-medium">{getSelectedVariantData()?.variant_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Waktu</span>
                      <span className="font-medium">{startTime} - {endTime} ({calculateDuration()} jam)</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Harga</span>
                        <span className="font-bold text-primary text-lg">
                          Rp {calculateTotalPrice().toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Ruangan spesifik akan ditentukan oleh admin
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Kembali
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={() => setStep(3)}
                    disabled={
                      !startTime || 
                      !endTime || 
                      calculateDuration() <= 0 ||
                      !isDurationValid() ||
                      !selectedCategory || 
                      !selectedVariant ||
                      isCheckingCategoryAvailability ||
                      !categoryAvailability[selectedCategory]?.available
                    }
                  >
                    {isCheckingCategoryAvailability ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengecek...
                      </>
                    ) : (
                      "Lanjutkan"
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Customer Data & Payment */}
            {step === 3 && (
              <>
                {/* Full Summary from Steps 1 & 2 */}
                <BookingSummary
                  branch={BRANCHES.find(b => b.id === selectedBranch)?.name}
                  date={bookingDate ? format(bookingDate, "EEEE, d MMMM yyyy", { locale: idLocale }) : undefined}
                  startTime={startTime}
                  endTime={endTime}
                  variant="full"
                />
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nama Lengkap
                  </Label>
                  <Input
                    placeholder="Masukkan nama Anda"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Nomor WhatsApp
                  </Label>
                  <Input
                    placeholder="Contoh: 08123456789"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Metode Pembayaran
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Bayar di Tempat (Cash)</SelectItem>
                      <SelectItem value="Transfer">Transfer Bank</SelectItem>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(paymentMethod === "Transfer" || paymentMethod === "QRIS") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Bukti Pembayaran <span className="text-destructive">*</span>
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {paymentProofPreview ? (
                        <div className="space-y-2">
                          <img 
                            src={paymentProofPreview} 
                            alt="Preview" 
                            className="max-h-48 mx-auto rounded-lg"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setPaymentProof(null);
                              setPaymentProofPreview("");
                            }}
                          >
                            Ganti Gambar
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <div className="py-4">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Klik untuk upload bukti transfer
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PNG, JPG maksimal 5MB
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium mb-3">Ringkasan Booking</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cabang</span>
                      <span>{BRANCHES.find(b => b.id === selectedBranch)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ruangan</span>
                      <span>{getSelectedRoomData()?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tanggal</span>
                      <span>{bookingDate && format(bookingDate, "d MMM yyyy", { locale: idLocale })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waktu</span>
                      <span>{startTime} - {endTime} ({calculateDuration()} jam)</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(calculateTotalPrice())}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    Kembali
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={handleSubmit}
                    disabled={isLoading || isUploading}
                  >
                    {(isLoading || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUploading ? "Mengupload..." : isLoading ? "Memproses..." : "Konfirmasi Booking"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2024 Treebox. All rights reserved.
        </p>
      </div>
    </div>
  );
}