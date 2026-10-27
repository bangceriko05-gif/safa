import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { dokuAdmin, dokuCredentials, dokuSignature } from "../_shared/doku.ts";

const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !authorization) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const parsed = z.object({ order_id: z.string().uuid(), channels: z.array(z.string().regex(/^[A-Z0-9_]+$/).max(100)).max(50).optional(), renew: z.boolean().optional() }).safeParse(await req.json());
    if (!parsed.success) return reply(400, { error: "Pilih transaksi yang akan dibayar." });
    const { data: order, error: orderError } = await client.from("booking_orders").select("id,store_id,total_amount,amount,amount_2,process_status,payment_status").eq("id", parsed.data.order_id).maybeSingle();
    if (orderError || !order) return reply(403, { error: "Anda tidak memiliki izin. Transaksi tidak ditemukan di outlet ini." });
    if (order.process_status === "batal" || order.payment_status === "lunas") return reply(400, { error: "Transaksi sudah lunas atau dibatalkan." });
    const { data: settings } = await client.from("website_payment_settings").select("doku_enabled,doku_environment,doku_client_id,doku_channels").eq("store_id", order.store_id).maybeSingle();
    if (!settings?.doku_enabled || !Array.isArray(settings.doku_channels) || !settings.doku_channels.length) return reply(400, { error: "DOKU belum aktif. Lengkapi pengaturan pembayaran outlet." });
    const credentials = await dokuCredentials(order.store_id, settings.doku_environment);
    if (!credentials || credentials.clientId !== settings.doku_client_id) return reply(400, { error: "Masukkan Secret Key DOKU untuk Client ID dan mode yang dipilih." });
    const enabledChannels = settings.doku_channels as string[];
    const channels = parsed.data.channels?.length ? parsed.data.channels : enabledChannels;
    if (channels.some((code) => !enabledChannels.includes(code))) return reply(400, { error: "Metode pembayaran DOKU yang dipilih tidak aktif untuk outlet ini." });
    const remaining = Number(order.total_amount) - Number(order.amount) - Number(order.amount_2);
    if (!Number.isSafeInteger(remaining) || remaining <= 0) return reply(400, { error: "Nominal pembayaran tidak sesuai. Periksa tagihan transaksi." });
    const admin = dokuAdmin();
    const { data: pending } = await admin.from("doku_payment_attempts").select("id,amount,checkout_url,created_at").eq("order_id", order.id).eq("status", "pending").maybeSingle();
    // QR DOKU berlaku 60 menit; tagihan kedaluwarsa (atau diminta baru) diganti invoice & QR baru.
    const expired = pending && Date.now() - new Date(pending.created_at).getTime() > 55 * 60 * 1000;
    if (pending && (expired || parsed.data.renew)) {
      await admin.from("doku_payment_attempts").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", pending.id).eq("status", "pending");
    } else if (pending) {
      if (Number(pending.amount) !== remaining) return reply(409, { error: "Tagihan DOKU sebelumnya masih menunggu pembayaran. Hubungi admin sebelum mengubah nominal." });
      if (pending.checkout_url) return reply(200, { checkout_url: pending.checkout_url });
      return reply(409, { error: "Tagihan DOKU sedang dibuat. Tunggu sebentar sebelum mencoba kembali." });
    }
    const invoice = `ANKA-${crypto.randomUUID()}`;
    const { data: attempt, error: insertError } = await admin.from("doku_payment_attempts").insert({ store_id: order.store_id, order_id: order.id, invoice_number: invoice, environment: credentials.environment, client_id: credentials.clientId, amount: remaining }).select("id").single();
    if (insertError || !attempt) return reply(409, { error: "Tagihan DOKU sedang dibuat. Tunggu sebentar sebelum mencoba kembali." });
    const target = "/checkout/v1/payment";
    const body = JSON.stringify({ order: { amount: remaining, invoice_number: invoice }, payment: { payment_method_types: channels, payment_due_date: 60 } });
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const signature = await dokuSignature(credentials.secret, credentials.clientId, requestId, timestamp, target, body);
    const response = await fetch(`${credentials.environment === "live" ? "https://api.doku.com" : "https://api-sandbox.doku.com"}${target}`, { method: "POST", headers: { "Content-Type": "application/json", "Client-Id": credentials.clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, Signature: signature }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      await admin.from("doku_payment_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending");
      return reply(response.status, { error: "DOKU menolak pembuatan tagihan. Periksa kredensial, mode, dan metode pembayaran pada akun DOKU.", status: response.status });
    }
    const checkoutUrl = result?.response?.payment?.url;
    if (typeof checkoutUrl !== "string") return reply(502, { error: "Alamat pembayaran belum diterima dari DOKU. Hubungi admin sebelum mencoba lagi." });
    const destination = new URL(checkoutUrl);
    if (destination.protocol !== "https:" || !(destination.hostname === "doku.com" || destination.hostname.endsWith(".doku.com"))) return reply(502, { error: "Alamat pembayaran DOKU tidak dapat diverifikasi." });
    const { error: updateError } = await admin.from("doku_payment_attempts").update({ checkout_url: checkoutUrl }).eq("id", attempt.id);
    if (updateError) throw updateError;
    return reply(200, { checkout_url: checkoutUrl });
  } catch { return reply(500, { error: "Tagihan DOKU belum dapat dibuat. Silakan coba lagi atau hubungi admin." }); }
});