import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Globe, Phone, Mail, MapPin, BarChart3, Image } from "lucide-react";
import { toast } from "sonner";

interface LandingPageData {
  id: string;
  hero_tagline: string;
  hero_title: string;
  hero_description: string;
  hero_image_url: string | null;
  contact_email: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_address: string;
  stats_properties: string;
  stats_support: string;
  stats_uptime: string;
  cta_title: string;
  cta_description: string;
  footer_description: string;
}

export default function LandingPageSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<LandingPageData | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from("landing_page_settings")
        .select("*")
        .single();

      if (error) throw error;
      setData(settings);
    } catch (error) {
      console.error("Error fetching landing page settings:", error);
      toast.error("Gagal memuat pengaturan landing page");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("landing_page_settings")
        .update({
          hero_tagline: data.hero_tagline,
          hero_title: data.hero_title,
          hero_description: data.hero_description,
          hero_image_url: data.hero_image_url,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          contact_whatsapp: data.contact_whatsapp,
          contact_address: data.contact_address,
          stats_properties: data.stats_properties,
          stats_support: data.stats_support,
          stats_uptime: data.stats_uptime,
          cta_title: data.cta_title,
          cta_description: data.cta_description,
          footer_description: data.footer_description,
        })
        .eq("id", data.id);

      if (error) throw error;
      toast.success("Pengaturan landing page berhasil disimpan");
    } catch (error) {
      console.error("Error saving landing page settings:", error);
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof LandingPageData, value: string) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Data tidak ditemukan
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Hero Section
          </CardTitle>
          <CardDescription>Bagian utama landing page yang pertama kali dilihat pengunjung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero_tagline">Tagline</Label>
            <Input
              id="hero_tagline"
              value={data.hero_tagline}
              onChange={(e) => updateField("hero_tagline", e.target.value)}
              placeholder="#SolusiPropertiAnda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero_title">Judul Utama</Label>
            <Textarea
              id="hero_title"
              value={data.hero_title}
              onChange={(e) => updateField("hero_title", e.target.value)}
              placeholder="Kelola Properti Lebih Mudah & Efisien!"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero_description">Deskripsi</Label>
            <Textarea
              id="hero_description"
              value={data.hero_description}
              onChange={(e) => updateField("hero_description", e.target.value)}
              placeholder="Deskripsi singkat tentang ANKA PMS..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero_image_url" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              URL Gambar Hero (opsional)
            </Label>
            <Input
              id="hero_image_url"
              value={data.hero_image_url || ""}
              onChange={(e) => updateField("hero_image_url", e.target.value)}
              placeholder="https://example.com/image.png"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Informasi Kontak
          </CardTitle>
          <CardDescription>Data kontak yang ditampilkan di landing page</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact_email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={data.contact_email}
              onChange={(e) => updateField("contact_email", e.target.value)}
              placeholder="info@anka.management"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telepon</Label>
            <Input
              id="contact_phone"
              value={data.contact_phone}
              onChange={(e) => updateField("contact_phone", e.target.value)}
              placeholder="+62 812 3456 7890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_whatsapp">WhatsApp (tanpa +)</Label>
            <Input
              id="contact_whatsapp"
              value={data.contact_whatsapp}
              onChange={(e) => updateField("contact_whatsapp", e.target.value)}
              placeholder="6281234567890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Alamat
            </Label>
            <Input
              id="contact_address"
              value={data.contact_address}
              onChange={(e) => updateField("contact_address", e.target.value)}
              placeholder="Malang, Jawa Timur"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistik
          </CardTitle>
          <CardDescription>Angka-angka yang ditampilkan di section keunggulan</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="stats_properties">Jumlah Properti</Label>
            <Input
              id="stats_properties"
              value={data.stats_properties}
              onChange={(e) => updateField("stats_properties", e.target.value)}
              placeholder="100+"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats_support">Support</Label>
            <Input
              id="stats_support"
              value={data.stats_support}
              onChange={(e) => updateField("stats_support", e.target.value)}
              placeholder="24/7"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats_uptime">Uptime</Label>
            <Input
              id="stats_uptime"
              value={data.stats_uptime}
              onChange={(e) => updateField("stats_uptime", e.target.value)}
              placeholder="99.9%"
            />
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card>
        <CardHeader>
          <CardTitle>Call to Action</CardTitle>
          <CardDescription>Section ajakan untuk mendaftar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cta_title">Judul CTA</Label>
            <Input
              id="cta_title"
              value={data.cta_title}
              onChange={(e) => updateField("cta_title", e.target.value)}
              placeholder="Siap Mengelola Properti Lebih Baik?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta_description">Deskripsi CTA</Label>
            <Textarea
              id="cta_description"
              value={data.cta_description}
              onChange={(e) => updateField("cta_description", e.target.value)}
              placeholder="Daftar sekarang dan nikmati..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
          <CardDescription>Teks di bagian bawah landing page</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="footer_description">Deskripsi Footer</Label>
            <Textarea
              id="footer_description"
              value={data.footer_description}
              onChange={(e) => updateField("footer_description", e.target.value)}
              placeholder="Solusi manajemen properti modern..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Simpan Perubahan
        </Button>
      </div>
    </div>
  );
}
