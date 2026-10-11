interface SalesBooking {
  price: number;
  price_2: number;
  dual_payment?: boolean;
  duration: number;
  variant_price_override?: number | null;
  booking_duration_type?: string;
  booking_duration_value?: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_applies_to: string | null;
}

export function salesBookingTotals(booking: SalesBooking, productTotal = 0) {
  const paid = (Number(booking.price) || 0) + (booking.dual_payment ? Number(booking.price_2) || 0 : 0);
  const rate = booking.variant_price_override;
  const value = Math.max(0, Number(booking.discount_value) || 0);
  const percent = booking.discount_type === "percent" || booking.discount_type === "percentage";
  // Legacy/OTA rows without a room snapshot have only received payments available.
  const fallbackGross = percent && value < 100 ? paid / (1 - value / 100) : paid + (percent ? 0 : value);
  const multiplier = booking.booking_duration_type === "months" || booking.booking_duration_type === "weeks"
    ? booking.booking_duration_value || 1 : booking.duration;
  const roomTotal = rate != null ? Number(rate) * multiplier : Math.max(0, fallbackGross - productTotal);
  const gross = roomTotal + productTotal;
  const discountBase = booking.discount_applies_to === "product" ? productTotal : booking.discount_applies_to === "all" ? gross : roomTotal;
  const discount = Math.min(gross, percent ? Math.round(discountBase * value / 100) : value);
  return { roomTotal, gross, discount, paid, net: Math.max(0, gross - discount) };
}