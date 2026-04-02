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

interface ResolveHutangParams {
  previousPaymentMethod: string | null;
  newPaymentMethod: string | null;
  bid: string | null;
  storeId: string;
}

/**
 * When payment method changes FROM "Hutang" to something else,
 * automatically mark the corresponding accounts_payable entry as paid.
 */
export async function resolveHutangIfChanged({
  previousPaymentMethod,
  newPaymentMethod,
  bid,
  storeId,
}: ResolveHutangParams) {
  if (!previousPaymentMethod || previousPaymentMethod.toLowerCase() !== "hutang") return;
  if (!newPaymentMethod || newPaymentMethod.toLowerCase() === "hutang") return;
  if (!bid) return;

  try {
    // Find accounts_payable entries whose description contains the BID
    const { data: payables } = await supabase
      .from("accounts_payable")
      .select("id, amount")
      .eq("store_id", storeId)
      .ilike("description", `%${bid}%`)
      .in("status", ["unpaid", "partial"]);

    if (payables && payables.length > 0) {
      for (const payable of payables) {
        await supabase
          .from("accounts_payable")
          .update({
            status: "paid",
            paid_amount: payable.amount,
          })
          .eq("id", payable.id);
      }
    }
  } catch (error) {
    console.error("Failed to resolve hutang entry:", error);
  }
}

interface HandleHutangChangeParams {
  previousPaymentMethod: string | null;
  newPaymentMethod: string | null;
  amount: number;
  supplierName: string;
  description: string;
  storeId: string;
  userId: string;
  bid: string | null;
}

/**
 * Handles both creating and resolving hutang on edit.
 * - If changed TO hutang: create new entry
 * - If changed FROM hutang: mark as paid
 */
export async function handleHutangOnEdit({
  previousPaymentMethod,
  newPaymentMethod,
  amount,
  supplierName,
  description,
  storeId,
  userId,
  bid,
}: HandleHutangChangeParams) {
  const wasPrevHutang = previousPaymentMethod?.toLowerCase() === "hutang";
  const isNowHutang = newPaymentMethod?.toLowerCase() === "hutang";

  // Changed FROM hutang to something else → mark as paid
  if (wasPrevHutang && !isNowHutang) {
    await resolveHutangIfChanged({
      previousPaymentMethod,
      newPaymentMethod,
      bid,
      storeId,
    });
  }

  // Changed TO hutang from something else → create new entry
  if (!wasPrevHutang && isNowHutang) {
    await createAutoHutang({
      paymentMethod: newPaymentMethod,
      amount,
      supplierName,
      description,
      storeId,
      userId,
      bid,
    });
  }
}
