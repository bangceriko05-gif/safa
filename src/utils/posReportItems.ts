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
  }[];
}

/** Item history does not require a live product or an item-to-product foreign key. */
export function mapPosReportItems(orders: PosReportOrder[], costs: ReadonlyMap<string, number>) {
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
        purchase_price: item.product_id ? costs.get(item.product_id) || 0 : 0,
      }));
    });
}