import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

interface DemoRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DemoRequestDialog({ open, onOpenChange }: DemoRequestDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [roomCount, setRoomCount] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !whatsapp.trim() || !roomCount || !hotelName.trim()) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: "Format email tidak valid", variant: "destructive" });
      return;
    }

    const phoneRegex = /^[0-9+\-\s()]{8,20}$/;
    if (!phoneRegex.test(whatsapp.trim())) {
      toast({ title: "Format nomor WhatsApp tidak valid", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("demo_requests" as any).insert({
        full_name: fullName.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        room_count: roomCount,
        hotel_name: hotelName.trim(),
      });

      if (error) throw error;

      setIsSuccess(true);
    } catch (error) {
      toast({ title: "Gagal mengirim permintaan demo", description: "Silakan coba lagi.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setFullName("");
      setEmail("");
      setWhatsapp("");
      setRoomCount("");
      setHotelName("");
      setIsSuccess(false);
    }
    onOpenChange(val);
  };

  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <DialogTitle className="text-xl">Permintaan Demo Terkirim!</DialogTitle>
            <DialogDescription>
              Terima kasih, <strong>{fullName}</strong>. Tim kami akan menghubungi Anda melalui WhatsApp dalam 1x24 jam.
            </DialogDescription>
            <Button onClick={() => handleClose(false)} className="mt-2">Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Jadwalkan Demo</DialogTitle>
          <DialogDescription>
            Isi form berikut dan tim kami akan menghubungi Anda untuk menjadwalkan demo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-name">Nama Lengkap</Label>
            <Input
              id="demo-name"
              placeholder="Masukkan nama lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">Email</Label>
            <Input
              id="demo-email"
              type="email"
              placeholder="contoh@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-wa">Nomor WhatsApp</Label>
            <Input
              id="demo-wa"
              placeholder="08xxxxxxxxxx"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              maxLength={20}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-rooms">Jumlah Kamar</Label>
            <Select value={roomCount} onValueChange={setRoomCount} required>
              <SelectTrigger id="demo-rooms">
                <SelectValue placeholder="Pilih jumlah kamar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1 - 10 kamar</SelectItem>
                <SelectItem value="11-25">11 - 25 kamar</SelectItem>
                <SelectItem value="26-50">26 - 50 kamar</SelectItem>
                <SelectItem value="51-100">51 - 100 kamar</SelectItem>
                <SelectItem value="100+">100+ kamar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Kirim Permintaan Demo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
