import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  BarChart3,
  Users,
  Shield,
  DoorOpen,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.png";

const features = [
  {
    icon: CalendarDays,
    title: "Manajemen Booking",
    description: "Kelola reservasi kamar secara real-time dengan kalender interaktif dan notifikasi otomatis.",
  },
  {
    icon: DoorOpen,
    title: "Multi Outlet",
    description: "Satu dashboard untuk mengelola banyak properti. Pantau semua cabang dari satu tempat.",
  },
  {
    icon: BarChart3,
    title: "Laporan Lengkap",
    description: "Laporan penjualan, okupansi, keuangan, dan performa karyawan yang komprehensif.",
  },
  {
    icon: CreditCard,
    title: "Manajemen Transaksi",
    description: "Catat pemasukan, pengeluaran, dan kelola metode pembayaran dengan mudah.",
  },
  {
    icon: Users,
    title: "Manajemen Pelanggan",
    description: "Database pelanggan terintegrasi dengan riwayat booking dan data identitas.",
  },
  {
    icon: Shield,
    title: "Keamanan & Hak Akses",
    description: "Sistem role & permission granular untuk mengontrol akses setiap pengguna.",
  },
];

const benefits = [
  "Booking online terintegrasi WhatsApp",
  "Dashboard real-time multi cabang",
  "Sistem deposit & check-in/out digital",
  "Cetak struk & laporan otomatis",
  "Manajemen produk & inventori",
  "Akses dari perangkat apapun",
];

interface ElementStyle {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  offsetX?: number;
  offsetY?: number;
}

type ElementStyles = Record<string, ElementStyle>;

interface LandingSettings {
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

const defaultSettings: LandingSettings = {
  hero_tagline: "#SolusiPropertiAnda",
  hero_title: "Kelola Properti Lebih Mudah & Efisien!",
  hero_description: "ANKA PMS adalah sistem manajemen properti all-in-one untuk hotel, kost, guest house, dan penginapan. Kelola booking, keuangan, dan operasional dari satu platform.",
  hero_image_url: null,
  contact_email: "info@anka.management",
  contact_phone: "+62 812 3456 7890",
  contact_whatsapp: "6281234567890",
  contact_address: "Malang, Jawa Timur",
  stats_properties: "100+",
  stats_support: "24/7",
  stats_uptime: "99.9%",
  cta_title: "Siap Mengelola Properti Lebih Baik?",
  cta_description: "Daftar sekarang dan nikmati semua fitur premium ANKA PMS untuk properti Anda.",
  footer_description: "Solusi manajemen properti modern untuk hotel, kost, guest house, dan penginapan di Indonesia.",
};

export default function Landing() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LandingSettings>(defaultSettings);
  const [elementStyles, setElementStyles] = useState<ElementStyles>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("landing_page_settings")
          .select("*")
          .single();

