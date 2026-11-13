import { dokuGroupForMethod } from "./dokuChannels";

export function bookingPaymentProofRequired(method: string | null | undefined): boolean {
  return !dokuGroupForMethod(method || "");
}

export function bookingPaymentProofMissing(method: string | null | undefined, proof: string | null | undefined): boolean {
  return bookingPaymentProofRequired(method) && !proof;
}

export function unpaidBookingQris(roomTotal: number, duration: number, ota: boolean) {
  return {
    price: 0,
    price_2: null,
    payment_status: "belum_lunas",
    payment_proof_url: null,
    ...(ota ? { variant_price_override: roomTotal / Math.max(1, duration) } : {}),
  };
}