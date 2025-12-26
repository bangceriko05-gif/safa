import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, FileDown, UserCog, Calendar, History, Users, FileText, Settings, Package, Inbox, List } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import DateNavigation from "./DateNavigation";
import RoomSummary from "./RoomSummary";
import ScheduleTable from "./ScheduleTable";
import PMSCalendar from "./PMSCalendar";
import BookingModal from "./BookingModal";
import UserManagement from "./UserManagement";
import RoomManagement from "./RoomManagement";
import CustomerManagement from "./CustomerManagement";
import { ActivityLog } from "./ActivityLog";
import Reports from "./Reports";
import PermissionManagement from "./PermissionManagement";
import DisplaySettings from "./DisplaySettings";
import NotificationSettings from "./NotificationSettings";
import StoreSelector from "./StoreSelector";
import StoreManagement from "./StoreManagement";
import BookingRequestsManagement from "./BookingRequestsManagement";
import ListBooking from "./ListBooking";
import { useStore } from "@/contexts/StoreContext";
import * as XLSX from "xlsx";
import { logActivity } from "@/utils/activityLogger";
import { format, differenceInDays, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function Dashboard() {
  const { currentStore, isLoading: storeLoading } = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ roomId: string; time: string } | null>(null);
  const [activeTab, setActiveTab] = useState("bookings");
  const [displaySize, setDisplaySize] = useState<string>(() => {
    return localStorage.getItem("schedule-display-size") || "normal";
  });
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingBookingSlot, setPendingBookingSlot] = useState<{ roomId: string; time: string } | null>(null);
  const navigate = useNavigate();

  // Calculate days difference from today
  const getDaysDifference = () => {
    const today = startOfDay(new Date());
    const selected = startOfDay(selectedDate);
    return differenceInDays(selected, today);
  };

  const getRelativeDateText = () => {
    const diff = getDaysDifference();
    if (diff === 1) return "besok";
    if (diff === -1) return "kemarin";
    if (diff > 1) return `${diff} hari kedepan`;
    if (diff < -1) return `${Math.abs(diff)} hari yang lalu`;
    return "";
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer role fetch
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchUserRole(session.user.id);
      }
    });

    // Listen for display size changes
    const handleDisplaySizeChange = (e: any) => {
      setDisplaySize(e.detail);
    };
    window.addEventListener("display-size-changed", handleDisplaySizeChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("display-size-changed", handleDisplaySizeChange);
    };
  }, [navigate]);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setUserRole(data?.role || "user");
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole("user");
    }
  };

  const handleLogout = async () => {
    try {
      // Log logout activity
      await logActivity({
        actionType: 'login',
        entityType: 'System',
        description: 'Logout dari sistem',
      });

      // Sign out from Supabase first
      await supabase.auth.signOut();
      
      // Then clear local state
      setUser(null);
      setSession(null);
      setUserRole(null);
      
      toast.success("Berhasil logout");
      navigate("/auth");
    } catch (error: any) {
      // Even if error, clear state and redirect
      setUser(null);
      setSession(null);
      setUserRole(null);
      navigate("/auth");
    }
  };

  const handleAddBooking = (roomId: string, timeOrDate: string) => {
    // Check if this is a PMS calendar call (date format) or time-based call
    const isPMSMode = currentStore?.name?.toLowerCase().includes("safa");
    
    if (isPMSMode) {
      // For PMS mode, timeOrDate is a date string
      setSelectedSlot({ roomId, time: timeOrDate });
      setEditingBooking(null);
      setIsModalOpen(true);
      return;
    }
    
    const daysDiff = getDaysDifference();
    if (daysDiff !== 0) {
      // Show confirmation dialog for non-today dates
      setPendingBookingSlot({ roomId, time: timeOrDate });
      setShowDateConfirmation(true);
      return;
    }
    
    // Open modal directly for today
    setSelectedSlot({ roomId, time: timeOrDate });
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleDateConfirmation = () => {
    if (pendingBookingSlot) {
      setSelectedSlot(pendingBookingSlot);
      setEditingBooking(null);
      setIsModalOpen(true);
    }
    setShowDateConfirmation(false);
    setPendingBookingSlot(null);
  };

  const handleCancelDateConfirmation = () => {
    setShowDateConfirmation(false);
    setPendingBookingSlot(null);
  };

  const handleEditBooking = (booking: any) => {
    setEditingBooking(booking);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const handleExportToExcel = async () => {
    try {
      if (!currentStore) {
        toast.error("Silakan pilih cabang terlebih dahulu");
        return;
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          *,
          rooms (name),
          bid
        `)
        .eq("date", dateStr)
        .eq("store_id", currentStore.id)
        .order("start_time");

      if (error) throw error;

      // Fetch booking products for all bookings
      const bookingIds = bookings.map((b: any) => b.id);
      const { data: bookingProducts } = await supabase
        .from("booking_products")
        .select("*")
        .in("booking_id", bookingIds);

      // Fetch all variants
      const variantIds = [...new Set(bookings.map((b: any) => b.variant_id).filter(Boolean))];
      const { data: variants } = await supabase
        .from("room_variants")
        .select("*")
        .in("id", variantIds);

      const variantMap = new Map(variants?.map((v: any) => [v.id, v]) || []);

      const exportData = bookings.map((booking: any) => {
        // Calculate total products
        const products = bookingProducts?.filter((p: any) => p.booking_id === booking.id) || [];
        const totalProducts = products.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);

        // Calculate variant price
        const variant = booking.variant_id ? variantMap.get(booking.variant_id) : null;
        let variantPrice = 0;
        if (variant) {
          const pricePerHour = Number(variant.price) / Number(variant.duration);
          variantPrice = pricePerHour * Number(booking.duration || 0);

          // Apply discount if applies to room
          if (booking.discount_applies_to === "room" || booking.discount_applies_to === "both") {
            const discountValue = Number(booking.discount_value) || 0;
            if (booking.discount_type === "percentage") {
              variantPrice = variantPrice - (variantPrice * discountValue / 100);
            } else if (booking.discount_type === "fixed") {
              variantPrice = variantPrice - discountValue;
            }
          }
        }

        // Calculate total paid by customer
        const price1 = Number(booking.price) || 0;
        const price2 = Number(booking.price_2) || 0;
        const totalPaid = price1 + price2;

        // Ensure Cash is always in first payment method for export
        let firstMethod = booking.payment_method ?? "";
        let firstAmount = price1;
        let firstRef = booking.reference_no ?? "";
        let secondMethod = booking.payment_method_2 ?? "";
        let secondAmount = price2;
        let secondRef = booking.reference_no_2 ?? "";

        // If second payment is Cash but first isn't, swap them
        if (secondMethod === "Cash" && firstMethod !== "Cash") {
          firstMethod = booking.payment_method_2 ?? "";
          firstAmount = price2;
          firstRef = booking.reference_no_2 ?? "";
          secondMethod = booking.payment_method ?? "";
          secondAmount = price1;
          secondRef = booking.reference_no ?? "";
        }

        return {
          "BID": booking.bid ?? "",
          "Nama Pelanggan": booking.customer_name,
          "Nomor HP": booking.phone,
          "Ruangan": booking.rooms.name,
          "Tanggal": booking.date,
          "Jam Mulai": booking.start_time,
          "Jam Selesai": booking.end_time,
          "Total Harga Varian": variantPrice,
          "Total Produk": totalProducts,
          "Total yang Dibayar Customer": totalPaid,
          "Metode Pembayaran": firstMethod,
          "Total Bayar": firstAmount,
          "No. Reff": firstRef,
          "Metode Pembayaran 2": secondMethod,
          "Total Bayar 2": secondAmount,
          "No. Reff Kedua": secondRef,
          "Catatan": booking.note ?? "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bookings");
      
      XLSX.writeFile(wb, `treebox-bookings-${dateStr}.xlsx`);
      toast.success("Data berhasil diekspor!");
    } catch (error: any) {
      toast.error("Gagal mengekspor data");
      console.error(error);
    }
  };

  // Show loading state while checking auth or loading stores
  if (!user || storeLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center" style={{ background: "var(--gradient-main)" }}>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 text-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-lg">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Only show "no access" message after loading is complete
  if (!currentStore) {
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center" style={{ background: "var(--gradient-main)" }}>
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Tidak ada akses cabang</h2>
          <p className="text-muted-foreground">Hubungi administrator untuk mendapatkan akses</p>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "var(--gradient-main)" }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{currentStore.name}</h1>
            <p className="text-muted-foreground">
              Selamat datang, {user.email} ({
                userRole === "admin" ? "Admin" : 
                userRole === "leader" ? "Leader" : 
                "User"
              })
            </p>
            <StoreSelector />
          </div>
          <div className="flex gap-2">
            {(userRole === "admin" || userRole === "leader") && (
              <Button onClick={handleExportToExcel} variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Tabs for Bookings and User Management */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-6xl" style={{ 
            gridTemplateColumns: 
              (userRole === "admin" || userRole === "leader") ? "1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr" : 
              "1fr 1fr 1fr 1fr 1fr 1fr" 
          }}>
            <TabsTrigger value="bookings">
              <Calendar className="mr-2 h-4 w-4" />
              Kalender
            </TabsTrigger>
            <TabsTrigger value="list-booking">
              <List className="mr-2 h-4 w-4" />
              List Booking
            </TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="mr-2 h-4 w-4" />
              Pelanggan
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="mr-2 h-4 w-4" />
              Laporan
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Pengaturan
            </TabsTrigger>
            {(userRole === "admin" || userRole === "leader") && (
              <>
                <TabsTrigger value="rooms">
                  <Package className="mr-2 h-4 w-4" />
                  Produk & Inventori
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <History className="mr-2 h-4 w-4" />
                  Log
                </TabsTrigger>
                <TabsTrigger value="users">
                  <UserCog className="mr-2 h-4 w-4" />
                  Pengguna
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="bookings" className="space-y-6 mt-6">
            {/* Room Summary - shown for all store types */}
            <RoomSummary selectedDate={selectedDate} />

            {/* Conditional rendering based on store type */}
            {currentStore?.name?.toLowerCase().includes("safa") ? (
              /* PMS Calendar for SAFA Kost */
              <PMSCalendar
                selectedDate={selectedDate}
                userRole={userRole}
                onAddBooking={handleAddBooking}
                onEditBooking={handleEditBooking}
                onDateChange={setSelectedDate}
              />
            ) : (
              /* Regular schedule table for other stores */
              <>
                {/* Date Navigation */}
                <DateNavigation selectedDate={selectedDate} onDateChange={setSelectedDate} />

                {/* Schedule Table */}
                <ScheduleTable
                  selectedDate={selectedDate}
                  userRole={userRole}
                  onAddBooking={handleAddBooking}
                  onEditBooking={handleEditBooking}
                  displaySize={displaySize}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="list-booking" className="mt-6">
            <ListBooking userRole={userRole} onEditBooking={handleEditBooking} />
          </TabsContent>

          <TabsContent value="customers" className="mt-6">
            <CustomerManagement />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <Reports />
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-6">
            <DisplaySettings userRole={userRole} />
            <NotificationSettings />
          </TabsContent>

          {(userRole === "admin" || userRole === "leader") && (
            <>
              <TabsContent value="rooms" className="mt-6">
                <RoomManagement />
              </TabsContent>
              
              <TabsContent value="activity" className="mt-6">
                <ActivityLog />
              </TabsContent>

              <TabsContent value="users" className="mt-6 space-y-6">
                <UserManagement />
                {userRole === "admin" && (
                  <PermissionManagement />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Booking Modal */}
        <BookingModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBooking(null);
            setSelectedSlot(null);
          }}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          editingBooking={editingBooking}
          userId={user.id}
        />

        {/* Date Confirmation Dialog */}
        <AlertDialog open={showDateConfirmation} onOpenChange={setShowDateConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Tanggal Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin membuat booking untuk <strong>{getRelativeDateText()}</strong> ({format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })})?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDateConfirmation}>
                Tidak
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDateConfirmation}>
                Ya, Lanjutkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
