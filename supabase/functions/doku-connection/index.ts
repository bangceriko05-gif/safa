import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { dokuAdmin, encryptDokuSecret } from "../_shared/doku.ts";

const bodySchema = z.object({
  store_id: z.string().uuid(), action: z.enum(["status", "save", "delete"]).default("status"),
  environment: z.enum(["sandbox", "live"]).optional(), client_id: z.string().trim().max(128).optional(),
  secret_key: z.string().trim().max(512).optional(), enabled: z.boolean().optional(),
  channels: z.array(z.string().regex(/^[A-Z0-9_]+$/).max(100)).max(50).optional(),
});

const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !authorization) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return reply(401, { error: "Sesi Anda sudah berakhir. Silakan masuk kembali." });
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return reply(400, { error: "Pilih outlet terlebih dahulu." });
    const input = parsed.data;
    const { data: allowed } = await client.rpc("is_store_admin", { _user_id: user.id, _store_id: input.store_id });
    if (!allowed) return reply(403, { error: "Anda tidak memiliki izin. Hubungi admin outlet untuk mengatur DOKU." });
    const admin = dokuAdmin();
    if (input.action === "delete") {
      const { data: current } = await client.from("website_payment_settings").select("doku_environment").eq("store_id", input.store_id).maybeSingle();
      const environment = input.environment || current?.doku_environment || "sandbox";
      const { error: deleteError } = await admin.from("doku_outlet_credentials").delete().eq("store_id", input.store_id).eq("environment", environment);
      if (deleteError) throw deleteError;
      const { error: resetError } = await admin.from("website_payment_settings").update({ doku_enabled: false, doku_client_id: "", doku_channels: [] }).eq("store_id", input.store_id);
      if (resetError) throw resetError;
      return reply(200, { deleted: true, configured: false });
    }
    if (input.action === "save") {
      if (!input.environment || input.enabled === undefined || !input.channels || (input.enabled && (!input.client_id || input.channels.length === 0))) {
        return reply(400, { error: "Lengkapi Client ID dan pilih minimal satu metode pembayaran DOKU." });
      }
      const { data: existing, error: existingError } = await admin.from("doku_outlet_credentials").select("client_id").eq("store_id", input.store_id).eq("environment", input.environment).maybeSingle();
      if (existingError) throw existingError;
      if (input.enabled && !input.secret_key && existing?.client_id !== input.client_id) return reply(400, { error: "Masukkan Secret Key DOKU untuk Client ID dan mode yang dipilih." });
      if (input.secret_key && (!input.client_id || input.secret_key.length < 8)) return reply(400, { error: "Client ID atau Secret Key belum lengkap. Salin kembali dari akun DOKU." });
      const ciphertext = input.secret_key ? await encryptDokuSecret(input.secret_key) : null;
      const { error: saveError } = await admin.rpc("save_doku_outlet_settings", {
        p_store_id: input.store_id, p_environment: input.environment, p_client_id: input.client_id || "",
        p_ciphertext: ciphertext, p_enabled: input.enabled, p_channels: input.channels,
      });
      if (saveError) throw saveError;
      return reply(200, { saved: true, configured: !!ciphertext || existing?.client_id === input.client_id });
    }
    const { data: settings, error: readError } = await client.from("website_payment_settings").select("doku_client_id,doku_environment").eq("store_id", parsed.data.store_id).maybeSingle();
    if (readError) throw readError;
    const { data: credential } = await admin.from("doku_outlet_credentials").select("client_id").eq("store_id", input.store_id).eq("environment", settings?.doku_environment || "sandbox").maybeSingle();
    return reply(200, { configured: !!credential && credential.client_id === settings?.doku_client_id });
  } catch { return reply(500, { error: "Koneksi DOKU belum dapat diperiksa. Silakan coba lagi." }); }
});