import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { dokuAdmin, dokuCredentials, dokuSignature, signaturesEqual } from "../_shared/doku.ts";

const notification = z.object({
  order: z.object({ invoice_number: z.string().min(1).max(128), amount: z.coerce.number().int().positive() }),
  transaction: z.object({ status: z.string().max(40) }),
  channel: z.object({ id: z.string().max(100) }).optional(),
});
const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, "Gunakan notifikasi pembayaran DOKU.");
  try {
    if (Number(req.headers.get("content-length")) > 65536) return reply(413, "Notifikasi terlalu besar.");
    const raw = await req.text();
    if (raw.length > 65536) return reply(413, "Notifikasi terlalu besar.");
    const clientId = req.headers.get("Client-Id");
    const requestId = req.headers.get("Request-Id");
    const timestamp = req.headers.get("Request-Timestamp");
    const signature = req.headers.get("Signature");
    if (!clientId || !requestId || !timestamp || !signature) return reply(401, "Notifikasi pembayaran tidak dapat diverifikasi.");
    const parsed = notification.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply(400, "Data notifikasi pembayaran tidak lengkap.");
    const admin = dokuAdmin();
    const { data: attempt, error } = await admin.from("doku_payment_attempts").select("id,store_id,amount,client_id,environment,status").eq("invoice_number", parsed.data.order.invoice_number).maybeSingle();
    if (error) throw error;
    if (!attempt || attempt.client_id !== clientId || Number(attempt.amount) !== parsed.data.order.amount) return reply(400, "Tagihan atau nominal pembayaran tidak sesuai.");
    const credentials = await dokuCredentials(attempt.store_id, attempt.environment);
    if (!credentials || credentials.clientId !== clientId) return reply(401, "Notifikasi pembayaran tidak dapat diverifikasi.");
    const expected = await dokuSignature(credentials.secret, clientId, requestId, timestamp, "/functions/v1/doku-webhook", raw);
    if (!signaturesEqual(expected, signature)) return reply(401, "Notifikasi pembayaran tidak dapat diverifikasi.");
    if (parsed.data.transaction.status === "SUCCESS") {
      const { error: settleError } = await admin.rpc("settle_doku_order", { p_attempt_id: attempt.id, p_amount: parsed.data.order.amount, p_channel: parsed.data.channel?.id || "Checkout" });
      if (settleError) throw settleError;
    }
    // Only SUCCESS changes financial state. Failed channel attempts can be retried on the same invoice.
    return reply(200, "Notifikasi diterima.");
  } catch {
    return reply(500, "Notifikasi belum berhasil diproses. Silakan kirim ulang.");
  }
});