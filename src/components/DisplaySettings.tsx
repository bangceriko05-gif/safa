import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, Palette, ChevronDown, ChevronUp, Type, Store, Bed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";
import StoreManagement from "./StoreManagement";
import VariantScheduleSettings from "./VariantScheduleSettings";

interface StatusColor {
  id: string;
  status: string;
  color: string;
}

interface DisplaySettingsProps {
  userRole?: string | null;
}

export default function DisplaySettings({ userRole }: DisplaySettingsProps) {
  const { currentStore } = useStore();
  const [displaySize, setDisplaySize] = useState<string>(() => {
    return localStorage.getItem("schedule-display-size") || "normal";
  });
  const [statusColors, setStatusColors] = useState<StatusColor[]>([]);
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const [isFontSettingsOpen, setIsFontSettingsOpen] = useState(false);
  const [isOutletSettingsOpen, setIsOutletSettingsOpen] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem("app-font-family") || "inter";
  });
  const [fontWeight, setFontWeight] = useState<string>(() => {
    return localStorage.getItem("app-font-weight") || "normal";
  });
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    return localStorage.getItem("app-primary-color") || "#8B5CF6";
  });
  const [bookingTextColor, setBookingTextColor] = useState<string>(() => {
    return localStorage.getItem("booking-text-color") || "#1F2937";
  });
  const [readyUsedColor, setReadyUsedColor] = useState<string>(() => {
    return localStorage.getItem("ready-used-color") || "#10B981";
  });

  useEffect(() => {
    if (currentStore) {
      fetchStatusColors();
    }
    applyFontSettings();
    applyPrimaryColor();
  }, [currentStore]);


  const fetchStatusColors = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("status_colors")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("status");

      if (error) throw error;

      // If no colors exist for this store, create defaults
      if (!data || data.length === 0) {
        const defaultColors = [
          { status: "BO", color: "#87CEEB", store_id: currentStore.id },
          { status: "CI", color: "#90EE90", store_id: currentStore.id },
          { status: "CO", color: "#6B7280", store_id: currentStore.id },
          { status: "BATAL", color: "#9CA3AF", store_id: currentStore.id },
        ];

        const { data: newColors, error: insertError } = await supabase
          .from("status_colors")
          .insert(defaultColors)
          .select();

        if (insertError) throw insertError;
        setStatusColors(newColors || []);
        
        // Trigger event to update other components
        window.dispatchEvent(new CustomEvent("status-colors-changed"));
      } else {
        setStatusColors(data);
      }
    } catch (error) {
      console.error("Error fetching status colors:", error);
    }
  };

  const handleDisplaySizeChange = (value: string) => {
    setDisplaySize(value);
    localStorage.setItem("schedule-display-size", value);
    
    // Dispatch custom event to update other components
    window.dispatchEvent(new CustomEvent("display-size-changed", { detail: value }));
    
    toast.success("Pengaturan tampilan berhasil diubah");
  };

  const handleColorChange = async (statusId: string, newColor: string) => {
    try {
      const { error } = await supabase
        .from("status_colors")
        .update({ color: newColor })
        .eq("id", statusId);

      if (error) throw error;

      setStatusColors(prev => 
        prev.map(sc => sc.id === statusId ? { ...sc, color: newColor } : sc)
      );

      // Dispatch custom event to update other components
      window.dispatchEvent(new CustomEvent("status-colors-changed"));

      toast.success("Warna status berhasil diubah");
    } catch (error) {
      console.error("Error updating status color:", error);
      toast.error("Gagal mengubah warna status");
    }
  };

  const canEditColors = userRole === "admin" || userRole === "leader";

  const applyFontSettings = () => {
    document.documentElement.style.fontFamily = `var(--font-${fontFamily})`;
    const weightMap: Record<string, string> = {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    };
    document.documentElement.style.fontWeight = weightMap[fontWeight] || "400";
  };

  const applyPrimaryColor = () => {
    // Convert hex to HSL
    const hexToHSL = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return "262 83% 58%"; // default purple
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      h = Math.round(h * 360);
      s = Math.round(s * 100);
      l = Math.round(l * 100);
      
      return `${h} ${s}% ${l}%`;
    };
    
    document.documentElement.style.setProperty('--primary', hexToHSL(primaryColor));
  };

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value);
    localStorage.setItem("app-font-family", value);
    document.documentElement.style.fontFamily = `var(--font-${value})`;
    toast.success("Jenis font berhasil diubah");
  };

  const handleFontWeightChange = (value: string) => {
    setFontWeight(value);
    localStorage.setItem("app-font-weight", value);
    const weightMap: Record<string, string> = {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    };
    document.documentElement.style.fontWeight = weightMap[value] || "400";
    toast.success("Ketebalan font berhasil diubah");
  };

  const handlePrimaryColorChange = (value: string) => {
    setPrimaryColor(value);
    localStorage.setItem("app-primary-color", value);
    
    // Convert hex to HSL
    const hexToHSL = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return "262 83% 58%"; // default purple
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      h = Math.round(h * 360);
      s = Math.round(s * 100);
      l = Math.round(l * 100);
      
      return `${h} ${s}% ${l}%`;
    };
    
    document.documentElement.style.setProperty('--primary', hexToHSL(value));
    toast.success("Warna tema berhasil diubah");
  };

  const handleBookingTextColorChange = (value: string) => {
    setBookingTextColor(value);
    localStorage.setItem("booking-text-color", value);
    window.dispatchEvent(new CustomEvent("booking-text-color-changed"));
    toast.success("Warna teks booking berhasil diubah");
  };

  const handleReadyUsedColorChange = (value: string) => {
    setReadyUsedColor(value);
    localStorage.setItem("ready-used-color", value);
    window.dispatchEvent(new CustomEvent("ready-used-color-changed"));
    toast.success("Warna Ready (Sudah Dipakai) berhasil diubah");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Pengaturan Tampilan Kalender Okupansi
          </CardTitle>
          <CardDescription>
            Atur ukuran tampilan kalender okupansi sesuai kebutuhan Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ukuran Tampilan</label>
            <Select value={displaySize} onValueChange={handleDisplaySizeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="normal">Normal - Seimbang</SelectItem>
                <SelectItem value="compact">Compact - Muat lebih banyak kamar</SelectItem>
                <SelectItem value="large">Extra Compact - Semua kamar tanpa scroll</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Pilih ukuran tampilan yang sesuai dengan jumlah kamar dan ukuran layar Anda
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Pengaturan Warna Status Booking
              </CardTitle>
              <CardDescription>
                Atur warna untuk setiap status booking (BO, CI, CO, BATAL)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsColorSettingsOpen(!isColorSettingsOpen)}
              className="h-8 w-8 p-0"
            >
              {isColorSettingsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isColorSettingsOpen && (
          <CardContent className="space-y-4">
          {statusColors.map((statusColor) => (
            <div key={statusColor.id} className="space-y-2">
              <label className="text-sm font-medium">
                Warna {statusColor.status}
                {statusColor.status === 'BO' && ' (Booking Only)'}
                {statusColor.status === 'CI' && ' (Check In)'}
                {statusColor.status === 'CO' && ' (Check Out)'}
                {statusColor.status === 'BATAL' && ' (Dibatalkan)'}
              </label>
              <Select 
                value={statusColor.color} 
                onValueChange={(value) => handleColorChange(statusColor.id, value)}
                disabled={!canEditColors}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: statusColor.color }}
                    />
                    <span>{statusColor.color}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="#87CEEB">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#87CEEB" }} />
                      <span>Sky Blue - #87CEEB</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#90EE90">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#90EE90" }} />
                      <span>Light Green - #90EE90</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFB6C1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFB6C1" }} />
                      <span>Light Pink - #FFB6C1</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFFFE0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFFFE0" }} />
                      <span>Light Yellow - #FFFFE0</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#E6E6FA">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#E6E6FA" }} />
                      <span>Lavender - #E6E6FA</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFD700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFD700" }} />
                      <span>Gold - #FFD700</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFA500">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFA500" }} />
                      <span>Orange - #FFA500</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FF6B6B">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FF6B6B" }} />
                      <span>Coral Red - #FF6B6B</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#6B7280">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#6B7280" }} />
                      <span>Gray - #6B7280</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#4ECDC4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#4ECDC4" }} />
                      <span>Turquoise - #4ECDC4</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
            {/* Ready (Sudah Dipakai) color setting */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium">
                Warna Ready (Sudah Dipakai)
              </label>
              <p className="text-xs text-muted-foreground">
                Warna cell kamar yang sudah pernah diisi dan sudah di-ready-kan
              </p>
              <Select 
                value={readyUsedColor} 
                onValueChange={handleReadyUsedColorChange}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: readyUsedColor }}
                    />
                    <span>{readyUsedColor}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="#10B981">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#10B981" }} />
                      <span>Emerald - #10B981</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#34D399">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#34D399" }} />
                      <span>Light Emerald - #34D399</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#90EE90">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#90EE90" }} />
                      <span>Light Green - #90EE90</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#4ECDC4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#4ECDC4" }} />
                      <span>Turquoise - #4ECDC4</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#87CEEB">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#87CEEB" }} />
                      <span>Sky Blue - #87CEEB</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFD700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFD700" }} />
                      <span>Gold - #FFD700</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#FFA500">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#FFA500" }} />
                      <span>Orange - #FFA500</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#E6E6FA">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#E6E6FA" }} />
                      <span>Lavender - #E6E6FA</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#9CA3AF">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#9CA3AF" }} />
                      <span>Gray - #9CA3AF</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!canEditColors && (
              <p className="text-sm text-muted-foreground">
                Hanya admin dan leader yang dapat mengubah warna status
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Pengaturan Font dan Warna Tema
              </CardTitle>
              <CardDescription>
                Atur jenis font, ketebalan font, dan warna tema aplikasi
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFontSettingsOpen(!isFontSettingsOpen)}
              className="h-8 w-8 p-0"
            >
              {isFontSettingsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isFontSettingsOpen && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Jenis Font</label>
              <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="inter">
                    <span style={{ fontFamily: 'Inter, sans-serif' }}>Inter</span>
                  </SelectItem>
                  <SelectItem value="poppins">
                    <span style={{ fontFamily: 'Poppins, sans-serif' }}>Poppins</span>
                  </SelectItem>
                  <SelectItem value="roboto">
                    <span style={{ fontFamily: 'Roboto, sans-serif' }}>Roboto</span>
                  </SelectItem>
                  <SelectItem value="lato">
                    <span style={{ fontFamily: 'Lato, sans-serif' }}>Lato</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Pilih jenis font yang akan digunakan di seluruh aplikasi
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ketebalan Font</label>
              <Select value={fontWeight} onValueChange={handleFontWeightChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="light">Light (300)</SelectItem>
                  <SelectItem value="normal">Normal (400)</SelectItem>
                  <SelectItem value="medium">Medium (500)</SelectItem>
                  <SelectItem value="semibold">Semibold (600)</SelectItem>
                  <SelectItem value="bold">Bold (700)</SelectItem>
                  <SelectItem value="extrabold">Extra Bold (800)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Pilih ketebalan font yang akan digunakan
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warna Tema Utama</label>
              <Select value={primaryColor} onValueChange={handlePrimaryColorChange}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span>{primaryColor}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="#8B5CF6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#8B5CF6" }} />
                      <span>Purple - #8B5CF6</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#3B82F6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#3B82F6" }} />
                      <span>Blue - #3B82F6</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#10B981">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#10B981" }} />
                      <span>Green - #10B981</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#F59E0B">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#F59E0B" }} />
                      <span>Orange - #F59E0B</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#EF4444">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#EF4444" }} />
                      <span>Red - #EF4444</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#EC4899">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#EC4899" }} />
                      <span>Pink - #EC4899</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#14B8A6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#14B8A6" }} />
                      <span>Teal - #14B8A6</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#6366F1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#6366F1" }} />
                      <span>Indigo - #6366F1</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Pilih warna tema utama aplikasi
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warna Teks Booking</label>
              <Select value={bookingTextColor} onValueChange={handleBookingTextColorChange}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: bookingTextColor }}
                    />
                    <span>{bookingTextColor}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="#000000">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#000000" }} />
                      <span>Black - #000000</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#1F2937">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#1F2937" }} />
                      <span>Dark Gray - #1F2937</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#374151">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#374151" }} />
                      <span>Gray - #374151</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#4B5563">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#4B5563" }} />
                      <span>Medium Gray - #4B5563</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="#6B7280">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: "#6B7280" }} />
                      <span>Light Gray - #6B7280</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Pilih warna teks pada kartu booking untuk meningkatkan kontras
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Room Variant Schedule Settings - Admin/Leader Only */}
      {(userRole === "admin" || userRole === "leader") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bed className="h-5 w-5" />
                  Pengaturan Jadwal Varian Kamar
                </CardTitle>
                <CardDescription>
                  Atur kapan varian muncul (weekdays/weekends) dan durasi blokir (jam/hari/minggu/bulan)
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRoomSettingsOpen(true)}
                className="h-8"
              >
                Kelola
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Variant Schedule Settings Dialog */}
      <VariantScheduleSettings 
        isOpen={isRoomSettingsOpen}
        onClose={() => setIsRoomSettingsOpen(false)}
      />

      {/* Outlet Management - Admin Only */}
      {userRole === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Manajemen Outlet
                </CardTitle>
                <CardDescription>
                  Kelola cabang/outlet yang tersedia dalam sistem
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOutletSettingsOpen(!isOutletSettingsOpen)}
                className="h-8 w-8 p-0"
              >
                {isOutletSettingsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {isOutletSettingsOpen && (
            <CardContent>
              <StoreManagement />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
