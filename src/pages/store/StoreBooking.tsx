import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStoreBySlug } from "@/hooks/useStoreBySlug";
import { Loader2, CalendarIcon, Clock, Upload, CheckCircle, MapPin, Home, User, Phone, CreditCard, AlertTriangle, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import PaymentTimer from "@/components/PaymentTimer";
import BookingSummary from "@/components/BookingSummary";

// This component wraps the existing Booking page with store context
export default function StoreBooking() {
  const { store, isLoading: storeLoading, error: storeError, storeSlug } = useStoreBySlug();
  const navigate = useNavigate();

  useEffect(() => {
    if (store) {
      // Set the store in localStorage so components can use it
      localStorage.setItem("booking_store_id", store.id);
      localStorage.setItem("booking_store_slug", store.slug);
    }
  }, [store]);

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold mb-2">Toko Tidak Ditemukan</h2>
            <p className="text-muted-foreground mb-4">
              URL "{storeSlug}" tidak valid atau toko tidak aktif.
            </p>
            <Button onClick={() => navigate("/")}>
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For now, redirect to the main booking page with store context set
  // The main Booking component will be refactored later to use this context
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Booking - {store.name}</CardTitle>
            <CardDescription>
              Silakan buat reservasi Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Halaman booking untuk {store.name} sedang dalam proses migrasi.
            </p>
            <Button onClick={() => navigate(`/${storeSlug}/auth`)}>
              Login untuk akses penuh
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
