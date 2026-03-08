import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Globe, Phone, Mail, MapPin, BarChart3, Image, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
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
  const [showPreview, setShowPreview] = useState(false);
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

  if (showPreview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Preview Landing Page</h3>
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            <EyeOff className="mr-2 h-4 w-4" />
            Kembali ke Editor
          </Button>
        </div>
        <LandingPreview data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Toggle */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Edit konten landing page dan lihat preview secara real-time</p>
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </div>

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
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
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

/* ─── Live Preview Component ─── */
function LandingPreview({ data }: { data: LandingPageData }) {
  const benefits = [
    "Booking online terintegrasi WhatsApp",
    "Dashboard real-time multi cabang",
    "Sistem deposit & check-in/out digital",
    "Cetak struk & laporan otomatis",
    "Manajemen produk & inventori",
    "Akses dari perangkat apapun",
  ];

  return (
    <div className="border rounded-xl overflow-hidden bg-background shadow-lg">
      {/* Navbar Preview */}
      <div className="border-b bg-card/80 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-primary">ANKA PMS</span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Fitur</span>
          <span>Keunggulan</span>
          <span>Kontak</span>
          <span className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs">Coba Gratis</span>
        </div>
      </div>

      {/* Hero Preview */}
      <div className="px-6 py-10 md:py-14">
        <div className="max-w-2xl">
          <p className="text-primary font-semibold text-sm mb-2">{data.hero_tagline}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight whitespace-pre-line mb-4">
            {data.hero_title}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">
            {data.hero_description}
          </p>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium">
              Coba Gratis <ArrowRight className="h-3 w-3" />
            </span>
            <span className="inline-flex items-center px-4 py-2 border rounded-md text-xs font-medium text-muted-foreground">
              Jadwalkan Demo
            </span>
          </div>
        </div>
      </div>

      {/* Stats Preview */}
      <div className="px-6 py-8 bg-secondary/30">
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-center">
          <div>
            <div className="text-2xl font-extrabold text-primary">{data.stats_properties}</div>
            <p className="text-xs text-muted-foreground">Properti</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{data.stats_support}</div>
            <p className="text-xs text-muted-foreground">Support</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{data.stats_uptime}</div>
            <p className="text-xs text-muted-foreground">Uptime</p>
          </div>
        </div>
      </div>

      {/* Benefits Preview */}
      <div className="px-6 py-8">
        <h3 className="text-lg font-bold text-foreground mb-4">Kenapa ANKA PMS?</h3>
        <div className="grid grid-cols-2 gap-2">
          {benefits.map((b) => (
            <div key={b} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-foreground">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Preview */}
      <div className="px-6 py-8 bg-primary text-center">
        <h3 className="text-lg font-bold text-primary-foreground mb-2">{data.cta_title}</h3>
        <p className="text-xs text-primary-foreground/80 mb-4 max-w-md mx-auto">{data.cta_description}</p>
        <div className="flex gap-3 justify-center">
          <span className="inline-flex items-center gap-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
            Daftar Gratis <ArrowRight className="h-3 w-3" />
          </span>
          <span className="inline-flex items-center px-4 py-2 border border-primary-foreground/30 text-primary-foreground rounded-md text-xs font-medium">
            Hubungi Kami
          </span>
        </div>
      </div>

      {/* Footer Preview */}
      <div className="px-6 py-6 bg-foreground">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <h4 className="text-sm font-bold text-background mb-2">ANKA PMS</h4>
            <p className="text-xs text-background/60">{data.footer_description}</p>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-background mb-2">Menu</h5>
            <div className="space-y-1 text-xs text-background/60">
              <p>Fitur</p>
              <p>Keunggulan</p>
              <p>Masuk</p>
            </div>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-background mb-2">Kontak</h5>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-background/60">
                <Mail className="h-3 w-3" />
                <span>{data.contact_email}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-background/60">
                <Phone className="h-3 w-3" />
                <span>{data.contact_phone}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-background/60">
                <MapPin className="h-3 w-3" />
                <span>{data.contact_address}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-background/10 mt-4 pt-3 text-center">
          <p className="text-background/40 text-[10px]">© {new Date().getFullYear()} ANKA PMS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
