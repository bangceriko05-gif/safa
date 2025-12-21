import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Mail, Loader2 } from "lucide-react";

interface NotificationPreferences {
  email_new_booking: boolean;
  email_booking_cancelled: boolean;
  email_payment_received: boolean;
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_booking: true,
    email_booking_cancelled: true,
    email_payment_received: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingPrefs, setHasExistingPrefs] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          email_new_booking: data.email_new_booking,
          email_booking_cancelled: data.email_booking_cancelled,
          email_payment_received: data.email_payment_received,
        });
        setHasExistingPrefs(true);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (hasExistingPrefs) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({
            email_new_booking: preferences.email_new_booking,
            email_booking_cancelled: preferences.email_booking_cancelled,
            email_payment_received: preferences.email_payment_received,
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            email_new_booking: preferences.email_new_booking,
            email_booking_cancelled: preferences.email_booking_cancelled,
            email_payment_received: preferences.email_payment_received,
          });

        if (error) throw error;
        setHasExistingPrefs(true);
      }

      toast.success("Preferensi notifikasi berhasil disimpan");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Gagal menyimpan preferensi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Pengaturan Notifikasi
        </CardTitle>
        <CardDescription>
          Kelola preferensi notifikasi email Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Notifikasi Email
          </h4>
          
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_new_booking" className="text-sm font-medium">
                  Booking Baru
                </Label>
                <p className="text-xs text-muted-foreground">
                  Terima email saat ada booking request baru
                </p>
              </div>
              <Switch
                id="email_new_booking"
                checked={preferences.email_new_booking}
                onCheckedChange={() => handleToggle("email_new_booking")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_booking_cancelled" className="text-sm font-medium">
                  Booking Dibatalkan
                </Label>
                <p className="text-xs text-muted-foreground">
                  Terima email saat booking dibatalkan
                </p>
              </div>
              <Switch
                id="email_booking_cancelled"
                checked={preferences.email_booking_cancelled}
                onCheckedChange={() => handleToggle("email_booking_cancelled")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_payment_received" className="text-sm font-medium">
                  Pembayaran Diterima
                </Label>
                <p className="text-xs text-muted-foreground">
                  Terima email saat bukti pembayaran diunggah
                </p>
              </div>
              <Switch
                id="email_payment_received"
                checked={preferences.email_payment_received}
                onCheckedChange={() => handleToggle("email_payment_received")}
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button onClick={savePreferences} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Preferensi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
