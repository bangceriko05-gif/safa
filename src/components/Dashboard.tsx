import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, FileDown, UserCog, Calendar, History, Users, FileText, Settings, Package, Inbox, Shield, Receipt, ChevronDown, PanelLeft, UserCircle, Phone, Mail, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import SettingsPage from "./SettingsPage";
import StoreSelector from "./StoreSelector";
import StoreManagement from "./StoreManagement";
import BookingRequestsManagement from "./BookingRequestsManagement";
import TransactionManagement from "./TransactionManagement";
import DepositFormModal from "./deposit/DepositFormModal";
import StoreInactiveNotice from "./StoreInactiveNotice";
import FeatureInactiveNotice from "./FeatureInactiveNotice";
import { useStore } from "@/contexts/StoreContext";
import * as XLSX from "xlsx";

import { usePermissions } from "@/hooks/usePermissions";
import { useStoreFeatures } from "@/hooks/useStoreFeatures";
import NoAccessMessage from "./NoAccessMessage";
import { format, differenceInDays, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function Dashboard() {
  const { currentStore, isLoading: storeLoading, isStoreInactive, inactiveStoreName } = useStore();
  const { isFeatureEnabled, getFeatureInfo } = useStoreFeatures(currentStore?.id);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ roomId: string; time: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabRaw] = useState(() => searchParams.get("tab") || "bookings");
  const setActiveTab = (tab: string) => {
    setActiveTabRaw(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    if (tab !== "reports") {
      params.delete("reportTab");
      params.delete("accountingTab");
    }
    setSearchParams(params, { replace: true });
  };
  const [displaySize, setDisplaySize] = useState<string>(() => {
    return localStorage.getItem("schedule-display-size") || "normal";
  });
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingBookingSlot, setPendingBookingSlot] = useState<{ roomId: string; time: string } | null>(null);
  const [depositMode, setDepositMode] = useState(false);
  const [depositRoomId, setDepositRoomId] = useState<string | null>(null);
  const [depositRoomName, setDepositRoomName] = useState("");
  const [showDepositFormModal, setShowDepositFormModal] = useState(false);
  const [depositRefreshTrigger, setDepositRefreshTrigger] = useState(0);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "", phone: "" });
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const navigate = useNavigate();
  const { hasPermission: checkPerm, hasAnyPermission } = usePermissions();

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

  // Auto-refresh at midnight (00:00) every day
  useEffect(() => {
    const scheduleRefresh = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const msUntilMidnight = midnight.getTime() - now.getTime();

      return setTimeout(() => {
        window.location.reload();
      }, msUntilMidnight);
    };

    const timerId = scheduleRefresh();
    return () => clearTimeout(timerId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === "SIGNED_OUT") {
          navigate("/auth");
          return;
        }
        
        if (session?.user) {
          // Defer role fetch to avoid deadlock with auth state
          setTimeout(() => {
            if (isMounted) fetchUserRole(session.user.id);
          }, 0);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      if (!session) {
        // Don't immediately redirect - wait a moment for onAuthStateChange 
        // to potentially recover the session via token refresh
        setTimeout(() => {
          if (!isMounted) return;
          // Re-check session after giving auth state change time to fire
          supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
            if (!isMounted) return;
            if (!retrySession) {
              navigate("/auth");
            }
          });
        }, 1500);
        return;
      }

      const { count, error: accessError } = await supabase
        .from("user_store_access")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      if (accessError || (count ?? 0) === 0) {
        await supabase.auth.signOut();
        toast.error("Akun Anda belum terdaftar di sistem. Hubungi admin untuk didaftarkan melalui Manajemen Pengguna.");
        navigate("/auth");
        return;
      }

      setSession(session);
      setUser(session.user);
      fetchUserRole(session.user.id);
      fetchProfile(session.user.id);
    });

    // Listen for display size changes
    const handleDisplaySizeChange = (e: any) => {
      setDisplaySize(e.detail);
    };
    window.addEventListener("display-size-changed", handleDisplaySizeChange);

    return () => {
      isMounted = false;
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
        .maybeSingle();

      if (error) throw error;
      setUserRole(data?.role || "user");
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole("user");
    }
  };

  const handleLogout = async () => {
    try {
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
  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setProfileData({ name: data.name || "", email: data.email || "", phone: "" });
    }
  };

  const openProfileDialog = async () => {
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", user.id)
        .maybeSingle();
      const pName = data?.name || "";
      const pEmail = data?.email || user.email || "";
      setProfileData({ name: pName, email: pEmail, phone: "" });
      setProfileForm({ name: pName, email: pEmail, phone: "", password: "" });
      setShowProfileDialog(true);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      // Update profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name: profileForm.name })
        .eq("id", user.id);
      if (profileError) throw profileError;

      // Update email if changed
      if (profileForm.email && profileForm.email !== profileData.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: profileForm.email });
        if (emailError) throw emailError;
      }

      // Update password if provided
      if (profileForm.password) {
        const { error: pwError } = await supabase.auth.updateUser({ password: profileForm.password });
        if (pwError) throw pwError;
      }

      setProfileData({ name: profileForm.name, email: profileForm.email, phone: profileForm.phone });
      toast.success("Profil berhasil diperbarui");
      setShowProfileDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui profil");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddBooking = (roomId: string, timeOrDate: string) => {
    // Check if this is a PMS calendar call (date format) or time-based call
    const isPMSMode = currentStore?.calendar_type === "pms";
    
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

  // Show inactive store notice
  if (isStoreInactive) {
    return (
      <StoreInactiveNotice 
        storeName={inactiveStoreName || undefined} 
        onLogout={handleLogout} 
      />
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

  const sidebarMenuItems = [
    { key: "bookings", label: "Kalender", icon: Calendar },
    { key: "transactions", label: "Transaksi", icon: Receipt },
    { key: "customers", label: "Pelanggan", icon: Users },
    { key: "reports", label: "Laporan", icon: FileText },
    { key: "settings", label: "Pengaturan", icon: Settings },
    { key: "rooms", label: "Produk & Inventori", icon: Package },
    ...(userRole === "admin" || userRole === "leader"
      ? [
          { key: "activity", label: "Log", icon: History },
          { key: "users", label: "Pengguna", icon: UserCog },
        ]
      : []),
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" style={{ background: "var(--gradient-main)" }}>
        {/* Left Sidebar - Desktop only */}
        <Sidebar collapsible="icon" className="hidden lg:flex border-r bg-background">
          <SidebarContent className="pt-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarMenuItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={activeTab === item.key}
                        onClick={() => setActiveTab(item.key)}
                        tooltip={item.label}
                        className="gap-3"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={openProfileDialog}
                  tooltip="Profil"
                  className="gap-3"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {(profileData.name || user?.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-sm font-medium truncate">{profileData.name || "Profil"}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  tooltip="Logout"
                  className="gap-3 text-destructive hover:text-destructive"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-start gap-3">
                  {/* Sidebar toggle - Desktop */}
                  <SidebarTrigger className="hidden lg:flex mt-1.5" />
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">{currentStore.name}</h1>
                    <p className="text-muted-foreground">
                      Selamat datang, {user.email} ({
                        userRole === "owner" ? "Owner" :
                        userRole === "admin" ? "Admin" : 
                        userRole === "akuntan" ? "Akuntan" :
                        userRole === "leader" ? "Leader" : 
                        "User"
                      })
                    </p>
                    {currentStore.subscription_end_date && (() => {
                      const endDate = new Date(currentStore.subscription_end_date);
                      const daysLeft = differenceInDays(endDate, new Date());
                      const endFormatted = format(endDate, "d MMMM yyyy", { locale: idLocale });
                      if (daysLeft < 0) {
                        return (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                            ⚠️ Langganan expired sejak {endFormatted}
                          </div>
                        );
                      }
                      if (daysLeft <= 7) {
                        return (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                            ⏰ Langganan berakhir {endFormatted} ({daysLeft} hari lagi)
                          </div>
                        );
                      }
                      if (daysLeft <= 30) {
                        return (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-700 text-xs font-medium">
                            📅 Langganan berakhir {endFormatted} ({daysLeft} hari lagi)
                          </div>
                        );
                      }
                      return (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          ✅ Aktif hingga {endFormatted} ({daysLeft} hari lagi)
                        </div>
                      );
                    })()}
                    <StoreSelector />
                  </div>
                </div>
                <div className="flex gap-2">
                  {isFeatureEnabled("deposit") && activeTab === "bookings" && (
                    <Button 
                      onClick={() => setDepositMode(!depositMode)} 
                      variant={depositMode ? "default" : "outline"}
                      className={depositMode ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                      size="default"
                    >
                      <Shield className="lg:mr-2 h-4 w-4" />
                      <span className="hidden lg:inline">{depositMode ? "Batal Pilih" : "Deposit"}</span>
                    </Button>
                  )}
                  <Button onClick={handleLogout} variant="outline">
                    <LogOut className="lg:mr-2 h-4 w-4" />
                    <span className="hidden lg:inline">Logout</span>
                  </Button>
                </div>
              </div>

              {/* Tabs wrapper - keeps TabsContent working */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* Mobile: Dropdown */}
                <div className="lg:hidden">
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bookings">
                        <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Kalender</span>
                      </SelectItem>
                      <SelectItem value="transactions">
                        <span className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Transaksi</span>
                      </SelectItem>
                      <SelectItem value="customers">
                        <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Pelanggan</span>
                      </SelectItem>
                      <SelectItem value="reports">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Laporan</span>
                      </SelectItem>
                      <SelectItem value="settings">
                        <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Pengaturan</span>
                      </SelectItem>
                      <SelectItem value="rooms">
                        <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Produk & Inventori</span>
                      </SelectItem>
                      {(userRole === "admin" || userRole === "leader") && (
                        <>
                          <SelectItem value="activity">
                            <span className="flex items-center gap-2"><History className="h-4 w-4" /> Log</span>
                          </SelectItem>
                          <SelectItem value="users">
                            <span className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Pengguna</span>
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

          <TabsContent value="bookings" forceMount className={`space-y-6 mt-6 ${activeTab !== "bookings" ? "hidden" : ""}`}>
            {isFeatureEnabled("calendar") ? (
              <>
                {/* Room Summary - shown for all store types */}
                <RoomSummary selectedDate={selectedDate} />

                {/* Conditional rendering based on store calendar type */}
                {currentStore?.calendar_type === "pms" ? (
                  /* PMS Calendar for hotel/kost type stores */
                  <>
                    {depositMode && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                        <Shield className="h-5 w-5 text-amber-600" />
                        <span className="text-amber-800 font-medium">
                          Mode Deposit: Klik pada baris kamar untuk menambahkan deposit
                        </span>
                      </div>
                    )}
                    <PMSCalendar
                      selectedDate={selectedDate}
                      userRole={userRole}
                      onAddBooking={handleAddBooking}
                      onEditBooking={handleEditBooking}
                      onDateChange={setSelectedDate}
                      depositMode={depositMode}
                      onDepositModeChange={setDepositMode}
                      onDepositRoomSelect={async (roomId) => {
                        const { data: room } = await supabase
                          .from("rooms")
                          .select("name")
                          .eq("id", roomId)
                          .single();
                        
                        setDepositRoomId(roomId);
                        setDepositRoomName(room?.name || "Unknown");
                        setShowDepositFormModal(true);
                      }}
                    />
                  </>
                ) : (
                  /* Regular schedule table for hourly booking stores */
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
              </>
            ) : (
              <FeatureInactiveNotice featureName="Kalender" icon={Calendar} price={getFeatureInfo("calendar").price} description={getFeatureInfo("calendar").description} />
            )}
          </TabsContent>

          <TabsContent value="transactions" forceMount className={`mt-6 ${activeTab !== "transactions" ? "hidden" : ""}`}>
            {isFeatureEnabled("transactions") ? (
              <TransactionManagement 
                userRole={userRole} 
                onEditBooking={handleEditBooking} 
                onAddBooking={() => {
                  setEditingBooking(null);
                  setSelectedSlot(null);
                  setIsModalOpen(true);
                }}
                onAddDeposit={() => {
                  setDepositRoomId(null);
                  setDepositRoomName("");
                  setShowDepositFormModal(true);
                }}
                depositRefreshTrigger={depositRefreshTrigger}
              />
            ) : (
              <FeatureInactiveNotice featureName="Transaksi" icon={Receipt} price={getFeatureInfo("transactions").price} description={getFeatureInfo("transactions").description} />
            )}
          </TabsContent>

          <TabsContent value="customers" forceMount className={`mt-6 ${activeTab !== "customers" ? "hidden" : ""}`}>
            {isFeatureEnabled("customers") ? (
              <CustomerManagement />
            ) : (
              <FeatureInactiveNotice featureName="Pelanggan" icon={Users} price={getFeatureInfo("customers").price} description={getFeatureInfo("customers").description} />
            )}
          </TabsContent>

          <TabsContent value="reports" forceMount className={`mt-6 ${activeTab !== "reports" ? "hidden" : ""}`}>
            {isFeatureEnabled("reports") ? (
              <Reports />
            ) : (
              <FeatureInactiveNotice featureName="Laporan" icon={FileText} price={getFeatureInfo("reports").price} description={getFeatureInfo("reports").description} />
            )}
          </TabsContent>

          <TabsContent value="settings" forceMount className={`mt-6 ${activeTab !== "settings" ? "hidden" : ""}`}>
            {isFeatureEnabled("settings") ? (
              <SettingsPage userRole={userRole} />
            ) : (
              <FeatureInactiveNotice featureName="Pengaturan" icon={Settings} price={getFeatureInfo("settings").price} description={getFeatureInfo("settings").description} />
            )}
          </TabsContent>

          <TabsContent value="rooms" forceMount className={`mt-6 ${activeTab !== "rooms" ? "hidden" : ""}`}>
            {isFeatureEnabled("products_inventory") ? (
              hasAnyPermission(["manage_products", "view_products", "manage_rooms", "view_rooms"]) ? (
                <RoomManagement />
              ) : (
                <NoAccessMessage featureName="Produk & Inventori" />
              )
            ) : (
              <FeatureInactiveNotice featureName="Produk & Inventori" icon={Package} price={getFeatureInfo("products_inventory").price} description={getFeatureInfo("products_inventory").description} />
            )}
          </TabsContent>


          {(userRole === "admin" || userRole === "leader") && (
            <>
              <TabsContent value="activity" forceMount className={`mt-6 ${activeTab !== "activity" ? "hidden" : ""}`}>
                {isFeatureEnabled("activity_log") ? (
                  <ActivityLog />
                ) : (
                  <FeatureInactiveNotice featureName="Log Aktivitas" icon={History} price={getFeatureInfo("activity_log").price} description={getFeatureInfo("activity_log").description} />
                )}
              </TabsContent>

              <TabsContent value="users" forceMount className={`mt-6 ${activeTab !== "users" ? "hidden" : ""}`}>
                {isFeatureEnabled("user_management") ? (
                  <Tabs defaultValue="user-management" className="space-y-4">
                    <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: userRole === "admin" ? "1fr 1fr" : "1fr" }}>
                      <TabsTrigger value="user-management" className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        Manajemen Pengguna
                      </TabsTrigger>
                      {userRole === "admin" && (
                        <TabsTrigger value="permission-management" className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Manajemen Permission
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent value="user-management">
                      <UserManagement />
                    </TabsContent>
                    {userRole === "admin" && (
                      <TabsContent value="permission-management">
                        <PermissionManagement />
                      </TabsContent>
                    )}
                  </Tabs>
                ) : (
                  <FeatureInactiveNotice featureName="Manajemen Pengguna" icon={UserCog} price={getFeatureInfo("user_management").price} description={getFeatureInfo("user_management").description} />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Deposit Form Modal */}
        <DepositFormModal
          open={showDepositFormModal}
          roomId={depositRoomId}
          roomName={depositRoomName}
          onClose={() => {
            setShowDepositFormModal(false);
            setDepositRoomId(null);
            setDepositRoomName("");
            setDepositMode(false);
          }}
          onSuccess={() => {
            setDepositRefreshTrigger(prev => prev + 1);
            setDepositMode(false);
          }}
        />

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
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Profil Saya
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><UserCircle className="h-4 w-4" /> Nama</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="email@contoh.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Password Baru</Label>
              <Input
                type="password"
                value={profileForm.password}
                onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                placeholder="Kosongkan jika tidak diubah"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Nomor HP</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowProfileDialog(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={profileSaving}>
                {profileSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
