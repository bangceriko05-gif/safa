import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  bookingRequestId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  categoryName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  paymentMethod: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received booking notification request");
    
    const body: BookingNotificationRequest = await req.json();
    console.log("Request body:", body);

    const {
      bookingRequestId,
      storeId,
      customerName,
      customerPhone,
      categoryName,
      bookingDate,
      startTime,
      endTime,
      totalPrice,
      paymentMethod,
    } = body;

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get store info
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError) {
      console.error("Error fetching store:", storeError);
    }

    const storeName = store?.name || "Unknown Store";

    // Get admin emails for this store
    const { data: adminAccess, error: accessError } = await supabase
      .from("user_store_access")
      .select("user_id")
      .eq("store_id", storeId)
      .in("role", ["super_admin", "admin"]);

    if (accessError) {
      console.error("Error fetching admin access:", accessError);
      throw new Error("Failed to fetch admin access");
    }

    if (!adminAccess || adminAccess.length === 0) {
      console.log("No admins found for store:", storeId);
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails and notification preferences
    const adminUserIds = adminAccess.map((a) => a.user_id);
    
    // Get profiles with notification preferences
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw new Error("Failed to fetch admin profiles");
    }

    // Get notification preferences for all admins
    const { data: notifPrefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, email_new_booking")
      .in("user_id", adminUserIds);

    if (prefsError) {
      console.error("Error fetching notification preferences:", prefsError);
      // Continue anyway - default to sending emails
    }

    // Create a map of user preferences
    const prefsMap = new Map<string, boolean>();
    notifPrefs?.forEach((pref) => {
      prefsMap.set(pref.user_id, pref.email_new_booking);
    });

    // Filter admins who want to receive email notifications
    const adminEmailsToNotify = profiles
      ?.filter((p) => {
        const wantsEmail = prefsMap.get(p.id);
        // Default to true if no preference set
        return wantsEmail !== false && p.email;
      })
      .map((p) => p.email) || [];
    
    if (adminEmailsToNotify.length === 0) {
      console.log("No admin emails to notify (all opted out or no emails)");
      return new Response(
        JSON.stringify({ message: "No admin emails to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending emails to:", adminEmailsToNotify);

    // Format price to Indonesian Rupiah
    const formattedPrice = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(totalPrice);

    // Send email to all admins who opted in
    const emailPromises = adminEmailsToNotify.map((email: string) =>
      resend.emails.send({
        from: "Treebox <onboarding@resend.dev>",
        to: [email],
        subject: `🎮 Booking Baru: ${customerName} - ${storeName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
              🎮 Booking Request Baru
            </h1>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #4CAF50; margin-top: 0;">Detail Booking</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Cabang:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${storeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Nama Customer:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">No. Telepon:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${customerPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Kategori:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Tanggal:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${bookingDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Waktu:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${startTime} - ${endTime}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Total Harga:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #4CAF50;">${formattedPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Metode Pembayaran:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${paymentMethod}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Silahkan login ke dashboard admin untuk memproses booking ini.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
              Email ini dikirim secara otomatis oleh sistem Treebox.
            </p>
          </div>
        `,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter((r: PromiseSettledResult<unknown>) => r.status === "fulfilled").length;
    const failedCount = results.filter((r: PromiseSettledResult<unknown>) => r.status === "rejected").length;

    console.log(`Emails sent: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent to ${successCount} admins`,
        successCount,
        failedCount 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
