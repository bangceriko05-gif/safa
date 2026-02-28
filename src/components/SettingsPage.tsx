import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Bell, Bed, Store, Palette, Type, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { usePermissions } from "@/hooks/usePermissions";
import NoAccessMessage from "./NoAccessMessage";
import { useEffect } from "react";
import StoreManagement from "./StoreManagement";
import VariantScheduleSettings from "./VariantScheduleSettings";
import NotificationSettings from "./NotificationSettings";
import PrintSettingsComponent from "./PrintSettings";
import OtaSourceManagement from "./OtaSourceManagement";

interface StatusColor {
  id: string;
  status: string;
  color: string;
}

interface SettingsPageProps {
  userRole?: string | null;
}

export default function SettingsPage({ userRole }: SettingsPageProps) {
  const { currentStore } = useStore();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("display");
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  
  // Display settings state
  const [displaySize, setDisplaySize] = useState<string>(() => {
    return localStorage.getItem("schedule-display-size") || "normal";
  });
  
  // Color settings state
  const [statusColors, setStatusColors] = useState<StatusColor[]>([]);
  const [bookingTextColor, setBookingTextColor] = useState<string>(() => {
    return localStorage.getItem("booking-text-color") || "#1F2937";
  });
  
  // Font settings state
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem("app-font-family") || "inter";
  });
  const [fontWeight, setFontWeight] = useState<string>(() => {
    return localStorage.getItem("app-font-weight") || "normal";
  });
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    return localStorage.getItem("app-primary-color") || "#8B5CF6";
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
        window.dispatchEvent(new CustomEvent("status-colors-changed"));
      } else {
        setStatusColors(data);
      }
    } catch (error) {
      console.error("Error fetching status colors:", error);
    }
  };

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
    const hexToHSL = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return "262 83% 58%";
      
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

  const handleDisplaySizeChange = (value: string) => {
    setDisplaySize(value);
    localStorage.setItem("schedule-display-size", value);
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
      window.dispatchEvent(new CustomEvent("status-colors-changed"));
      toast.success("Warna status berhasil diubah");
    } catch (error) {
      console.error("Error updating status color:", error);
      toast.error("Gagal mengubah warna status");
    }
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
    
    const hexToHSL = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return "262 83% 58%";
      
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

  const canEditColors = userRole === "admin" || userRole === "leader";

  const colorOptions = [
    { value: "#87CEEB", label: "Sky Blue" },
    { value: "#90EE90", label: "Light Green" },
    { value: "#FFB6C1", label: "Light Pink" },
    { value: "#FFFFE0", label: "Light Yellow" },
    { value: "#E6E6FA", label: "Lavender" },
    { value: "#FFD700", label: "Gold" },
    { value: "#FFA500", label: "Orange" },
    { value: "#FF6B6B", label: "Coral Red" },
    { value: "#6B7280", label: "Gray" },
    { value: "#4ECDC4", label: "Turquoise" },
  ];

  const primaryColorOptions = [
    { value: "#8B5CF6", label: "Purple" },
    { value: "#3B82F6", label: "Blue" },
    { value: "#10B981", label: "Green" },
    { value: "#F59E0B", label: "Amber" },
    { value: "#EF4444", label: "Red" },
    { value: "#EC4899", label: "Pink" },
    { value: "#6366F1", label: "Indigo" },
    { value: "#14B8A6", label: "Teal" },
  ];

  const textColorOptions = [
    { value: "#000000", label: "Black" },
    { value: "#1F2937", label: "Dark Gray" },
    { value: "#374151", label: "Gray" },
    { value: "#4B5563", label: "Medium Gray" },
    { value: "#6B7280", label: "Light Gray" },
  ];

  const readyUsedColorOptions = [
    { value: "#10B981", label: "Emerald" },
    { value: "#34D399", label: "Light Emerald" },
    { value: "#90EE90", label: "Light Green" },
    { value: "#4ECDC4", label: "Turquoise" },
    { value: "#06B6D4", label: "Cyan" },
    { value: "#3B82F6", label: "Blue" },
    { value: "#F59E0B", label: "Amber" },
    { value: "#FFB6C1", label: "Light Pink" },
    { value: "#9CA3AF", label: "Gray" },
  ];

  if (!hasPermission("manage_settings")) {
    return <NoAccessMessage featureName="Pengaturan" />;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full" style={{ 
          gridTemplateColumns: userRole === "admin" 
            ? "repeat(6, 1fr)" 
            : (userRole === "leader" ? "repeat(5, 1fr)" : "repeat(3, 1fr)")
        }}>
          <TabsTrigger value="display" className="text-xs sm:text-sm">
            <Monitor className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Tampilan</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="text-xs sm:text-sm">
            <Palette className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Warna</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">
            <Bell className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Notifikasi</span>
          </TabsTrigger>
          {(userRole === "admin" || userRole === "leader") && (
            <>
              <TabsTrigger value="print" className="text-xs sm:text-sm">
                <Printer className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nota</span>
              </TabsTrigger>
              <TabsTrigger value="rooms" className="text-xs sm:text-sm">
                <Bed className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Kamar</span>
              </TabsTrigger>
            </>
          )}
          {userRole === "admin" && (
            <TabsTrigger value="outlet" className="text-xs sm:text-sm">
              <Store className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Outlet</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Display Settings */}
        <TabsContent value="display" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Pengaturan Tampilan Kalender
              </CardTitle>
              <CardDescription>
                Atur ukuran tampilan kalender okupansi
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Pengaturan Font
              </CardTitle>
              <CardDescription>
                Atur jenis dan ketebalan font
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Font</label>
                  <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="poppins">Poppins</SelectItem>
                      <SelectItem value="roboto">Roboto</SelectItem>
                      <SelectItem value="lato">Lato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ketebalan Font</label>
                  <Select value={fontWeight} onValueChange={handleFontWeightChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="semibold">Semibold</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Color Settings */}
        <TabsContent value="colors" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Warna Tema Aplikasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Warna Utama</label>
                <Select value={primaryColor} onValueChange={handlePrimaryColorChange}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: primaryColor }} />
                      <span>{primaryColorOptions.find(c => c.value === primaryColor)?.label || primaryColor}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {primaryColorOptions.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Warna Teks Booking</label>
                <Select value={bookingTextColor} onValueChange={handleBookingTextColorChange}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: bookingTextColor }} />
                      <span>{textColorOptions.find(c => c.value === bookingTextColor)?.label || bookingTextColor}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {textColorOptions.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warna Status Booking</CardTitle>
              <CardDescription>
                Atur warna untuk setiap status booking (BO, CI, CO, BATAL)
              </CardDescription>
            </CardHeader>
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
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: statusColor.color }} />
                        <span>{statusColor.color}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {colorOptions.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded border" style={{ backgroundColor: color.value }} />
                            <span>{color.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {/* Ready (Sudah Dipakai) color setting */}
              <div className="space-y-2 pt-4 border-t border-border">
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
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: readyUsedColor }} />
                      <span>{readyUsedColorOptions.find(c => c.value === readyUsedColor)?.label || readyUsedColor}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {readyUsedColorOptions.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!canEditColors && (
                <p className="text-sm text-muted-foreground">
                  Hanya admin dan leader yang dapat mengubah warna status
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="mt-4">
          <NotificationSettings />
        </TabsContent>

        {/* Print Settings */}
        {(userRole === "admin" || userRole === "leader") && (
          <TabsContent value="print" className="mt-4">
            <PrintSettingsComponent />
          </TabsContent>
        )}

        {/* Room Settings */}
        {(userRole === "admin" || userRole === "leader") && (
          <TabsContent value="rooms" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bed className="h-5 w-5" />
                  Pengaturan Jadwal Varian Kamar
                </CardTitle>
                <CardDescription>
                  Atur kapan varian muncul (weekdays/weekends) dan durasi blokir (jam/hari/minggu/bulan)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setIsRoomSettingsOpen(true)}>
                  Kelola Pengaturan Varian
                </Button>
              </CardContent>
            </Card>

            <VariantScheduleSettings 
              isOpen={isRoomSettingsOpen}
              onClose={() => setIsRoomSettingsOpen(false)}
            />

            <OtaSourceManagement />
          </TabsContent>
        )}

        {/* Outlet Management */}
        {userRole === "admin" && (
          <TabsContent value="outlet" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Manajemen Outlet
                </CardTitle>
                <CardDescription>
                  Kelola cabang/outlet yang tersedia dalam sistem
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoreManagement />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
