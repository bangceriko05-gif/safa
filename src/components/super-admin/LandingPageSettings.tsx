import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Save, Globe, Phone, Mail, MapPin, BarChart3, Image, Eye, EyeOff, ArrowRight, CheckCircle2, Pencil, Move, Type, Palette, RotateCcw, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ChevronRight, X, CalendarDays, DoorOpen, CreditCard, Users, Shield } from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.png";
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

/* ─── Position Control Panel ─── */
function PositionPanel({
  field,
  style,
  onStyleChange,
  onClose,
}: {
  field: string;
  style: ElementStyle;
  onStyleChange: (field: string, style: Partial<ElementStyle>) => void;
  onClose: () => void;
}) {
  const step = 5;
  const x = style.offsetX || 0;
  const y = style.offsetY || 0;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-card border rounded-xl shadow-xl p-3 flex items-center gap-4 min-w-[380px]">
      <div className="flex items-center gap-2">
        <Move className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{field}</span>
      </div>

      {/* Arrow Controls */}
      <div className="grid grid-cols-3 gap-0.5 w-fit">
        <div />
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onStyleChange(field, { offsetY: y - step })}>
          <ArrowUp className="h-3 w-3" />
        </Button>
        <div />
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onStyleChange(field, { offsetX: x - step })}>
          <ArrowLeftIcon className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 text-[9px] font-mono" onClick={() => onStyleChange(field, { offsetX: 0, offsetY: 0 })}>
          0
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onStyleChange(field, { offsetX: x + step })}>
          <ChevronRight className="h-3 w-3" />
        </Button>
        <div />
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onStyleChange(field, { offsetY: y + step })}>
          <ArrowDown className="h-3 w-3" />
        </Button>
        <div />
      </div>

      {/* Numeric Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">X</span>
          <Input
            type="number"
            className="h-7 w-16 text-xs text-center"
            value={x}
            onChange={(e) => onStyleChange(field, { offsetX: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">Y</span>
          <Input
            type="number"
            className="h-7 w-16 text-xs text-center"
            value={y}
            onChange={(e) => onStyleChange(field, { offsetY: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={onClose}>
        <X className="h-3 w-3" />
      </Button>
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
  const [mode, setMode] = useState<"edit" | "drag" | null>("edit");
  const [activeToolbar, setActiveToolbar] = useState<{ field: string; x: number; y: number } | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const benefits = [
    "Booking online terintegrasi WhatsApp",
    "Dashboard real-time multi cabang",
    "Sistem deposit & check-in/out digital",
    "Cetak struk & laporan otomatis",
    "Manajemen produk & inventori",
    "Akses dari perangkat apapun",
  ];

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

  const handleElementClick = (field: string, e: React.MouseEvent) => {
    if (mode === "drag") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedField(field);
    }
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
    const isSelected = selectedField === field;
    const hasDragOffset = elementStyles[field]?.offsetX || elementStyles[field]?.offsetY;

    return (
      <El
        contentEditable={isEdit}
        suppressContentEditableWarning
        className={`${className} outline-none rounded px-0.5 -mx-0.5 transition-all ${
          isEdit
            ? "cursor-text hover:ring-2 hover:ring-primary/30 focus:ring-2 focus:ring-primary/50 focus:bg-primary/5"
            : `cursor-pointer hover:ring-2 hover:ring-accent/50 hover:bg-accent/10 ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`
        } ${hasDragOffset ? "ring-1 ring-dashed ring-accent/40" : ""}`}
        style={getElementStyle(field)}
        onBlur={isEdit ? (e: React.FocusEvent<HTMLElement>) => onUpdate(field, e.currentTarget.textContent || "") : undefined}
        onClick={isDrag ? (e: React.MouseEvent) => handleElementClick(field, e) : undefined}
        onContextMenu={(e: React.MouseEvent) => handleContextMenu(field, e)}
      >
        {children}
      </El>
    );
  };

  return (
    <div ref={previewRef} className="relative">
      {/* Mode Toggle Bar */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg border flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Mode:</span>
        <Button
          size="sm"
          variant={mode === "edit" ? "default" : "outline"}
          className="h-7 text-xs gap-1"
          onClick={() => { setMode("edit"); setSelectedField(null); }}
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

        <div className="h-5 w-px bg-border mx-1" />

        {/* Hero Image */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Image className="h-3 w-3" />
              Gambar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-3" align="start">
            <p className="text-xs font-semibold">URL Gambar Hero</p>
            <Input
              className="h-8 text-xs"
              value={data.hero_image_url || ""}
              onChange={(e) => onUpdate("hero_image_url", e.target.value)}
              placeholder="https://example.com/image.png"
            />
            {data.hero_image_url && (
              <img src={data.hero_image_url} alt="Preview" className="w-full h-24 object-contain rounded border bg-muted" />
            )}
            <p className="text-[10px] text-muted-foreground">Kosongkan untuk menggunakan gambar default.</p>
          </PopoverContent>
        </Popover>

        {/* Contact Info */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Phone className="h-3 w-3" />
              Kontak
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-2.5" align="start">
            <p className="text-xs font-semibold">Informasi Kontak</p>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Email</label>
              <Input className="h-7 text-xs" value={data.contact_email} onChange={(e) => onUpdate("contact_email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Telepon</label>
              <Input className="h-7 text-xs" value={data.contact_phone} onChange={(e) => onUpdate("contact_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">WhatsApp (tanpa +)</label>
              <Input className="h-7 text-xs" value={data.contact_whatsapp} onChange={(e) => onUpdate("contact_whatsapp", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Alamat</label>
              <Input className="h-7 text-xs" value={data.contact_address} onChange={(e) => onUpdate("contact_address", e.target.value)} />
            </div>
          </PopoverContent>
        </Popover>

        {/* Statistics */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Statistik
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2.5" align="start">
            <p className="text-xs font-semibold">Angka Statistik</p>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Jumlah Properti</label>
              <Input className="h-7 text-xs" value={data.stats_properties} onChange={(e) => onUpdate("stats_properties", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Support</label>
              <Input className="h-7 text-xs" value={data.stats_support} onChange={(e) => onUpdate("stats_support", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Uptime</label>
              <Input className="h-7 text-xs" value={data.stats_uptime} onChange={(e) => onUpdate("stats_uptime", e.target.value)} />
            </div>
          </PopoverContent>
        </Popover>

        {/* CTA */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <ArrowRight className="h-3 w-3" />
              CTA
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-2.5" align="start">
            <p className="text-xs font-semibold">Call to Action</p>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Judul CTA</label>
              <Input className="h-7 text-xs" value={data.cta_title} onChange={(e) => onUpdate("cta_title", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Deskripsi CTA</label>
              <Textarea className="text-xs min-h-[60px]" value={data.cta_description} onChange={(e) => onUpdate("cta_description", e.target.value)} rows={2} />
            </div>
          </PopoverContent>
        </Popover>

        {/* Footer */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Globe className="h-3 w-3" />
              Footer
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-2.5" align="start">
            <p className="text-xs font-semibold">Footer</p>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Deskripsi Footer</label>
              <Textarea className="text-xs min-h-[60px]" value={data.footer_description} onChange={(e) => onUpdate("footer_description", e.target.value)} rows={2} />
            </div>
          </PopoverContent>
        </Popover>

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

      {/* Position Control Panel */}
      {mode === "drag" && selectedField && (
        <PositionPanel
          field={selectedField}
          style={elementStyles[selectedField] || {}}
          onStyleChange={onStyleUpdate}
          onClose={() => setSelectedField(null)}
        />
      )}

      <div className="border rounded-xl overflow-hidden bg-background shadow-lg select-none">
        {/* Navbar Preview - matches Landing.tsx */}
        <div className="border-b bg-card/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary tracking-tight">ANKA PMS</span>
          <div className="flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <span className="hover:text-foreground cursor-default">Fitur</span>
            <span className="hover:text-foreground cursor-default">Keunggulan</span>
            <span className="hover:text-foreground cursor-default">Kontak</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground cursor-default">Masuk</span>
            <span className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">Coba Gratis</span>
          </div>
        </div>

        {/* Hero Preview - 2 column with image */}
        <div className="px-6 py-10 md:py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div>
                <EditableText field="hero_tagline" as="p" className="text-primary font-semibold text-sm mb-2">
                  {data.hero_tagline}
                </EditableText>
                <EditableText field="hero_title" as="h2" className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight whitespace-pre-line">
                  {data.hero_title}
                </EditableText>
              </div>
              <EditableText field="hero_description" as="p" className="text-sm text-muted-foreground max-w-lg">
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
            <div className="flex justify-center">
              <img
                src={data.hero_image_url || heroIllustration}
                alt="ANKA PMS"
                className="w-full max-w-[240px] md:max-w-[280px] drop-shadow-xl object-contain"
              />
            </div>
          </div>
        </div>

        {/* Features Preview - matches Landing.tsx */}
        <div className="py-8 bg-secondary/30">
          <div className="px-6">
            <div className="text-center mb-6">
              <p className="text-primary font-semibold text-xs mb-1">Fitur Unggulan</p>
              <h3 className="text-lg font-bold text-foreground">Semua yang Anda Butuhkan</h3>
              <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
                ANKA PMS dilengkapi fitur lengkap untuk mengelola operasional properti Anda dari A sampai Z.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: CalendarDays, title: "Manajemen Booking", desc: "Kelola reservasi kamar secara real-time." },
                { icon: DoorOpen, title: "Multi Outlet", desc: "Satu dashboard untuk banyak properti." },
                { icon: BarChart3, title: "Laporan Lengkap", desc: "Laporan penjualan & keuangan." },
                { icon: CreditCard, title: "Manajemen Transaksi", desc: "Catat pemasukan & pengeluaran." },
                { icon: Users, title: "Manajemen Pelanggan", desc: "Database pelanggan terintegrasi." },
                { icon: Shield, title: "Keamanan & Hak Akses", desc: "Sistem role & permission granular." },
              ].map((f) => (
                <div key={f.title} className="bg-card rounded-lg border-0 shadow-sm p-3 space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">{f.title}</h4>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Preview - 2 column with stats */}
        <div className="px-6 py-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-primary font-semibold text-xs mb-1">Kenapa ANKA PMS?</p>
              <h3 className="text-lg font-bold text-foreground mb-4">Tingkatkan Efisiensi Operasional Anda</h3>
              <div className="space-y-2">
                {benefits.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{b}</span>
                  </div>
                ))}
              </div>
              <span className="inline-flex items-center gap-1 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium">
                Mulai Sekarang <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-primary/15 rounded-2xl p-6 text-center">
              <EditableText field="stats_properties" as="div" className="text-3xl font-extrabold text-primary">
                {data.stats_properties}
              </EditableText>
              <p className="text-xs text-muted-foreground mt-1" style={getElementStyle('stats_properties_label')}>Properti telah menggunakan ANKA PMS</p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <EditableText field="stats_support" as="div" className="text-xl font-bold text-foreground">
                    {data.stats_support}
                  </EditableText>
                  <p className="text-[10px] text-muted-foreground">Support</p>
                </div>
                <div>
                  <EditableText field="stats_uptime" as="div" className="text-xl font-bold text-foreground">
                    {data.stats_uptime}
                  </EditableText>
                  <p className="text-[10px] text-muted-foreground">Uptime</p>
                </div>
              </div>
            </div>
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
