import { supabase } from "@/integrations/supabase/client";

export interface BillingRoom {
  id: string;
  store_id: string | null;
  booking_group_id?: string | null;
  room_id: string;
  variant_id?: string | null;
  variant_price_override?: number | null;
  duration: number;
  price: number;
  price_2?: number | null;
  dual_payment?: boolean | null;
  payment_method?: string | null;
  payment_method_2?: string | null;
  reference_no?: string | null;
  reference_no_2?: string | null;
  payment_proof_url?: string | null;
  payment_proof_url_2?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_applies_to?: string | null;
  ota_source?: string | null;
  ota_booking_id?: string | null;
  status?: string | null;
  rooms?: { name: string } | null;
  room_variants?: { price: number; variant_name: string; booking_duration_type: string | null; booking_duration_value: number | null } | null;
}

export function billingOwner(rooms: BillingRoom[]) {
  return [...rooms].sort((a, b) => {
    const score = (r: BillingRoom) => (r.payment_proof_url ? 8 : 0) + (r.payment_method ? 4 : 0) + (r.price > 0 ? 2 : 0) + ((r.discount_value || 0) > 0 ? 1 : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0];
}

export function billingRoomTotal(room: BillingRoom) {
  if (room.ota_source || room.ota_booking_id) return room.variant_price_override != null ? Number(room.variant_price_override) * room.duration : Number(room.price) || 0;
  const rate = room.variant_price_override ?? room.room_variants?.price;
  const unit = room.room_variants?.booking_duration_type;
  const multiplier = unit === "months" || unit === "weeks" ? room.room_variants?.booking_duration_value || 1 : room.duration;
  return rate == null ? Number(room.price) || 0 : Number(rate) * multiplier;
}

export function groupBillingTotals(rooms: BillingRoom[], productTotal = 0) {
  const owner = billingOwner(rooms);
  const roomTotal = rooms.filter(r => r.status !== "BATAL").reduce((sum, room) => sum + billingRoomTotal(room), 0);
  const paid1 = rooms.reduce((sum, room) => sum + Number(room.price || 0), 0);
  const paid2 = rooms.reduce((sum, room) => sum + (room.dual_payment ? Number(room.price_2 || 0) : 0), 0);
  const value = Number(owner?.discount_value || 0);
  const base = owner?.discount_applies_to === "product" ? productTotal : owner?.discount_applies_to === "all" ? roomTotal + productTotal : roomTotal;
  const discount = Math.min(roomTotal + productTotal, owner?.discount_type === "percent" || owner?.discount_type === "percentage" ? Math.round(base * value / 100) : value);
  const total = Math.max(0, roomTotal + productTotal - discount);
  return { owner, roomTotal, productTotal, discount, total, paid1, paid2, paid: paid1 + paid2, remaining: total - paid1 - paid2 };
}

export async function fetchGroupBilling(booking: { id: string; store_id?: string | null; booking_group_id?: string | null }) {
  let query = supabase.from("bookings").select("*, rooms(name), room_variants(price, variant_name, booking_duration_type, booking_duration_value)");
  query = booking.booking_group_id ? query.eq("booking_group_id", booking.booking_group_id) : query.eq("id", booking.id);
  if (booking.store_id) query = query.eq("store_id", booking.store_id);
  const { data, error } = await query;
  if (error) throw error;
  const rooms = (data || []) as BillingRoom[];
  const ids = rooms.map(room => room.id);
  const { data: products, error: productError } = await supabase.from("booking_products").select("*").in("booking_id", ids.length ? ids : [booking.id]);
  if (productError) throw productError;
  return { rooms, products: products || [], totals: groupBillingTotals(rooms, (products || []).reduce((sum, p) => sum + Number(p.subtotal || 0), 0)) };
}