        if (!error && data) {
          setSettings({
            hero_tagline: data.hero_tagline || defaultSettings.hero_tagline,
            hero_title: data.hero_title || defaultSettings.hero_title,
            hero_description: data.hero_description || defaultSettings.hero_description,
            hero_image_url: data.hero_image_url,
            contact_email: data.contact_email || defaultSettings.contact_email,
            contact_phone: data.contact_phone || defaultSettings.contact_phone,
            contact_whatsapp: data.contact_whatsapp || defaultSettings.contact_whatsapp,
            contact_address: data.contact_address || defaultSettings.contact_address,
            stats_properties: data.stats_properties || defaultSettings.stats_properties,
            stats_support: data.stats_support || defaultSettings.stats_support,
            stats_uptime: data.stats_uptime || defaultSettings.stats_uptime,
            cta_title: data.cta_title || defaultSettings.cta_title,
            cta_description: data.cta_description || defaultSettings.cta_description,
            footer_description: data.footer_description || defaultSettings.footer_description,
          });
          if (data.element_styles && typeof data.element_styles === 'object') {
            setElementStyles(data.element_styles as ElementStyles);
          }
        }
      } catch (error) {
        console.error("Error fetching landing settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const getStyle = (field: string): React.CSSProperties => {
    const s = elementStyles[field];
    if (!s) return {};
    return {
      fontFamily: s.fontFamily && s.fontFamily !== 'inherit' ? s.fontFamily : undefined,
      fontSize: s.fontSize && s.fontSize !== 'inherit' ? s.fontSize : undefined,
      color: s.color || undefined,
      transform: s.offsetX || s.offsetY ? `translate(${s.offsetX || 0}px, ${s.offsetY || 0}px)` : undefined,
      position: s.offsetX || s.offsetY ? 'relative' : undefined,
    } as React.CSSProperties;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary tracking-tight">ANKA PMS</h1>
          <div className="hidden md:flex items-center gap-8">
            <a href="#fitur" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Fitur</a>
            <a href="#keunggulan" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Keunggulan</a>
            <a href="#kontak" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Kontak</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Masuk
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Coba Gratis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <p className="text-primary font-semibold text-lg mb-3" style={getStyle('hero_tagline')}>{settings.hero_tagline}</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight whitespace-pre-line" style={getStyle('hero_title')}>
                {settings.hero_title}
              </h2>
            </div>
            <p className="text-lg text-muted-foreground max-w-lg" style={getStyle('hero_description')}>
              {settings.hero_description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-base px-8 py-6" onClick={() => navigate("/auth")}>
                Coba Gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 py-6" asChild>
                <a href={`https://wa.me/${settings.contact_whatsapp}`} target="_blank" rel="noopener noreferrer">
                  Jadwalkan Demo
                </a>
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <img
              src={settings.hero_image_url || heroIllustration}
              alt="ANKA PMS Hotel Management"
              className="w-full max-w-md md:max-w-lg drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-2">Fitur Unggulan</p>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground">
              Semua yang Anda Butuhkan
            </h3>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              ANKA PMS dilengkapi fitur lengkap untuk mengelola operasional properti Anda dari A sampai Z.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-md hover:shadow-lg transition-shadow bg-card">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold text-foreground">{feature.title}</h4>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="keunggulan" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-primary font-semibold mb-2">Kenapa ANKA PMS?</p>
              <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                Tingkatkan Efisiensi Operasional Anda
              </h3>
              <div className="space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="mt-8" onClick={() => navigate("/auth")}>
                Mulai Sekarang
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-primary/15 rounded-3xl p-8 md:p-12">
              <div className="space-y-6 text-center">
                <div className="text-5xl font-extrabold text-primary" style={getStyle('stats_properties')}>{settings.stats_properties}</div>
                <p className="text-muted-foreground" style={getStyle('stats_properties_label')}>Properti telah menggunakan ANKA PMS</p>
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div>
                    <div className="text-3xl font-bold text-foreground" style={getStyle('stats_support')}>{settings.stats_support}</div>
                    <p className="text-sm text-muted-foreground">Support</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground" style={getStyle('stats_uptime')}>{settings.stats_uptime}</div>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4" style={getStyle('cta_title')}>
            {settings.cta_title}
          </h3>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto" style={getStyle('cta_description')}>
            {settings.cta_description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-base px-8 py-6" onClick={() => navigate("/auth")}>
              Daftar Gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <a href={`https://wa.me/${settings.contact_whatsapp}`} target="_blank" rel="noopener noreferrer">
                Hubungi Kami
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="kontak" className="bg-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xl font-bold text-background mb-4">ANKA PMS</h4>
              <p className="text-background/60" style={getStyle('footer_description')}>
                {settings.footer_description}
              </p>
            </div>
            <div>
              <h5 className="font-semibold text-background mb-4">Menu</h5>
              <div className="space-y-2">
                <a href="#fitur" className="block text-background/60 hover:text-background transition-colors">Fitur</a>
                <a href="#keunggulan" className="block text-background/60 hover:text-background transition-colors">Keunggulan</a>
                <button onClick={() => navigate("/auth")} className="block text-background/60 hover:text-background transition-colors">Masuk</button>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-background mb-4">Kontak</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-background/60">
                  <Mail className="h-4 w-4" />
                  <span>{settings.contact_email}</span>
                </div>
                <div className="flex items-center gap-2 text-background/60">
                  <Phone className="h-4 w-4" />
                  <span>{settings.contact_phone}</span>
                </div>
                <div className="flex items-center gap-2 text-background/60">
                  <MapPin className="h-4 w-4" />
                  <span>{settings.contact_address}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-background/10 mt-8 pt-8 text-center">
            <p className="text-background/40 text-sm">
              © {new Date().getFullYear()} ANKA PMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
