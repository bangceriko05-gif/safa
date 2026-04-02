import { supabase } from "@/integrations/supabase/client";

interface AutoHutangParams {
  paymentMethod: string | null;
  amount: number;
  supplierName: string;
  description: string;
  storeId: string;
  userId: string;
  bid?: string | null;
}

/**
 * Automatically creates an accounts_payable entry when payment method is "Hutang".
 * Called after inserting a booking, expense, or income transaction.
 */
export async function createAutoHutang({
  paymentMethod,
  amount,
  supplierName,
  description,
  storeId,
  userId,
  bid,
}: AutoHutangParams) {
  if (!paymentMethod || paymentMethod.toLowerCase() !== "hutang") return;
  if (!amount || amount <= 0) return;

  try {
    const descWithBid = bid ? `${description} (${bid})` : description;
    await supabase.from("accounts_payable").insert({
      store_id: storeId,
      supplier_name: supplierName,
      description: descWithBid,
      amount,
      status: "unpaid",
      created_by: userId,
    });
  } catch (error) {
    console.error("Failed to auto-create hutang entry:", error);
  }
}
