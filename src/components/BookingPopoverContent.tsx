import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Edit, Trash2, User, Phone, ChevronDown, Copy, Undo, Loader2, Shield, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookingPopoverContentProps {
  booking: any;
  nights: number;
  status: string;
  statusColor: string;
  statusColors: Record<string, string>;
  updatingStatus: string | null;
  userRole: string | null;
  hasPermission: (perm: string) => boolean;
  getStatusLabel: (s: string) => string;
  getAvailableStatuses: (s: string) => string[];
  onStatusChange: (bookingId: string, newStatus: string, booking: any) => void;
  onEditBooking: (booking: any) => void;
  onDeleteBooking: (bookingId: string) => void;
  addDays: (date: Date, days: number) => Date;
}

interface BookingProduct {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

export default function BookingPopoverContent({
  booking,
  nights,
  status,
  statusColor,
  statusColors,
  updatingStatus,
  userRole,
  hasPermission,
  getStatusLabel,
  getAvailableStatuses,
  onStatusChange,
  onEditBooking,
  onDeleteBooking,
  addDays,
}: BookingPopoverContentProps) {
  const [products, setProducts] = useState<BookingProduct[]>([]);
  const [variantPrice, setVariantPrice] = useState<number | null>(null);
  const [variantDurationType, setVariantDurationType] = useState<string | null>(null);
  const [variantDurationValue, setVariantDurationValue] = useState<number | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    fetchPaymentDetails();
  }, [booking.id]);

  const fetchPaymentDetails = async () => {
    setLoadingDetails(true);
    try {
      // Fetch products and variant price in parallel
      const [productsResult, variantResult] = await Promise.all([
        supabase
          .from("booking_products")
          .select("id, product_name, quantity, product_price, subtotal")
          .eq("booking_id", booking.id),
        booking.variant_id
          ? supabase
              .from("room_variants")
              .select("price, booking_duration_type, booking_duration_value")
              .eq("id", booking.variant_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      setProducts(productsResult.data || []);
      if (variantResult.data && "price" in variantResult.data) {
        setVariantPrice(variantResult.data.price);
        setVariantDurationType((variantResult.data as any).booking_duration_type || "hours");
        setVariantDurationValue((variantResult.data as any).booking_duration_value || 1);
      }
    } catch (error) {
      console.error("Error fetching payment details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate financial breakdown
  // For monthly/weekly variants, price is per unit (per month/week), not per day
  const roomSubtotal = variantPrice
    ? (variantDurationType === "months" || variantDurationType === "weeks")
      ? variantPrice * (variantDurationValue || 1)
      : variantPrice * booking.duration
    : booking.price; // fallback for OTA
  const productTotal = products.reduce((sum, p) => sum + p.subtotal, 0);

  let discountAmount = 0;
  if (booking.discount_value && booking.discount_value > 0) {
    if (booking.discount_type === "percent" || booking.discount_type === "percentage") {
      const base = booking.discount_applies_to === "product" ? productTotal : roomSubtotal;
      discountAmount = Math.round(base * (booking.discount_value / 100));
    } else {
      discountAmount = booking.discount_value;
    }
  }

  const grandTotal = roomSubtotal + productTotal - discountAmount;
  const totalPaid =
    (booking.price || 0) +
    (booking.dual_payment && booking.price_2 ? booking.price_2 : 0);
  const remaining = grandTotal - totalPaid;
  const isLunas = booking.payment_status === "lunas";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg">Detail Booking</h3>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-primary"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/receipt?id=${booking.id}`, '_blank');
            }}
            title="Print Receipt"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
        {getAvailableStatuses(status).length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={updatingStatus === booking.id}
                className="gap-1 font-semibold h-7 px-2"
                style={{
                  backgroundColor: statusColor,
                  color: status === "CO" || status === "BATAL" ? "#fff" : "#000",
                  borderColor: statusColor,
                }}
              >
                {updatingStatus === booking.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    {status}
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-[100]">
              {getAvailableStatuses(status).map((newStatus) => (
                <DropdownMenuItem
                  key={newStatus}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(booking.id, newStatus, booking);
                  }}
                  className={newStatus === "BATAL" ? "text-destructive" : ""}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: statusColors[newStatus] || "#ccc" }}
                  />
                  {getStatusLabel(newStatus)}
                </DropdownMenuItem>
              ))}
              {userRole === "admin" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(booking.id, "BO", booking);
                  }}
                  className="text-muted-foreground"
                >
                  <Undo className="h-3 w-3 mr-2" />
                  Reset ke Reservasi
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{
              backgroundColor: statusColor,
              color: status === "CO" || status === "BATAL" ? "#fff" : "#000",
            }}
          >
            {status}
          </div>
        )}
      </div>

      {/* Booking ID */}
      {booking.bid && (
        <div className="bg-muted/50 px-3 py-2 rounded">
          <p className="text-xs text-muted-foreground">Booking ID</p>
          <div className="flex items-center justify-between">
            <p className="font-mono font-bold text-primary">{booking.bid}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(booking.bid || "");
                toast.success("BID berhasil disalin");
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Customer & Booking Info */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Nama Tamu</p>
            <p className="font-semibold">{booking.customer_name}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Phone className="w-4 h-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">No. Telepon</p>
            <p className="font-medium">{booking.phone || "-"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Check-in</p>
            <p className="font-medium text-sm">
              {format(new Date(booking.date), "dd MMM yyyy", { locale: idLocale })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Check-out</p>
            <p className="font-medium text-sm">
              {format(addDays(new Date(booking.date), nights), "dd MMM yyyy", {
                locale: idLocale,
              })}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Durasi</p>
          <p className="font-medium">{nights} malam</p>
        </div>

        {booking.note && (
          <div>
            <p className="text-xs text-muted-foreground">Catatan</p>
            <p className="font-medium text-sm">{booking.note}</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Payment Details */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Detail Pembayaran</h4>

        {loadingDetails ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
            {/* Room Price */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga Kamar</span>
              <span>{formatCurrency(roomSubtotal)}</span>
            </div>

            {/* Products */}
            {products.length > 0 && (
              <>
                {products.map((product) => (
                  <div key={product.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {product.product_name} x{product.quantity}
                    </span>
                    <span>{formatCurrency(product.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Produk</span>
                  <span>{formatCurrency(productTotal)}</span>
                </div>
              </>
            )}

            {/* Discount */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>
                  Diskon{" "}
                  {(booking.discount_type === "percent" || booking.discount_type === "percentage")
                    ? `(${booking.discount_value}%)`
                    : ""}
                </span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}

            <Separator className="my-1" />

            {/* Grand Total */}
            <div className="flex justify-between font-semibold">
              <span>Total Keseluruhan</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>

            <Separator className="my-1" />

            {/* Payment 1 */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {booking.dual_payment ? "Pembayaran 1" : "Total Bayar"}
              </span>
              <span>{formatCurrency(booking.price)}</span>
            </div>
            {booking.payment_method && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Metode</span>
                <span>
                  {booking.payment_method}{" "}
                  {booking.reference_no && booking.reference_no !== "-"
                    ? `(${booking.reference_no})`
                    : ""}
                </span>
              </div>
            )}

            {/* Payment 2 */}
            {booking.dual_payment && (
              <>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Pembayaran 2</span>
                  <span>
                    {booking.price_2 ? formatCurrency(booking.price_2) : formatCurrency(0)}
                  </span>
                </div>
                {booking.payment_method_2 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Metode</span>
                    <span>
                      {booking.payment_method_2}{" "}
                      {booking.reference_no_2 ? `(${booking.reference_no_2})` : ""}
                    </span>
                  </div>
                )}

                <Separator className="my-1" />

                <div className="flex justify-between font-semibold">
                  <span>Total Dibayar</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>
              </>
            )}

            {/* Remaining */}
            {remaining > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Sisa Pembayaran</span>
                <span>{formatCurrency(remaining)}</span>
              </div>
            )}

            {/* Payment Status Badge */}
            <div
              className={cn(
                "text-center py-1.5 mt-1.5 rounded-md font-bold text-sm",
                isLunas
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {isLunas ? "✓ LUNAS" : "✕ BELUM LUNAS"}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t">
        {hasPermission("edit_bookings") &&
          (status !== "BATAL" || userRole === "admin") && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onEditBooking(booking)}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        {hasPermission("delete_bookings") &&
          (status !== "BATAL" || userRole === "admin") && (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onDeleteBooking(booking.id)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Hapus
            </Button>
          )}
        {status === "BATAL" && userRole !== "admin" && (
          <div className="flex-1 text-center text-sm text-muted-foreground py-2">
            Booking dibatalkan
          </div>
        )}
      </div>
    </div>
  );
}
