import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  LogIn, 
  LogOut, 
  RefreshCw,
  Search,
  Image,
  ExternalLink,
  User,
  Phone,
  Calendar,
  CreditCard,
  Loader2,
  CheckCheck,
  Pencil,
  Trash2,
  Copy,
  Home,
  Tags,
  MessageCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logActivity } from "@/utils/activityLogger";
import { openWhatsAppConfirmation } from "@/utils/whatsappLinks";

interface BookingRequest {
  id: string;
  bid: string | null;
  store_id: string;
  room_id: string;
  room_name: string;
  room_price: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration: number;
  total_price: number;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  payment_method: string;
  payment_proof_url: string | null;
  status: string;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  category_id: string | null;
  category_name: string | null;
  confirmation_token: string | null;
}

interface Room {
  id: string;
  name: string;
  category_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  "check-in": "bg-green-100 text-green-800 border-green-300",
  "check-out": "bg-gray-100 text-gray-800 border-gray-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Dikonfirmasi",
  "check-in": "Check-in",
  "check-out": "Check-out",
  cancelled: "Dibatalkan",
};

// Status Dropdown Component
interface StatusDropdownProps {
  request: BookingRequest;
  onStatusChange: (requestId: string, newStatus: string) => Promise<void>;
  isUpdating: boolean;
}

