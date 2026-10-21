import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { dokuCredentials } from "../_shared/doku.ts";

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
    const parsed = z.object({ store_id: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return reply(400, { error: "Pilih outlet terlebih dahulu." });
    const { data: settings, error: readError } = await client.from("website_payment_settings").select("doku_client_id,doku_environment").eq("store_id", parsed.data.store_id).maybeSingle();
    if (readError) throw readError;
    const credentials = dokuCredentials();
    return reply(200, { configured: !!credentials && settings?.doku_client_id === credentials.clientId && settings?.doku_environment === credentials.environment });
  } catch { return reply(500, { error: "Koneksi DOKU belum dapat diperiksa. Silakan coba lagi." }); }
});