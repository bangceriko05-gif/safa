import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CheckCircle, XCircle, Loader2, AlertTriangle, Calendar, Clock, MapPin, User, Phone, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface BookingRequest {
  id: string;
  bid: string | null;
  store_id: string;
  room_name: string;
  category_name: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration: number;
  total_price: number;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  status: string;
  confirmation_token: string;
}

interface Store {
  id: string;
  name: string;
}

export default function BookingConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingRequest, setBookingRequest] = useState<BookingRequest | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionCompleted, setActionCompleted] = useState<'confirmed' | 'cancelled' | null>(null);

  const token = searchParams.get("token");
  const action = searchParams.get("action");

  useEffect(() => {
    if (token) {
      fetchBookingByToken(token);
    } else {
      setError("Token tidak valid");
      setIsLoading(false);
    }
  }, [token]);

  // Auto-execute action if provided in URL
  useEffect(() => {
    if (bookingRequest && action && !actionCompleted) {
      if (action === "confirm") {
        handleConfirm();
      } else if (action === "cancel") {
        handleCancel();
      }
    }
  }, [bookingRequest, action]);

  const fetchBookingByToken = async (confirmToken: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("confirmation_token", confirmToken)
        .single();

      if (fetchError || !data) {
        setError("Booking tidak ditemukan atau link sudah tidak valid");
        return;
      }

      setBookingRequest(data);

      // Fetch store info
      const { data: storeData } = await supabase
        .from("stores")
        .select("id, name")
        .eq("id", data.store_id)
        .single();

      if (storeData) {
        setStore(storeData);
      }
    } catch (err) {
      console.error("Error fetching booking:", err);
      setError("Terjadi kesalahan saat memuat data booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!bookingRequest || bookingRequest.status !== "pending") return;

    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({ 
          status: "confirmed",
          admin_notes: (bookingRequest as any).admin_notes 
            ? `${(bookingRequest as any).admin_notes}\nDikonfirmasi oleh customer via link`
            : "Dikonfirmasi oleh customer via link"
        })
        .eq("id", bookingRequest.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      setActionCompleted("confirmed");
      setBookingRequest({ ...bookingRequest, status: "confirmed" });
      toast.success("Booking berhasil dikonfirmasi!");
    } catch (err) {
      console.error("Error confirming booking:", err);
      toast.error("Gagal mengkonfirmasi booking");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!bookingRequest || !["pending", "confirmed"].includes(bookingRequest.status)) return;

    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({ 
          status: "cancelled",
          admin_notes: (bookingRequest as any).admin_notes 
            ? `${(bookingRequest as any).admin_notes}\nDibatalkan oleh customer via link`
            : "Dibatalkan oleh customer via link"
        })
        .eq("id", bookingRequest.id);

      if (updateError) throw updateError;

      setActionCompleted("cancelled");
      setBookingRequest({ ...bookingRequest, status: "cancelled" });
      toast.success("Booking berhasil dibatalkan");
    } catch (err) {
      console.error("Error cancelling booking:", err);
      toast.error("Gagal membatalkan booking");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">Menunggu Konfirmasi</span>;
      case "confirmed":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">Terkonfirmasi</span>;
      case "cancelled":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Dibatalkan</span>;
      case "check-in":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">Check-in</span>;
      case "completed":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Selesai</span>;
      case "expired":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Kadaluarsa</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Memuat data booking...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Booking Tidak Ditemukan</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button onClick={() => navigate("/booking")}>
              Buat Booking Baru
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bookingRequest) return null;

  // Show success/cancelled message after action
  if (actionCompleted) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${actionCompleted === "confirmed" ? "from-green-50 to-emerald-100" : "from-red-50 to-orange-100"} flex items-center justify-center p-4`}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {actionCompleted === "confirmed" ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">Booking Dikonfirmasi!</h2>
                <p className="text-muted-foreground text-center mb-6">
                  Terima kasih, {bookingRequest.customer_name}. Booking Anda telah dikonfirmasi. 
                  Kami akan menghubungi Anda jika ada informasi lebih lanjut.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-red-700 mb-2">Booking Dibatalkan</h2>
                <p className="text-muted-foreground text-center mb-6">
                  Booking Anda telah dibatalkan. Jika ini adalah kesalahan, silakan buat booking baru.
                </p>
              </>
            )}
            <Button onClick={() => navigate("/booking")}>
              Buat Booking Baru
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Detail Booking</CardTitle>
            <CardDescription>
              {bookingRequest.bid || "Booking Request"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="flex justify-center">
              {getStatusBadge(bookingRequest.status)}
            </div>

            {/* Booking Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Cabang</p>
                  <p className="font-medium">{store?.name || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal</p>
                  <p className="font-medium">
                    {format(new Date(bookingRequest.booking_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Waktu</p>
                  <p className="font-medium">
                    {bookingRequest.start_time} - {bookingRequest.end_time} ({bookingRequest.duration} jam)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 text-muted-foreground mt-0.5 flex items-center justify-center">
                  🎮
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kategori & Mode</p>
                  <p className="font-medium">{bookingRequest.room_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nama</p>
                  <p className="font-medium">{bookingRequest.customer_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{bookingRequest.customer_phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Metode Pembayaran</p>
                  <p className="font-medium">{bookingRequest.payment_method}</p>
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary text-xl">
                    {formatCurrency(bookingRequest.total_price)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Only show for pending status */}
            {bookingRequest.status === "pending" && (
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Konfirmasi Booking
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  size="lg"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-5 w-5" />
                      Batalkan Booking
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Info for non-pending statuses */}
            {bookingRequest.status !== "pending" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Booking ini sudah {bookingRequest.status === "confirmed" ? "dikonfirmasi" : 
                    bookingRequest.status === "cancelled" ? "dibatalkan" : 
                    bookingRequest.status === "check-in" ? "check-in" : 
                    "diproses"}. 
                  Hubungi admin jika Anda memerlukan bantuan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2024 Treebox. All rights reserved.
        </p>
      </div>
    </div>
  );
}