function StatusDropdown({ request, onStatusChange, isUpdating }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [localUpdating, setLocalUpdating] = useState(false);

  const availableStatuses = ["confirmed", "check-in", "check-out"];

  // Don't show dropdown for cancelled status
  if (request.status === "cancelled") {
    return (
      <Badge className={STATUS_COLORS[request.status] || "bg-gray-100"}>
        {STATUS_LABELS[request.status] || request.status}
      </Badge>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === request.status || isUpdating || localUpdating) return;
    
    setLocalUpdating(true);
    setOpen(false);
    try {
      await onStatusChange(request.id, newStatus);
    } finally {
      setLocalUpdating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="focus:outline-none"
          disabled={isUpdating || localUpdating}
        >
          <Badge 
            className={`${STATUS_COLORS[request.status] || "bg-gray-100"} cursor-pointer hover:opacity-80 transition-opacity ${(isUpdating || localUpdating) ? 'opacity-50' : ''}`}
          >
            {localUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {STATUS_LABELS[request.status] || request.status}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        <div className="space-y-1">
          {availableStatuses.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={status === request.status}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                status === request.status
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'hover:bg-muted cursor-pointer'
              }`}
            >
              <Badge className={`${STATUS_COLORS[status]} text-xs`}>
                {STATUS_LABELS[status]}
              </Badge>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function BookingRequestsManagement() {
  const { currentStore } = useStore();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRoomSelectOpen, setIsRoomSelectOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{requestId: string, newStatus: string} | null>(null);
  const [selectedRoomForConfirm, setSelectedRoomForConfirm] = useState<string>("");
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    room_id: "",
    room_name: "",
    booking_date: "",
    start_time: "",
    end_time: "",
    duration: 0,
    total_price: 0,
    payment_method: "",
    admin_notes: "",
    status: "",
    category_id: "",
  });
  const [processorName, setProcessorName] = useState<string | null>(null);
  const [signedPaymentProofUrl, setSignedPaymentProofUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentStore) {
      fetchRequests();
      fetchRooms();

      // Subscribe to real-time booking request updates
      const channel = supabase
        .channel('booking-requests-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'booking_requests',
            filter: `store_id=eq.${currentStore.id}`,
          },
          (payload) => {
            console.log('New booking request received:', payload);
            // Add new request to the list
            setRequests((prev) => [payload.new as BookingRequest, ...prev]);
            // Show toast notification
            const newRequest = payload.new as BookingRequest;
            toast.info(
              `Booking baru dari ${newRequest.customer_name}`,
              {
                description: `${newRequest.category_name || 'Room'} - ${newRequest.booking_date}`,
                duration: 10000,
                action: {
                  label: "Lihat",
                  onClick: () => {
                    setSelectedRequest(newRequest);
                    setIsDetailOpen(true);
                  },
                },
              }
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'booking_requests',
            filter: `store_id=eq.${currentStore.id}`,
          },
          (payload) => {
            console.log('Booking request updated:', payload);
            // Update the request in the list
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id ? (payload.new as BookingRequest) : req
              )
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'booking_requests',
            filter: `store_id=eq.${currentStore.id}`,
          },
          (payload) => {
            console.log('Booking request deleted:', payload);
            // Remove the request from the list
            setRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentStore]);

  const fetchRooms = async () => {
    if (!currentStore) return;
    
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, category_id")
        .eq("store_id", currentStore.id)
        .eq("status", "Aktif")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchRequests = async () => {
    if (!currentStore) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching booking requests:", error);
      toast.error("Gagal memuat data booking request");
    } finally {
      setIsLoading(false);
    }
  };

  const createBookingFromRequest = async (requestId: string, userId: string, status: string = 'CI') => {
    // Call the database function that bypasses RLS
    const { data, error } = await supabase.rpc('create_booking_from_request', {
      p_request_id: requestId,
      p_user_id: userId,
      p_status: status,
    });

    if (error) throw error;
    return data;
  };

  const updateBookingStatusFromRequest = async (requestId: string, userId: string, newStatus: string) => {
    // Call the database function to update booking status
    const { error } = await supabase.rpc('update_booking_status_from_request', {
      p_request_id: requestId,
      p_user_id: userId,
      p_new_status: newStatus,
    });

    if (error) throw error;
  };

  const checkoutBookingFromRequest = async (requestId: string, userId: string) => {
    // Call the database function that bypasses RLS
    const { error } = await supabase.rpc('checkout_booking_by_request_id', {
      p_request_id: requestId,
      p_user_id: userId,
    });

    if (error) throw error;
  };

  // Fetch available rooms for a specific booking request time slot
  const fetchAvailableRooms = async (request: BookingRequest) => {
    if (!currentStore) return [];
    
    setIsFetchingRooms(true);
    try {
      // Get all rooms in the same category
      const categoryRooms = rooms.filter(r => 
        request.category_id ? r.category_id === request.category_id : true
      );

      if (categoryRooms.length === 0) {
        return [];
      }

      // Fetch existing bookings for the same date and overlapping time
      const { data: existingBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("room_id, start_time, end_time")
        .eq("store_id", currentStore.id)
        .eq("date", request.booking_date)
        .in("status", ["BO", "CI"]);

      if (bookingsError) throw bookingsError;

      // Fetch existing booking requests for the same date (pending or confirmed)
      const { data: existingRequests, error: requestsError } = await supabase
        .from("booking_requests")
        .select("room_id, start_time, end_time")
        .eq("store_id", currentStore.id)
        .eq("booking_date", request.booking_date)
        .in("status", ["pending", "confirmed", "check-in"])
        .neq("id", request.id); // Exclude current request

      if (requestsError) throw requestsError;

      // Combine all bookings
      const allBookings = [
        ...(existingBookings || []),
        ...(existingRequests || []).filter(r => r.room_id) // Only include requests with assigned rooms
      ];

      // Parse request time - handle format with or without seconds
      const parseTime = (timeStr: string) => {
        const parts = timeStr.split(":").map(Number);
        return { hour: parts[0], minute: parts[1] || 0 };
      };

      const reqStart = parseTime(request.start_time);
      const reqEnd = parseTime(request.end_time);
      const reqStartMinutes = reqStart.hour * 60 + reqStart.minute;
      const reqEndMinutes = reqEnd.hour * 60 + reqEnd.minute;

      // Filter available rooms
      const available = categoryRooms.filter(room => {
        const roomBookings = allBookings.filter(b => b.room_id === room.id);
        
        for (const booking of roomBookings) {
          const bookStart = parseTime(booking.start_time);
          const bookEnd = parseTime(booking.end_time);
          const bookStartMinutes = bookStart.hour * 60 + bookStart.minute;
          const bookEndMinutes = bookEnd.hour * 60 + bookEnd.minute;
          
          // Check for overlap: true if ranges overlap
          // Two ranges [A,B] and [C,D] overlap if A < D AND C < B
          const hasOverlap = reqStartMinutes < bookEndMinutes && bookStartMinutes < reqEndMinutes;
          if (hasOverlap) return false;
        }
        
        return true;
      });

      setAvailableRooms(available);
      return available;
    } catch (error) {
      console.error("Error fetching available rooms:", error);
      return [];
    } finally {
      setIsFetchingRooms(false);
    }
  };

  // Handle status change with room selection dialog
  const handleStatusChangeWithRoomCheck = async (requestId: string, newStatus: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    // If changing to confirmed or check-in and no room assigned, show room selection dialog
    if ((newStatus === "confirmed" || (newStatus === "check-in" && request.status === "pending")) && !request.room_id) {
      setPendingStatusChange({ requestId, newStatus });
      setSelectedRoomForConfirm("");
      await fetchAvailableRooms(request);
      setSelectedRequest(request);
      setIsRoomSelectOpen(true);
      return;
    }

    // Otherwise proceed with normal status update
    await updateStatus(requestId, newStatus);
  };

  // Confirm room selection and proceed with status change
  const confirmRoomSelection = async () => {
    if (!pendingStatusChange || !selectedRoomForConfirm || !selectedRequest) {
      toast.error("Silakan pilih ruangan terlebih dahulu");
      return;
    }

    setIsUpdating(true);
    try {
      // First update the room_id in booking request
      const selectedRoom = rooms.find(r => r.id === selectedRoomForConfirm);
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({
          room_id: selectedRoomForConfirm,
          room_name: selectedRoom?.name || selectedRequest.room_name,
        })
        .eq("id", pendingStatusChange.requestId);

      if (updateError) throw updateError;

      // Update local state
      setRequests(prev => prev.map(r => 
        r.id === pendingStatusChange.requestId 
          ? { ...r, room_id: selectedRoomForConfirm, room_name: selectedRoom?.name || r.room_name }
          : r
      ));

      // Close dialog
      setIsRoomSelectOpen(false);
      
      // Now proceed with status update
      await updateStatus(pendingStatusChange.requestId, pendingStatusChange.newStatus);
      
      setPendingStatusChange(null);
      setSelectedRoomForConfirm("");
    } catch (error: any) {
      console.error("Error updating room:", error);
      toast.error("Gagal memilih ruangan: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (requestId: string, newStatus: string) => {
    setIsUpdating(true);
    let bookingCreatedOrUpdated = false;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const request = requests.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Validate booking date - prevent processing if date has passed
      if ((newStatus === "confirmed" || newStatus === "check-in") && request.status !== "check-in") {
        const bookingDate = new Date(request.booking_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        
        if (bookingDate < today) {
          toast.error(`Tidak dapat memproses booking karena tanggal booking (${format(bookingDate, "dd MMM yyyy")}) sudah lewat.`);
          setIsUpdating(false);
          return;
        }
      }

      // Handle confirmed: create booking with BO status
      if (newStatus === "confirmed") {
        // Check if room_id is assigned - should be assigned at this point
        if (!request.room_id) {
          toast.error("Room belum dipilih. Silakan pilih ruangan terlebih dahulu.");
          setIsUpdating(false);
          return;
        }

        try {
          await createBookingFromRequest(request.id, user.id, 'BO');
          bookingCreatedOrUpdated = true;
        } catch (error: any) {
          console.error("Error creating booking from request:", error);
          if (error.message?.includes("already booked") || error.message?.includes("conflict")) {
            toast.error("Ruangan sudah dibooking pada slot waktu tersebut.");
          } else {
            toast.error("Gagal membuat booking: " + (error.message || "Unknown error"));
          }
          setIsUpdating(false);
          return;
        }

        // Log activity
        await logActivity({
          actionType: "confirm",
          entityType: "Booking Request",
          entityId: request.id,
          description: `Konfirmasi booking request: ${request.customer_name} - ${request.room_name}`,
        });

        // Dispatch event to refresh ScheduleTable
        window.dispatchEvent(new CustomEvent("booking-changed"));
      }

      // Handle check-in: update existing booking status from BO to CI
      if (newStatus === "check-in") {
        // Check if room_id is assigned when coming from pending
        if (request.status === "pending" && !request.room_id) {
          toast.error("Silakan pilih ruangan terlebih dahulu sebelum melakukan check-in.");
          setIsUpdating(false);
          return;
        }

        try {
          // If coming from pending, need to create booking first
          if (request.status === "pending") {
            await createBookingFromRequest(request.id, user.id, 'CI');
          } else {
            // Update existing booking status
            await updateBookingStatusFromRequest(request.id, user.id, 'CI');
          }
          bookingCreatedOrUpdated = true;
        } catch (error: any) {
          console.error("Error during check-in:", error);
          if (error.message?.includes("already booked") || error.message?.includes("not found") || error.message?.includes("conflict")) {
            toast.error("Gagal melakukan check-in: " + error.message);
          } else {
            toast.error("Gagal melakukan check-in: " + (error.message || "Unknown error"));
          }
          setIsUpdating(false);
          return;
        }

        // Log activity
        await logActivity({
          actionType: "check-in",
          entityType: "Booking Request",
          entityId: request.id,
          description: `Check-in booking request: ${request.customer_name} - ${request.room_name}`,
        });

        // Dispatch event to refresh ScheduleTable
        window.dispatchEvent(new CustomEvent("booking-changed"));
      }

      // Handle check-out: update booking status to CO
      if (newStatus === "check-out") {
        try {
          await updateBookingStatusFromRequest(request.id, user.id, 'CO');
          bookingCreatedOrUpdated = true;
        } catch (error: any) {
          console.error("Error during check-out:", error);
          toast.error("Gagal melakukan check-out: " + (error.message || "Unknown error"));
          setIsUpdating(false);
          return;
        }

        // Log activity
        await logActivity({
          actionType: "check-out",
          entityType: "Booking Request",
          entityId: request.id,
          description: `Check-out booking request: ${request.customer_name} - ${request.room_name}`,
        });

        // Dispatch event to refresh ScheduleTable
        window.dispatchEvent(new CustomEvent("booking-changed"));
      }

      // Only update booking request status if the booking operation succeeded
      // For confirmed, check-in, check-out: must have bookingCreatedOrUpdated = true
      if ((newStatus === "confirmed" || newStatus === "check-in" || newStatus === "check-out") && !bookingCreatedOrUpdated) {
        toast.error("Operasi database gagal. Status tidak diubah.");
        setIsUpdating(false);
        return;
      }

      // Update booking request status
      const updateData: any = {
        status: newStatus,
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      };

      if (adminNotes.trim()) {
        updateData.admin_notes = adminNotes.trim();
      }

      const { error } = await supabase
        .from("booking_requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) throw error;

      toast.success(`Status berhasil diubah ke ${STATUS_LABELS[newStatus]}`);
      fetchRequests();
      setIsDetailOpen(false);
      setAdminNotes("");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Gagal mengubah status: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      pending: "confirmed",
      confirmed: "check-in",
      "check-in": "check-out",
    };
    return flow[currentStatus] || null;
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = 
      req.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.customer_phone.includes(searchQuery) ||
      req.room_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetail = async (request: BookingRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || "");
    setSignedPaymentProofUrl(null);
    
    // Generate signed URL for payment proof if exists
    if (request.payment_proof_url) {
      try {
        // Extract file path from URL
        const urlParts = request.payment_proof_url.split('/payment-proofs/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          const { data, error } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          
          if (!error && data?.signedUrl) {
            setSignedPaymentProofUrl(data.signedUrl);
          }
        }
      } catch (error) {
        console.error('Error generating signed URL:', error);
      }
    }
    
    setIsDetailOpen(true);
  };

  const handleEditRequest = async (request: BookingRequest) => {
    setSelectedRequest(request);
    setEditForm({
      customer_name: request.customer_name,
      customer_phone: request.customer_phone,
      room_id: request.room_id,
      room_name: request.room_name,
      booking_date: request.booking_date,
      start_time: request.start_time,
      end_time: request.end_time,
      duration: request.duration,
      total_price: request.total_price,
      payment_method: request.payment_method,
      admin_notes: request.admin_notes || "",
      status: request.status,
      category_id: request.category_id || "",
    });
    
    // Fetch processor name if processed_by exists
    if (request.processed_by) {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", request.processed_by)
        .single();
      setProcessorName(data?.name || null);
    } else {
      setProcessorName(null);
    }
    
    setIsEditOpen(true);
  };

  const handleDeleteRequest = (request: BookingRequest) => {
    setSelectedRequest(request);
    setIsDeleteOpen(true);
  };

  const saveEditRequest = async () => {
    if (!selectedRequest) return;
    
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const statusChanged = editForm.status !== selectedRequest.status;
      
      // Handle status change with proper workflow
      if (statusChanged) {
        // Handle check-in status change
        if (editForm.status === "check-in" && selectedRequest.status !== "check-in") {
          try {
            await createBookingFromRequest(selectedRequest.id, user.id);
          } catch (error: any) {
            if (error.message?.includes("occupied")) {
              toast.error("Ruangan sedang digunakan. Tidak bisa melakukan check-in.");
              setIsUpdating(false);
              return;
            }
            throw error;
          }
        }
        
        // Handle check-out status change
        if (editForm.status === "check-out" && selectedRequest.status === "check-in") {
          await checkoutBookingFromRequest(selectedRequest.id, user.id);
        }
      }

      // Get selected room data
      const selectedRoom = rooms.find(r => r.id === editForm.room_id);

      const { error } = await supabase
        .from("booking_requests")
        .update({
          customer_name: editForm.customer_name.trim(),
          customer_phone: editForm.customer_phone.trim(),
          room_id: editForm.room_id,
          room_name: selectedRoom?.name || editForm.room_name.trim(),
          booking_date: editForm.booking_date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          duration: editForm.duration,
          total_price: editForm.total_price,
          payment_method: editForm.payment_method,
          admin_notes: editForm.admin_notes.trim() || null,
          status: editForm.status,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      // Log activity with status change info
      const statusChangeInfo = statusChanged 
        ? ` (status: ${STATUS_LABELS[selectedRequest.status]} → ${STATUS_LABELS[editForm.status]})`
        : "";
      
      await logActivity({
        actionType: "updated",
        entityType: "Booking Request",
        entityId: selectedRequest.id,
        description: `Edit booking request: ${editForm.customer_name}${statusChangeInfo}`,
      });

      if (statusChanged) {
        window.dispatchEvent(new CustomEvent("booking-changed"));
      }

      toast.success("Booking request berhasil diperbarui");
      setIsEditOpen(false);
      fetchRequests();
    } catch (error: any) {
      console.error("Error updating booking request:", error);
      toast.error("Gagal memperbarui booking request: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteRequest = async () => {
    if (!selectedRequest) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("booking_requests")
        .delete()
        .eq("id", selectedRequest.id);

      if (error) throw error;

      await logActivity({
        actionType: "deleted",
        entityType: "Booking Request",
        entityId: selectedRequest.id,
        description: `Hapus booking request: ${selectedRequest.customer_name}`,
      });

      toast.success("Booking request berhasil dihapus");
      setIsDeleteOpen(false);
      fetchRequests();
    } catch (error: any) {
      console.error("Error deleting booking request:", error);
      toast.error("Gagal menghapus booking request: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle sending WhatsApp confirmation message
  const handleSendWhatsApp = (request: BookingRequest) => {
    if (!request.confirmation_token || !currentStore) {
      toast.error("Token konfirmasi tidak tersedia");
      return;
    }

    openWhatsAppConfirmation({
      confirmationToken: request.confirmation_token,
      customerName: request.customer_name,
      customerPhone: request.customer_phone,
      storeName: currentStore.name,
      categoryName: request.category_name || request.room_name,
      bookingDate: request.booking_date,
      startTime: request.start_time,
      endTime: request.end_time,
      totalPrice: request.total_price,
    });
  };

  const renderActionButton = (request: BookingRequest) => {
    // Show "Sudah Check-in" badge for check-in status
    if (request.status === "check-in") {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
            <CheckCheck className="h-3 w-3" />
            Sudah Check-in
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => handleEditRequest(request)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDeleteRequest(request)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    // Show "Selesai" badge for check-out status
    if (request.status === "check-out") {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-gray-100 text-gray-800 border-gray-300 gap-1">
            <CheckCheck className="h-3 w-3" />
            Selesai
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => handleEditRequest(request)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDeleteRequest(request)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    // Show view, edit, delete, and WhatsApp buttons for other statuses
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(request)}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleSendWhatsApp(request)}
          title="Kirim konfirmasi via WhatsApp"
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleEditRequest(request)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleDeleteRequest(request)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Booking Request Pelanggan
              </CardTitle>
              <CardDescription>
                Kelola booking dari form pemesanan pelanggan
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, telepon, atau ruangan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Dikonfirmasi</SelectItem>
                <SelectItem value="check-in">Check-in</SelectItem>
                <SelectItem value="check-out">Check-out</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {["pending", "confirmed", "check-in", "check-out", "cancelled"].map((status) => (
              <Card key={status} className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {requests.filter((r) => r.status === status).length}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Table */}
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || statusFilter !== "all" 
                ? "Tidak ada booking request yang sesuai filter"
                : "Belum ada booking request"}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BID</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Ruangan / Kategori</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.bid ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">{request.bid}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => {
                                navigator.clipboard.writeText(request.bid || '');
                                toast.success("BID disalin");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{request.customer_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={request.room_name === "Belum ditentukan" ? "text-amber-600 font-medium" : ""}>
                            {request.room_name}
                          </p>
                          {request.category_name && (
                            <p className="text-xs text-muted-foreground">{request.category_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.booking_date), "d MMM yyyy", { locale: idLocale })}
                      </TableCell>
                      <TableCell>
                        {request.start_time} - {request.end_time}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(request.total_price)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{request.payment_method}</span>
                          {request.payment_proof_url && (
                            <Image className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusDropdown 
                          request={request} 
                          onStatusChange={handleStatusChangeWithRoomCheck}
                          isUpdating={isUpdating}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {renderActionButton(request)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detail Booking Request</span>
              {selectedRequest?.bid && (
                <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                  <span className="font-mono text-sm">{selectedRequest.bid}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedRequest.bid || '');
                      toast.success("BID disalin");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              Lihat detail dan kelola status booking
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Nama Pelanggan
                  </Label>
                  <p className="font-medium">{selectedRequest.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Nomor WhatsApp
                  </Label>
                  <p className="font-medium">{selectedRequest.customer_phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Home className="h-3 w-3" /> Ruangan
                  </Label>
                  <p className={`font-medium ${selectedRequest.room_name === "Belum ditentukan" ? "text-amber-600" : ""}`}>
                    {selectedRequest.room_name}
                  </p>
                </div>
                {selectedRequest.category_name && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <Tags className="h-3 w-3" /> Kategori
                    </Label>
                    <p className="font-medium">{selectedRequest.category_name}</p>
                  </div>
                )}
              </div>

              {/* Booking Date */}
              <div className="space-y-1">
                <Label className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Tanggal
                </Label>
                <p className="font-medium">
                  {format(new Date(selectedRequest.booking_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Jam Mulai</Label>
                  <p className="font-medium">{selectedRequest.start_time}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Jam Selesai</Label>
                  <p className="font-medium">{selectedRequest.end_time}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Durasi</Label>
                  <p className="font-medium">{selectedRequest.duration} jam</p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Metode Pembayaran</span>
                  </div>
                  <span className="font-medium">{selectedRequest.payment_method}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Total Harga</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(selectedRequest.total_price)}
                  </span>
                </div>
              </div>

              {/* Payment Proof */}
              {selectedRequest.payment_proof_url && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Bukti Pembayaran</Label>
                  <div className="border rounded-lg p-2">
                    {signedPaymentProofUrl ? (
                      <a
                        href={signedPaymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={signedPaymentProofUrl}
                          alt="Bukti pembayaran"
                          className="max-h-64 mx-auto rounded-lg"
                        />
                        <div className="flex items-center justify-center gap-1 mt-2 text-sm text-primary">
                          <ExternalLink className="h-4 w-4" />
                          Lihat gambar penuh
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Memuat bukti pembayaran...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Status Saat Ini</Label>
                <Badge className={`${STATUS_COLORS[selectedRequest.status]} text-base px-3 py-1`}>
                  {STATUS_LABELS[selectedRequest.status]}
                </Badge>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="adminNotes">Catatan Admin</Label>
                <Textarea
                  id="adminNotes"
                  placeholder="Tambahkan catatan (opsional)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Dibuat: {format(new Date(selectedRequest.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}</p>
                {selectedRequest.processed_at && (
                  <p>Terakhir diproses: {format(new Date(selectedRequest.processed_at), "d MMM yyyy HH:mm", { locale: idLocale })}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* WhatsApp Button */}
            {selectedRequest && selectedRequest.confirmation_token && (
              <Button
                variant="outline"
                onClick={() => handleSendWhatsApp(selectedRequest)}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Kirim via WhatsApp
              </Button>
            )}

            {selectedRequest && selectedRequest.status !== "cancelled" && selectedRequest.status !== "check-out" && selectedRequest.status !== "check-in" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => updateStatus(selectedRequest.id, "cancelled")}
                  disabled={isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <XCircle className="mr-2 h-4 w-4" />
                  Batalkan
                </Button>
                
                {getNextStatus(selectedRequest.status) && (
                  <Button
                    onClick={() => updateStatus(selectedRequest.id, getNextStatus(selectedRequest.status)!)}
                    disabled={isUpdating}
                  >
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedRequest.status === "pending" && (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Konfirmasi
                      </>
                    )}
                    {selectedRequest.status === "confirmed" && (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Check-in
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {/* Show Check-out button for check-in status */}
            {selectedRequest && selectedRequest.status === "check-in" && (
              <Button
                onClick={() => updateStatus(selectedRequest.id, "check-out")}
                disabled={isUpdating}
                variant="outline"
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <LogOut className="mr-2 h-4 w-4" />
                Check-out
              </Button>
            )}

            {/* Show completed message for check-out status */}
            {selectedRequest && selectedRequest.status === "check-out" && (
              <Badge className="bg-gray-100 text-gray-800 border-gray-300 text-base px-4 py-2">
                <CheckCheck className="mr-2 h-4 w-4" />
                Booking Selesai
              </Badge>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking Request</DialogTitle>
            <DialogDescription>
              Ubah data booking request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_customer_name">Nama Pelanggan</Label>
                <Input
                  id="edit_customer_name"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_customer_phone">No. WhatsApp</Label>
                <Input
                  id="edit_customer_phone"
                  value={editForm.customer_phone}
                  onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                />
              </div>
            </div>

            {/* Category Info */}
            {selectedRequest?.category_name && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <Label className="text-muted-foreground flex items-center gap-1">
                  <Tags className="h-3 w-3" /> Kategori yang Dipilih Customer
                </Label>
                <p className="font-medium mt-1">{selectedRequest.category_name}</p>
              </div>
            )}

            {/* Room Selection */}
            <div className="space-y-2">
              <Label htmlFor="edit_room" className="flex items-center gap-1">
                <Home className="h-3 w-3" /> Pilih Ruangan
              </Label>
              <Select
                value={editForm.room_id}
                onValueChange={(value) => {
                  const room = rooms.find(r => r.id === value);
                  setEditForm({ 
                    ...editForm, 
                    room_id: value,
                    room_name: room?.name || editForm.room_name
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ruangan" />
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .filter(room => !editForm.category_id || room.category_id === editForm.category_id)
                    .map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {editForm.room_name === "Belum ditentukan" && (
                <p className="text-xs text-amber-600">⚠️ Ruangan belum dipilih oleh admin</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_booking_date">Tanggal</Label>
                <Input
                  id="edit_booking_date"
                  type="date"
                  value={editForm.booking_date}
                  onChange={(e) => setEditForm({ ...editForm, booking_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_start_time">Jam Mulai</Label>
                <Input
                  id="edit_start_time"
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_end_time">Jam Selesai</Label>
                <Input
                  id="edit_end_time"
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_duration">Durasi (jam)</Label>
                <Input
                  id="edit_duration"
                  type="number"
                  min="1"
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_total_price">Total Harga</Label>
                <Input
                  id="edit_total_price"
                  type="number"
                  min="0"
                  value={editForm.total_price}
                  onChange={(e) => setEditForm({ ...editForm, total_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_payment_method">Metode Pembayaran</Label>
                <Select
                  value={editForm.payment_method}
                  onValueChange={(value) => setEditForm({ ...editForm, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="QRIS">QRIS</SelectItem>
                    <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_status">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Dikonfirmasi</SelectItem>
                    <SelectItem value="check-in">Check-in</SelectItem>
                    <SelectItem value="check-out">Check-out</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_admin_notes">Catatan Admin</Label>
              <Textarea
                id="edit_admin_notes"
                placeholder="Tambahkan catatan (opsional)"
                value={editForm.admin_notes}
                onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
              />
            </div>

            {/* History Tracking */}
            {selectedRequest && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <Label className="text-muted-foreground font-medium">Riwayat Proses</Label>
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Dibuat: {format(new Date(selectedRequest.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}
                  </p>
                  {selectedRequest.processed_at && (
                    <>
                      <p className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Terakhir diproses: {format(new Date(selectedRequest.processed_at), "d MMM yyyy HH:mm", { locale: idLocale })}
                      </p>
                      {processorName && (
                        <p className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Diproses oleh: <span className="font-medium">{processorName}</span>
                        </p>
                      )}
                    </>
                  )}
                  <p className="flex items-center gap-2">
                    <Badge className={`${STATUS_COLORS[selectedRequest.status]} text-xs`}>
                      Status saat ini: {STATUS_LABELS[selectedRequest.status]}
                    </Badge>
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEditRequest} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus booking request dari{" "}
              <span className="font-semibold">{selectedRequest?.customer_name}</span>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRequest}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Room Selection Dialog */}
      <Dialog open={isRoomSelectOpen} onOpenChange={(open) => {
        if (!open) {
          setIsRoomSelectOpen(false);
          setPendingStatusChange(null);
          setSelectedRoomForConfirm("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Pilih Ruangan
            </DialogTitle>
            <DialogDescription>
              Pilih ruangan yang tersedia untuk booking ini sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* Booking Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedRequest.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(selectedRequest.booking_date), "EEEE, d MMMM yyyy", { locale: idLocale })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedRequest.start_time} - {selectedRequest.end_time}</span>
                </div>
                {selectedRequest.category_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Tags className="h-4 w-4 text-muted-foreground" />
                    <span>Kategori: {selectedRequest.category_name}</span>
                  </div>
                )}
              </div>

              {/* Room Selection */}
              <div className="space-y-2">
                <Label>Ruangan Tersedia</Label>
                {isFetchingRooms ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Memeriksa ketersediaan...</span>
                  </div>
                ) : availableRooms.length === 0 ? (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                    <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive font-medium">Tidak ada ruangan tersedia</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Semua ruangan sudah terisi pada jam ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableRooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomForConfirm(room.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedRoomForConfirm === room.id
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "hover:border-primary/50 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{room.name}</span>
                          </div>
                          {selectedRoomForConfirm === room.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsRoomSelectOpen(false);
                setPendingStatusChange(null);
                setSelectedRoomForConfirm("");
              }}
            >
              Batal
            </Button>
            <Button 
              onClick={confirmRoomSelection}
              disabled={!selectedRoomForConfirm || isUpdating || availableRooms.length === 0}
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konfirmasi & {pendingStatusChange?.newStatus === "confirmed" ? "Booking" : "Check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
