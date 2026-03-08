import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DemoNotificationRequest {
  fullName: string;
  email: string;
  whatsapp: string;
  roomCount: string;
  hotelName: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const NOTIFICATION_EMAIL = Deno.env.get("DEMO_NOTIFICATION_EMAIL");
    if (!NOTIFICATION_EMAIL) {
      throw new Error("DEMO_NOTIFICATION_EMAIL is not configured");
    }

    const resend = new Resend(RESEND_API_KEY);
    const body: DemoNotificationRequest = await req.json();
    const { fullName, email, whatsapp, roomCount, hotelName } = body;

    console.log("Sending demo notification for:", fullName);

    const { error } = await resend.emails.send({
      from: "Anka PMS <onboarding@resend.dev>",
      to: [NOTIFICATION_EMAIL],
      subject: `📋 Demo Request Baru: ${fullName} - ${hotelName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            📋 Permintaan Demo Baru
          </h1>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #2563eb; margin-top: 0;">Detail Calon Pelanggan</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Nama Lengkap:</td>
                <td style="padding: 8px 0; font-weight: bold;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Nama Hotel:</td>
                <td style="padding: 8px 0; font-weight: bold;">${hotelName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Email:</td>
                <td style="padding: 8px 0; font-weight: bold;">
                  <a href="mailto:${email}">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">WhatsApp:</td>
                <td style="padding: 8px 0; font-weight: bold;">
                  <a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}">${whatsapp}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Jumlah Kamar:</td>
                <td style="padding: 8px 0; font-weight: bold;">${roomCount}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Segera hubungi calon pelanggan ini untuk menjadwalkan demo.
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
            Email ini dikirim otomatis oleh sistem Anka PMS.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
