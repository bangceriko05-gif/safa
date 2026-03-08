import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Save, Globe, Phone, Mail, MapPin, BarChart3, Image, Eye, EyeOff, ArrowRight, CheckCircle2, Pencil, Move, Type, Palette, RotateCcw, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ChevronRight, X } from "lucide-react";
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

interface ElementStyle {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  offsetX?: number;
  offsetY?: number;
}

type ElementStyles = Record<string, ElementStyle>;

const FONT_OPTIONS = [
  { value: "inherit", label: "Default" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Lora', serif", label: "Lora" },
  { value: "'Oswald', sans-serif", label: "Oswald" },
  { value: "'Raleway', sans-serif", label: "Raleway" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
];

const FONT_SIZE_OPTIONS = [
  { value: "inherit", label: "Default" },
  { value: "10px", label: "10px" },
  { value: "12px", label: "12px" },
  { value: "14px", label: "14px" },
  { value: "16px", label: "16px" },
  { value: "18px", label: "18px" },
  { value: "20px", label: "20px" },
  { value: "24px", label: "24px" },
  { value: "28px", label: "28px" },
  { value: "32px", label: "32px" },
  { value: "36px", label: "36px" },
  { value: "40px", label: "40px" },
  { value: "48px", label: "48px" },
];

const COLOR_PRESETS = [
  "#000000", "#333333", "#666666", "#999999", "#FFFFFF",
  "#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
  "#dc2626", "#ef4444", "#f87171", "#059669", "#10b981",
  "#d97706", "#f59e0b", "#fbbf24", "#7c3aed", "#8b5cf6",
];

export default function LandingPageSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [data, setData] = useState<LandingPageData | null>(null);
  const [elementStyles, setElementStyles] = useState<ElementStyles>({});

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
      if (settings.element_styles && typeof settings.element_styles === "object") {
        setElementStyles(settings.element_styles as ElementStyles);
      }
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
          element_styles: elementStyles as any,
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

  const updateElementStyle = useCallback((field: string, style: Partial<ElementStyle>) => {
    setElementStyles(prev => ({
      ...prev,
      [field]: { ...prev[field], ...style },
    }));
  }, []);

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
          <div>
            <h3 className="text-lg font-semibold">Preview Landing Page</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Pencil className="h-3 w-3" />
              Klik teks untuk edit · Klik kanan untuk styling · Tahan & geser untuk pindah posisi
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <EyeOff className="mr-2 h-4 w-4" />
              Editor
            </Button>
          </div>
        </div>
        <LandingPreview
          data={data}
          onUpdate={updateField}
          elementStyles={elementStyles}
          onStyleUpdate={updateElementStyle}
        />
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

/* ─── Floating Style Toolbar ─── */
function StyleToolbar({
  field,
  style,
  onStyleChange,
  position,
  onClose,
}: {
  field: string;
  style: ElementStyle;
  onStyleChange: (field: string, style: Partial<ElementStyle>) => void;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[100] bg-card border rounded-xl shadow-xl p-3 space-y-3 min-w-[260px]"
      style={{ top: position.y, left: position.x }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Type className="h-3 w-3" /> Style: {field}
        </span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
          onStyleChange(field, { fontFamily: undefined, fontSize: undefined, color: undefined });
          onClose();
        }}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      {/* Font Family */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Font</label>
        <Select
          value={style.fontFamily || "inherit"}
          onValueChange={(v) => onStyleChange(field, { fontFamily: v === "inherit" ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ukuran</label>
        <Select
          value={style.fontSize || "inherit"}
          onValueChange={(v) => onStyleChange(field, { fontSize: v === "inherit" ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Color */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Palette className="h-3 w-3" /> Warna
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${style.color === c ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              style={{ backgroundColor: c }}
              onClick={() => onStyleChange(field, { color: c })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            className="w-6 h-6 rounded cursor-pointer border-0"
            value={style.color || "#000000"}
            onChange={(e) => onStyleChange(field, { color: e.target.value })}
          />
          <Input
            className="h-7 text-xs flex-1"
            value={style.color || ""}
            onChange={(e) => onStyleChange(field, { color: e.target.value })}
            placeholder="#hex atau nama warna"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Visual Editor Preview ─── */
function LandingPreview({
  data,
  onUpdate,
  elementStyles,
  onStyleUpdate,
}: {
  data: LandingPageData;
  onUpdate: (field: keyof LandingPageData, value: string) => void;
  elementStyles: ElementStyles;
  onStyleUpdate: (field: string, style: Partial<ElementStyle>) => void;
}) {
  const [mode, setMode] = useState<"edit" | "drag">("edit");
  const [activeToolbar, setActiveToolbar] = useState<{ field: string; x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ field: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const benefits = [
    "Booking online terintegrasi WhatsApp",
    "Dashboard real-time multi cabang",
    "Sistem deposit & check-in/out digital",
    "Cetak struk & laporan otomatis",
    "Manajemen produk & inventori",
    "Akses dari perangkat apapun",
  ];

  const handleMouseDown = useCallback((field: string, e: React.MouseEvent) => {
    if (mode !== "drag") return;
    e.preventDefault();
    const style = elementStyles[field] || {};
    setDragState({
      field,
      startX: e.clientX,
      startY: e.clientY,
      origX: style.offsetX || 0,
      origY: style.offsetY || 0,
    });
  }, [mode, elementStyles]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      onStyleUpdate(dragState.field, {
        offsetX: dragState.origX + dx,
        offsetY: dragState.origY + dy,
      });
    };

    const handleMouseUp = () => setDragState(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, onStyleUpdate]);

  const getElementStyle = (field: string): React.CSSProperties => {
    const s = elementStyles[field];
    if (!s) return {};
    return {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      color: s.color,
      transform: s.offsetX || s.offsetY ? `translate(${s.offsetX || 0}px, ${s.offsetY || 0}px)` : undefined,
      position: s.offsetX || s.offsetY ? "relative" : undefined,
    };
  };

  const handleContextMenu = (field: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveToolbar({ field, x: Math.min(e.clientX, window.innerWidth - 300), y: Math.min(e.clientY, window.innerHeight - 350) });
  };

  const EditableText = ({ field, children, className = "", as: Tag = "span" }: {
    field: keyof LandingPageData;
    children: React.ReactNode;
    className?: string;
    as?: keyof JSX.IntrinsicElements;
  }) => {
    const El = Tag as any;
    const isEdit = mode === "edit";
    const isDrag = mode === "drag";
    const hasDragOffset = elementStyles[field]?.offsetX || elementStyles[field]?.offsetY;

    return (
      <El
        contentEditable={isEdit}
        suppressContentEditableWarning
        className={`${className} outline-none rounded px-0.5 -mx-0.5 transition-all ${
          isEdit
            ? "cursor-text hover:ring-2 hover:ring-primary/30 focus:ring-2 focus:ring-primary/50 focus:bg-primary/5"
            : "cursor-move hover:ring-2 hover:ring-accent/50 hover:bg-accent/10"
        } ${hasDragOffset ? "ring-1 ring-dashed ring-accent/40" : ""}`}
        style={getElementStyle(field)}
        onBlur={isEdit ? (e: React.FocusEvent<HTMLElement>) => onUpdate(field, e.currentTarget.textContent || "") : undefined}
        onMouseDown={isDrag ? (e: React.MouseEvent) => handleMouseDown(field, e) : undefined}
        onContextMenu={(e: React.MouseEvent) => handleContextMenu(field, e)}
      >
        {children}
      </El>
    );
  };

  return (
    <div ref={previewRef} className="relative">
      {/* Mode Toggle Bar */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg border">
        <span className="text-xs font-medium text-muted-foreground mr-1">Mode:</span>
        <Button
          size="sm"
          variant={mode === "edit" ? "default" : "outline"}
          className="h-7 text-xs gap-1"
          onClick={() => setMode("edit")}
        >
          <Pencil className="h-3 w-3" />
          Edit Teks
        </Button>
        <Button
          size="sm"
          variant={mode === "drag" ? "default" : "outline"}
          className="h-7 text-xs gap-1"
          onClick={() => setMode("drag")}
        >
          <Move className="h-3 w-3" />
          Geser Posisi
        </Button>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Palette className="h-3 w-3" />
          Klik kanan pada teks untuk ubah font & warna
        </div>
      </div>

      {/* Floating Style Toolbar */}
      {activeToolbar && (
        <StyleToolbar
          field={activeToolbar.field}
          style={elementStyles[activeToolbar.field] || {}}
          onStyleChange={onStyleUpdate}
          position={{ x: activeToolbar.x, y: activeToolbar.y }}
          onClose={() => setActiveToolbar(null)}
        />
      )}

      <div className="border rounded-xl overflow-hidden bg-background shadow-lg select-none">
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
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <EditableText field="hero_tagline" as="p" className="text-primary font-semibold text-sm mb-2">
                {data.hero_tagline}
              </EditableText>
              <EditableText field="hero_title" as="h2" className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight whitespace-pre-line mb-4">
                {data.hero_title}
              </EditableText>
              <EditableText field="hero_description" as="p" className="text-sm text-muted-foreground mb-6 max-w-lg">
                {data.hero_description}
              </EditableText>
              <div className="flex gap-3">
                <span className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium">
                  Coba Gratis <ArrowRight className="h-3 w-3" />
                </span>
                <span className="inline-flex items-center px-4 py-2 border rounded-md text-xs font-medium text-muted-foreground">
                  Jadwalkan Demo
                </span>
              </div>
            </div>
            {data.hero_image_url && (
              <div className="hidden md:block flex-shrink-0 w-1/3">
                <img src={data.hero_image_url} alt="Hero" className="w-full h-auto object-contain rounded-lg" />
              </div>
            )}
          </div>
        </div>

        {/* Stats Preview */}
        <div className="px-6 py-8 bg-secondary/30">
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-center">
            <div>
              <EditableText field="stats_properties" as="div" className="text-2xl font-extrabold text-primary">
                {data.stats_properties}
              </EditableText>
              <p className="text-xs text-muted-foreground">Properti</p>
            </div>
            <div>
              <EditableText field="stats_support" as="div" className="text-2xl font-bold text-foreground">
                {data.stats_support}
              </EditableText>
              <p className="text-xs text-muted-foreground">Support</p>
            </div>
            <div>
              <EditableText field="stats_uptime" as="div" className="text-2xl font-bold text-foreground">
                {data.stats_uptime}
              </EditableText>
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
          <EditableText field="cta_title" as="h3" className="text-lg font-bold text-primary-foreground mb-2">
            {data.cta_title}
          </EditableText>
          <EditableText field="cta_description" as="p" className="text-xs text-primary-foreground/80 mb-4 max-w-md mx-auto">
            {data.cta_description}
          </EditableText>
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
              <EditableText field="footer_description" as="p" className="text-xs text-background/60">
                {data.footer_description}
              </EditableText>
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
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <EditableText field="contact_email">{data.contact_email}</EditableText>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-background/60">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <EditableText field="contact_phone">{data.contact_phone}</EditableText>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-background/60">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <EditableText field="contact_address">{data.contact_address}</EditableText>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-background/10 mt-4 pt-3 text-center">
            <p className="text-background/40 text-[10px]">© {new Date().getFullYear()} ANKA PMS. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
