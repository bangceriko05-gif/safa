import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Printer, Building2, Phone, User, FileText } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PrintSettings {
  id?: string;
  store_id: string;
  paper_size: string;
  logo_url: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  manager_name: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_manager_signature: boolean;
  show_qr_code: boolean;
  print_format: string;
}

export default function PrintSettingsComponent() {
  const { currentStore } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>({
    store_id: "",
    paper_size: "80mm",
    logo_url: null,
    business_name: null,
    business_address: null,
    business_phone: null,
    manager_name: null,
    footer_text: null,
    show_logo: true,
    show_manager_signature: true,
    show_qr_code: false,
    print_format: "pdf",
  });

  useEffect(() => {
    if (currentStore) {
      fetchSettings();
    }
  }, [currentStore]);

  const fetchSettings = async () => {
    if (!currentStore) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("print_settings")
        .select("*")
        .eq("store_id", currentStore.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        // Set default with store info
        setSettings((prev) => ({
          ...prev,
          store_id: currentStore.id,
          business_name: currentStore.name,
          business_address: currentStore.location || null,
        }));
      }
    } catch (error: any) {
      console.error("Error fetching print settings:", error);
      toast.error("Gagal memuat pengaturan print");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentStore) return;
    setIsSaving(true);

    try {
      const settingsData = {
        ...settings,
        store_id: currentStore.id,
      };

      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from("print_settings")
          .update(settingsData)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("print_settings")
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
      }

      toast.success("Pengaturan print berhasil disimpan");
    } catch (error: any) {
      console.error("Error saving print settings:", error);
      toast.error("Gagal menyimpan pengaturan print");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStore) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diperbolehkan");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2MB");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `print-logo-${currentStore.id}-${Date.now()}.${fileExt}`;
      const filePath = `print-logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("print-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, just store as base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setSettings((prev) => ({
            ...prev,
            logo_url: reader.result as string,
          }));
          toast.success("Logo berhasil diupload");
        };
        reader.readAsDataURL(file);
        return;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("print-assets")
        .getPublicUrl(filePath);

      setSettings((prev) => ({
        ...prev,
        logo_url: data.publicUrl,
      }));

      toast.success("Logo berhasil diupload");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({
          ...prev,
          logo_url: reader.result as string,
        }));
        toast.success("Logo berhasil diupload");
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logo_url: null,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Pengaturan Nota/Receipt
          </CardTitle>
          <CardDescription>
            Atur tampilan nota yang akan dicetak untuk booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paper Size */}
          <div className="space-y-2">
            <Label htmlFor="paper_size">Ukuran Kertas</Label>
            <Select
              value={settings.paper_size}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, paper_size: value }))
              }
            >
              <SelectTrigger id="paper_size">
                <SelectValue placeholder="Pilih ukuran kertas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm (Thermal Mini)</SelectItem>
                <SelectItem value="80mm">80mm (Thermal Standard)</SelectItem>
                <SelectItem value="A4">A4 (210mm x 297mm)</SelectItem>
                <SelectItem value="A5">A5 (148mm x 210mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Print Format */}
          <div className="space-y-3">
            <Label>Format Print Invoice</Label>
            <RadioGroup
              value={settings.print_format}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, print_format: value }))
              }
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="pdf" id="format-pdf" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="format-pdf" className="font-medium cursor-pointer">
                    PDF Document
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Generate file PDF yang bisa diunduh dan dicetak ke printer biasa
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="thermal" id="format-thermal" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="format-thermal" className="font-medium cursor-pointer">
                    Thermal Printer
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Print langsung ke printer thermal (58mm/80mm) via browser
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo Usaha</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <div className="relative">
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="h-20 w-20 object-contain border rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                    onClick={handleRemoveLogo}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <div className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                  No Logo
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Logo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Format: JPG, PNG. Maks: 2MB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="show_logo"
                checked={settings.show_logo}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, show_logo: checked }))
                }
              />
              <Label htmlFor="show_logo" className="font-normal">
                Tampilkan logo di nota
              </Label>
            </div>
          </div>

          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="business_name" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Nama Usaha
            </Label>
            <Input
              id="business_name"
              value={settings.business_name || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, business_name: e.target.value }))
              }
              placeholder="Masukkan nama usaha"
            />
          </div>

          {/* Business Address */}
          <div className="space-y-2">
            <Label htmlFor="business_address">Alamat Usaha</Label>
            <Textarea
              id="business_address"
              value={settings.business_address || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, business_address: e.target.value }))
              }
              placeholder="Masukkan alamat lengkap usaha"
              rows={2}
            />
          </div>

          {/* Business Phone */}
          <div className="space-y-2">
            <Label htmlFor="business_phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Nomor Telepon Usaha
            </Label>
            <Input
              id="business_phone"
              value={settings.business_phone || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, business_phone: e.target.value }))
              }
              placeholder="Contoh: 0812-3456-7890"
            />
          </div>

          {/* Manager Name */}
          <div className="space-y-2">
            <Label htmlFor="manager_name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nama Manager (TTD)
            </Label>
            <Input
              id="manager_name"
              value={settings.manager_name || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, manager_name: e.target.value }))
              }
              placeholder="Nama manager yang akan tampil di TTD"
            />
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="show_manager_signature"
                checked={settings.show_manager_signature}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, show_manager_signature: checked }))
                }
              />
              <Label htmlFor="show_manager_signature" className="font-normal">
                Tampilkan TTD Manager di nota
              </Label>
            </div>
          </div>

          {/* Footer Text */}
          <div className="space-y-2">
            <Label htmlFor="footer_text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Teks Footer
            </Label>
            <Textarea
              id="footer_text"
              value={settings.footer_text || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, footer_text: e.target.value }))
              }
              placeholder="Contoh: Terima kasih atas kunjungan Anda!"
              rows={2}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Pengaturan"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
