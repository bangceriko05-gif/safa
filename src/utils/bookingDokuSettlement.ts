export interface BookingDokuReceipt {
  invoiceNumber: string;
  amount: number;
  fullyPaid: boolean;
}

export function matchesBookingDokuSettlement(
  expected: { bookingId: string; storeId: string; invoiceNumber: string; amount: number },
  attempt: { booking_id: string; store_id: string; invoice_number: string; amount: number; status: string } | null,
  owner: { id: string; store_id: string | null; price: number; reference_no?: string | null; price_2?: number | null; reference_no_2?: string | null; dual_payment?: boolean | null } | null | undefined,
) {
  return Boolean(attempt && owner && expected.amount > 0 &&
    attempt.status === "success" && attempt.booking_id === expected.bookingId &&
    attempt.store_id === expected.storeId && attempt.invoice_number === expected.invoiceNumber &&
    Number(attempt.amount) === expected.amount && owner.id === expected.bookingId &&
    owner.store_id === expected.storeId && (
      (owner.reference_no === expected.invoiceNumber && Number(owner.price) === expected.amount) ||
      (owner.dual_payment === true && owner.reference_no_2 === expected.invoiceNumber && Number(owner.price_2) >= expected.amount)
    ));
}