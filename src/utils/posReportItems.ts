export interface PosReportOrder {
  id: string;
  bid: string | null;
  date: string;
  customer_name: string | null;
  payment_method: string | null;
  payment_proof_urls: unknown;
  process_status: string | null;
  booking_order_items: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    subtotal: number;
    unit_cost: number | null;
  }[];
}

/** Historical reports use the selling amount and HPP captured on each saved line. */
export function mapPosReportItems(orders: PosReportOrder[]) {
  return orders
    .filter(order => (order.process_status || "").toLowerCase() !== "batal")
    .flatMap(order => {
      const proofs = Array.isArray(order.payment_proof_urls) ? order.payment_proof_urls : [];
      return (order.booking_order_items || []).map(item => ({
        id: item.id,
        order_id: order.id,
        bid: order.bid || "-",
        date: order.date,
        customer_name: order.customer_name || "Walk-in POS",
        payment_method: order.payment_method || "",
        proof_url: proofs.length ? String(proofs[0]) : null,
        product_name: item.product_name,
        quantity: Number(item.quantity) || 0,
        subtotal: Number(item.subtotal) || 0,
        purchase_price: item.unit_cost == null ? 0 : Number(item.unit_cost),
      }));
    });
}
