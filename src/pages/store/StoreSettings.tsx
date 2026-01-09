import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, ArrowLeft, Save, Eye } from "lucide-react";
import { useStoreBySlug } from "@/hooks/useStoreBySlug";

interface LoginSettings {
  id?: string;
  store_id: string;
  company_name: string;
  subtitle: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
}

export default function StoreSettings() {
  const { store, isLoading: storeLoading, error: storeError, storeSlug } = useStoreBySlug();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [settings, setSettings] = useState<LoginSettings>({
    store_id: '',
    company_name: 'Safa Kost & Guesthouse',
    subtitle: 'Masukkan email dan password Anda',
    logo_url: null,
    primary_color: '#3b82f6',
    background_color: '#f8fafc',
  });

  useEffect(() => {
    if (store) {
      checkAuthAndLoadSettings();
    }
  }, [store]);

  const checkAuthAndLoadSettings = async () => {
    if (!store) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate(`/${storeSlug}/auth`);
        return;
      }

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      if (isSuperAdmin) {
        setHasAccess(true);
      } else {
        // Check if user is admin for this store
        const { data: access } = await supabase
          .from('user_store_access')
          .select('role')
          .eq('user_id', user.id)
          .eq('store_id', store.id)
          .single();

        if (access?.role !== 'admin') {
          toast.error('Hanya admin yang dapat mengakses halaman ini');
          navigate(`/${storeSlug}`);
          return;
        }
        setHasAccess(true);
      }

      // Load existing settings
      const { data: existingSettings } = await supabase
        .from('login_settings')
        .select('*')
        .eq('store_id', store.id)
        .single();

      if (existingSettings) {
        setSettings(existingSettings as LoginSettings);
      } else {
        setSettings(prev => ({ 
          ...prev, 
          store_id: store.id,
          company_name: store.name 
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${store.id}-${Date.now()}.${fileExt}`;
      const filePath = `login-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo berhasil diupload');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Gagal mengupload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!store) return;

    setSaving(true);
    try {
      const dataToSave = {
        store_id: store.id,
        company_name: settings.company_name,
        subtitle: settings.subtitle,
        logo_url: settings.logo_url,
        primary_color: settings.primary_color,
        background_color: settings.background_color,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('login_settings')
          .update(dataToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('login_settings')
          .insert(dataToSave);

        if (error) throw error;
      }

      toast.success('Pengaturan berhasil disimpan');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (storeLoading || loading) {
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

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${storeSlug}/dashboard`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Pengaturan Login - {store.name}</h1>
            <p className="text-muted-foreground">Kustomisasi tampilan halaman login</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Perusahaan</CardTitle>
            <CardDescription>
              Pengaturan ini akan ditampilkan di halaman login
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo Perusahaan</Label>
              <div className="flex items-center gap-4">
                {settings.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo" 
                    className="w-20 h-20 object-contain rounded-lg border bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: JPG, PNG. Maksimal 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name">Nama Perusahaan</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Masukkan nama perusahaan"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle / Deskripsi</Label>
              <Textarea
                id="subtitle"
                value={settings.subtitle}
                onChange={(e) => setSettings(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Masukkan deskripsi singkat"
                rows={2}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Warna Utama</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primary_color"
                    value={settings.primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="background_color">Warna Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="background_color"
                    value={settings.background_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, background_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.background_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, background_color: e.target.value }))}
                    placeholder="#f8fafc"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]"
              style={{ backgroundColor: settings.background_color }}
            >
              {settings.logo_url && (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  className="w-16 h-16 object-contain mb-4"
                />
              )}
              <h2 className="text-xl font-bold text-center" style={{ color: settings.primary_color }}>
                Masuk ke {settings.company_name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{settings.subtitle}</p>
              <div className="mt-4 w-full max-w-xs space-y-2">
                <div className="h-10 bg-white rounded border" />
                <div className="h-10 bg-white rounded border" />
                <div 
                  className="h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  Masuk
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/${storeSlug}`)}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </div>
  );
}
