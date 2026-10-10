interface BookingPaymentCaptionData {
  payment_status?: string | null;
  price?: number | null;
  price_2?: number | null;
  dual_payment?: boolean | null;
  payment_method?: string | null;
  payment_method_2?: string | null;
}

/** Display only methods associated with money received, without changing payment status. */
export function bookingPaymentCaption(booking: BookingPaymentCaptionData): string {
  const methods: string[] = [];
  const addMethod = (amount: number | null | undefined, method: string | null | undefined) => {
    if (Number(amount || 0) <= 0 || !method?.trim()) return;
    const label = method.trim();
    if (!methods.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      methods.push(label);
    }
  };
  addMethod(booking.price, booking.payment_method);
  if (booking.dual_payment) addMethod(booking.price_2, booking.payment_method_2);
  if (methods.length === 0) return " nun";
  return `${booking.payment_status === "lunas" ? " " : "+"}${methods.join("+")}`;
}