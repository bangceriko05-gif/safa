import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { dokuAdmin, dokuCredentials, dokuGetSignature } from "../_shared/doku.ts";
import { isMatchingDokuPayment, parseDokuRemotePayment } from "../_shared/dokuStatus.ts";

const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Gunakan pemeriksaan status pembayaran." });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !authorization) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const parsed = z.object({ invoice_number: z.string().min(5).max(128).regex(/^[A-Za-z0-9-]+$/) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: "Nomor invoice pembayaran tidak valid." });

    const admin = dokuAdmin();
    const { data: orderAttempt, error: orderLookupError } = await admin.from("doku_payment_attempts").select("id,order_id,store_id,amount,status,client_id,environment,invoice_number,paid_at").eq("invoice_number", parsed.data.invoice_number).maybeSingle();
    if (orderLookupError) throw orderLookupError;
    const { data: bookingAttempt, error: bookingLookupError } = orderAttempt ? { data: null, error: null } : await admin.from("doku_booking_attempts").select("id,booking_id,store_id,amount,status,client_id,environment,invoice_number,paid_at").eq("invoice_number", parsed.data.invoice_number).maybeSingle();
    if (bookingLookupError) throw bookingLookupError;
    const attempt = orderAttempt || bookingAttempt;
    if (!attempt) return reply(404, { error: "Transaksi DOKU tidak ditemukan." });
    const source = orderAttempt ? "order" : "booking";
    const transactionId = orderAttempt?.order_id || bookingAttempt?.booking_id;
    const table = orderAttempt ? "booking_orders" : "bookings";
    const { data: transaction, error: accessError } = await client.from(table).select("id,payment_status").eq("id", transactionId).eq("store_id", attempt.store_id).maybeSingle();
    if (accessError || !transaction) return reply(403, { error: "Anda tidak memiliki izin untuk transaksi di outlet ini." });

    const credentials = await dokuCredentials(attempt.store_id, attempt.environment);
    if (!credentials || credentials.clientId !== attempt.client_id) return reply(400, { error: "Kredensial DOKU outlet belum sesuai. Periksa Pengaturan DOKU." });

    const target = `/orders/v1/status/${encodeURIComponent(attempt.invoice_number)}`;
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const signature = await dokuGetSignature(credentials.secret, credentials.clientId, requestId, timestamp, target);
    const response = await fetch(`${credentials.environment === "live" ? "https://api.doku.com" : "https://api-sandbox.doku.com"}${target}`, {
      method: "GET",
      headers: { "Client-Id": credentials.clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, Signature: signature },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("DOKU status refused", response.status, JSON.stringify(result));
      return reply(502, { error: "Status pembayaran belum dapat dibaca dari DOKU. Silakan coba lagi." });
    }
    const payment = parseDokuRemotePayment(result);
    if (!payment || !isMatchingDokuPayment(payment, attempt.invoice_number, Number(attempt.amount))) return reply(502, { error: "Data status DOKU tidak sesuai dengan invoice atau nominal transaksi." });

    if (payment.status === "SUCCESS") {
      const { error: settleError } = await admin.rpc("reconcile_doku_payment", { p_source: source, p_attempt_id: attempt.id, p_amount: payment.amount, p_channel: payment.channel || "QRIS", p_transaction_at: payment.transactionAt });
      if (settleError) {
        console.error("DOKU settlement failed", attempt.invoice_number, settleError.message);
        return reply(409, { error: "Pembayaran sudah diterima DOKU, tetapi status transaksi belum dapat diperbarui. Silakan coba lagi." });
      }
      const { data: fresh } = await client.from(table).select("payment_status").eq("id", transactionId).eq("store_id", attempt.store_id).maybeSingle();
      const { data: settledAttempt } = await admin.from(source === "booking" ? "doku_booking_attempts" : "doku_payment_attempts").select("paid_at").eq("id", attempt.id).single();
      return reply(200, { status: "success", payment_status: fresh?.payment_status || transaction.payment_status, channel: payment.channel, paid_at: settledAttempt?.paid_at || null, transaction_at: payment.transactionAt });
    }

    // Never downgrade settled money based on an older channel attempt.
    if (attempt.status === "success") return reply(409, { error: "Status DOKU berbeda dari pembayaran yang sudah tercatat. Hubungi pengelola untuk pemeriksaan." });
    const status = payment.status.toLowerCase();
    const { error: updateError } = await admin.from(source === "booking" ? "doku_booking_attempts" : "doku_payment_attempts")
      .update({ status, channel: payment.channel, transaction_at: payment.transactionAt, updated_at: new Date().toISOString(),
        ...(status === "pending" && attempt.status === "expired" ? { superseded_at: new Date().toISOString() } : {}),
      }).eq("id", attempt.id).neq("status", "success");
    if (updateError) throw updateError;
    return reply(200, { status, payment_status: transaction.payment_status, channel: payment.channel, transaction_at: payment.transactionAt });
  } catch (error) {
    console.error("DOKU reconciliation failed", error instanceof Error ? error.message : "Unknown error");
    return reply(500, { error: "Status pembayaran belum dapat disinkronkan. Silakan coba lagi." });
  }
});
