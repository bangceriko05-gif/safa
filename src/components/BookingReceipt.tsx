import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingData {
  id: string;
  bid: string | null;
  customer_name: string;
  phone: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  price_2?: number;
  dual_payment?: boolean;
  payment_method?: string;
  payment_method_2?: string;
  reference_no?: string;
  reference_no_2?: string;
  discount_value?: number;
  discount_type?: string;
  discount_applies_to?: string;
  note?: string;
  status?: string;
  created_at: string;
  room_name: string;
  variant_name?: string;
  store_id: string;
}

interface PrintSettings {
  paper_size: string;
  logo_url: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  manager_name: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_manager_signature: boolean;
  show_qr_code: boolean;
}

interface BookingProduct {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

export default function BookingReceipt() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
  const [products, setProducts] = useState<BookingProduct[]>([]);
  const [storeName, setStoreName] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bookingId) {
      fetchData();
    }
  }, [bookingId]);

  const fetchData = async () => {
    if (!bookingId) return;
    setIsLoading(true);

    try {
      // Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          rooms (name, store_id)
        `)
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Fetch variant name if exists
      let variantName = undefined;
      if (bookingData.variant_id) {
        const { data: variantData } = await supabase
          .from("room_variants")
          .select("variant_name")
          .eq("id", bookingData.variant_id)
          .single();
        variantName = variantData?.variant_name;
      }

      const storeId = bookingData.store_id || bookingData.rooms?.store_id;

      // Fetch store name
      if (storeId) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("name")
          .eq("id", storeId)
          .single();
        setStoreName(storeData?.name || "");
      }

      // Fetch print settings
      if (storeId) {
        const { data: settingsData } = await supabase
          .from("print_settings")
          .select("*")
          .eq("store_id", storeId)
          .maybeSingle();

        if (settingsData) {
          setPrintSettings(settingsData);
        } else {
          // Default settings
          setPrintSettings({
            paper_size: "80mm",
            logo_url: null,
            business_name: storeName || null,
            business_address: null,
            business_phone: null,
            manager_name: null,
            footer_text: "Terima kasih atas kunjungan Anda!",
            show_logo: true,
            show_manager_signature: true,
            show_qr_code: false,
          });
        }
      }

      // Fetch products
      const { data: productsData } = await supabase
        .from("booking_products")
        .select("product_name, quantity, product_price, subtotal")
        .eq("booking_id", bookingId);

      setProducts(productsData || []);

      setBooking({
        ...bookingData,
        room_name: bookingData.rooms?.name || "Unknown",
        variant_name: variantName,
        store_id: storeId,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDiscount = () => {
    if (!booking || !booking.discount_value || booking.discount_value <= 0) return 0;
    
    const baseAmount = booking.price;
    if (booking.discount_type === "percent") {
      return Math.round(baseAmount * (booking.discount_value / 100));
    }
    return booking.discount_value;
  };

  const calculateTotal = () => {
    if (!booking) return 0;
    
    // Room price is the base price for the room rental
    const roomPrice = booking.price;
    // Products total from booking_products
    const productsTotal = products.reduce((sum, p) => sum + p.subtotal, 0);
    // Calculate discount
    const discount = calculateDiscount();
    
    // Total = room price + products - discount
    // Note: price_2 is just the split payment amount, not an additional price
    // When dual_payment is true, price + price_2 should equal the total payment
    // but we calculate total from actual prices, not payment splits
    return roomPrice + productsTotal - discount;
  };

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "BO": return "Reservasi";
      case "CI": return "Check In";
      case "CO": return "Check Out";
      case "BATAL": return "BATAL";
      default: return "Reservasi";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getPaperWidth = () => {
    switch (printSettings?.paper_size) {
      case "58mm": return "58mm";
      case "80mm": return "80mm";
      case "A5": return "148mm";
      case "A4": return "210mm";
      default: return "80mm";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Booking tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="max-w-md mx-auto mb-4 print:hidden flex gap-2">
        <Button onClick={handlePrint} className="flex-1">
          🖨️ Print Nota
        </Button>
        <Button variant="outline" onClick={() => window.close()}>
          Tutup
        </Button>
      </div>

      {/* Receipt */}
      <div
        ref={receiptRef}
        className="bg-white mx-auto shadow-lg print:shadow-none"
        style={{
          width: getPaperWidth(),
          maxWidth: "100%",
          padding: printSettings?.paper_size === "58mm" ? "8px" : "16px",
          fontFamily: "monospace",
        }}
      >
        {/* Header with Logo */}
        {printSettings?.show_logo && printSettings?.logo_url && (
          <div className="text-center mb-3">
            <img
              src={printSettings.logo_url}
              alt="Logo"
              className="mx-auto"
              style={{
                maxHeight: printSettings.paper_size === "58mm" ? "40px" : "60px",
                maxWidth: "80%",
              }}
            />
          </div>
        )}

        {/* Business Info */}
        <div className="text-center mb-3">
          <h1
            className="font-bold"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "12px" : "14px",
            }}
          >
            {printSettings?.business_name || storeName || "Treebox"}
          </h1>
          {printSettings?.business_address && (
            <p
              className="text-gray-600"
              style={{
                fontSize: printSettings?.paper_size === "58mm" ? "9px" : "10px",
              }}
            >
              {printSettings.business_address}
            </p>
          )}
          {printSettings?.business_phone && (
            <p
              className="text-gray-600"
              style={{
                fontSize: printSettings?.paper_size === "58mm" ? "9px" : "10px",
              }}
            >
              Tel: {printSettings.business_phone}
            </p>
          )}
        </div>

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Receipt Title and BID */}
        <div className="text-center mb-2">
          <p
            className="font-bold"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "11px" : "13px",
            }}
          >
            NOTA BOOKING
          </p>
          {booking.bid && (
            <p
              className="font-mono"
              style={{
                fontSize: printSettings?.paper_size === "58mm" ? "10px" : "12px",
              }}
            >
              No: {booking.bid}
            </p>
          )}
          <p
            className="text-gray-600"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "9px" : "10px",
            }}
          >
            {format(new Date(booking.created_at), "dd/MM/yyyy HH:mm", { locale: idLocale })}
          </p>
        </div>

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Customer Info */}
        <div
          className="mb-2"
          style={{
            fontSize: printSettings?.paper_size === "58mm" ? "9px" : "11px",
          }}
        >
          <div className="flex justify-between">
            <span>Pelanggan:</span>
            <span className="font-semibold text-right">{booking.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Telepon:</span>
            <span>{booking.phone}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="font-semibold">{getStatusLabel(booking.status)}</span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Booking Details */}
        <div
          className="mb-2"
          style={{
            fontSize: printSettings?.paper_size === "58mm" ? "9px" : "11px",
          }}
        >
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{format(new Date(booking.date), "dd MMMM yyyy", { locale: idLocale })}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</span>
          </div>
          <div className="flex justify-between">
            <span>Durasi:</span>
            <span>{booking.duration} jam</span>
          </div>
          <div className="flex justify-between">
            <span>Ruangan:</span>
            <span className="font-semibold">{booking.room_name}</span>
          </div>
          {booking.variant_name && (
            <div className="flex justify-between">
              <span>Paket:</span>
              <span>{booking.variant_name}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Items */}
        <div
          className="mb-2"
          style={{
            fontSize: printSettings?.paper_size === "58mm" ? "9px" : "11px",
          }}
        >
          <div className="flex justify-between mb-1">
            <span>Sewa Ruangan</span>
            <span>{formatCurrency(booking.price)}</span>
          </div>

          {/* Products */}
          {products.length > 0 && (
            <>
              {products.map((product, index) => (
                <div key={index} className="flex justify-between">
                  <span>{product.product_name} x{product.quantity}</span>
                  <span>{formatCurrency(product.subtotal)}</span>
                </div>
              ))}
            </>
          )}

          {/* Discount */}
          {calculateDiscount() > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>
                Diskon
                {booking.discount_type === "percent" ? ` (${booking.discount_value}%)` : ""}
              </span>
              <span>-{formatCurrency(calculateDiscount())}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Total */}
        <div
          className="mb-2 font-bold"
          style={{
            fontSize: printSettings?.paper_size === "58mm" ? "11px" : "13px",
          }}
        >
          <div className="flex justify-between">
            <span>TOTAL</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
        </div>

        {/* Payment Info */}
        {booking.payment_method && (
          <div
            className="mb-2"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "9px" : "11px",
            }}
          >
            <div className="flex justify-between">
              <span>Pembayaran:</span>
              <span>{booking.payment_method}</span>
            </div>
            {booking.reference_no && (
              <div className="flex justify-between">
                <span>Ref:</span>
                <span className="font-mono">{booking.reference_no}</span>
              </div>
            )}
            {booking.dual_payment && booking.payment_method_2 && (
              <>
                <div className="flex justify-between mt-1">
                  <span>Pembayaran 2:</span>
                  <span>{booking.payment_method_2}</span>
                </div>
                {booking.reference_no_2 && (
                  <div className="flex justify-between">
                    <span>Ref:</span>
                    <span className="font-mono">{booking.reference_no_2}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Note */}
        {booking.note && (
          <>
            <div
              className="border-t border-dashed border-gray-400 my-2"
              style={{ borderTopWidth: "1px" }}
            />
            <div
              style={{
                fontSize: printSettings?.paper_size === "58mm" ? "9px" : "10px",
              }}
            >
              <p className="text-gray-600">Catatan: {booking.note}</p>
            </div>
          </>
        )}

        {/* Divider */}
        <div
          className="border-t border-dashed border-gray-400 my-2"
          style={{ borderTopWidth: "1px" }}
        />

        {/* Manager Signature */}
        {printSettings?.show_manager_signature && printSettings?.manager_name && (
          <div
            className="text-center my-4"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "9px" : "11px",
            }}
          >
            <p className="mb-8">Hormat Kami,</p>
            <p className="border-t border-gray-400 pt-1 inline-block px-4">
              {printSettings.manager_name}
            </p>
            <p className="text-gray-600 text-xs">Manager</p>
          </div>
        )}

        {/* Footer */}
        {printSettings?.footer_text && (
          <div
            className="text-center text-gray-600 mt-3"
            style={{
              fontSize: printSettings?.paper_size === "58mm" ? "8px" : "10px",
            }}
          >
            <p>{printSettings.footer_text}</p>
          </div>
        )}

        {/* Powered by */}
        <div
          className="text-center text-gray-400 mt-2"
          style={{
            fontSize: printSettings?.paper_size === "58mm" ? "7px" : "8px",
          }}
        >
          <p>Powered by Treebox PMS</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: ${getPaperWidth()} auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
