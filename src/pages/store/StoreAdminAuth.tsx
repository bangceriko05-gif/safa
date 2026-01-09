import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { loginSchema } from "@/utils/authValidation";
import { useStoreBySlug } from "@/hooks/useStoreBySlug";

interface ValidationErrors {
  email?: string;
  password?: string;
}

interface LoginSettings {
  company_name: string;
  subtitle: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
}

export default function StoreAdminAuth() {
  const { store, isLoading: storeLoading, error: storeError, storeSlug } = useStoreBySlug();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loginSettings, setLoginSettings] = useState<LoginSettings>({
    company_name: '',
    subtitle: 'Masukkan email dan password Anda',
    logo_url: null,
    primary_color: '#3b82f6',
    background_color: '#f8fafc',
  });

  useEffect(() => {
    if (store) {
      checkExistingAuth();
      loadLoginSettings();
    }
  }, [store]);

  const checkExistingAuth = async () => {
    if (!store) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if super admin - they should not be here
        const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
          _user_id: user.id
        });

        if (isSuperAdmin) {
          // Redirect to main admin dashboard
          navigate("/dashboard");
          return;
        }

        // Check if user has access to THIS store
        const { data: access } = await supabase
          .from("user_store_access")
          .select("role")
          .eq("user_id", user.id)
          .eq("store_id", store.id)
          .single();

        if (access) {
          navigate(`/${storeSlug}/dashboard`);
          return;
        }

        // User is logged in but doesn't have access to this store
        // Check if they have access to another store
        const { data: otherAccess } = await supabase
          .from("user_store_access")
          .select("store_id, stores(slug)")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (otherAccess?.stores) {
          toast.error(`Anda tidak memiliki akses ke ${store.name}`);
          navigate(`/${(otherAccess.stores as any).slug}/dashboard`);
          return;
        }

        // No access anywhere
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    // Load saved email
    const savedEmail = localStorage.getItem(`store_email_${storeSlug}`);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session && store) {
          // Check if super admin - redirect to main dashboard
          const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
            _user_id: session.user.id
          });

          if (isSuperAdmin) {
            navigate("/dashboard");
            return;
          }

          // Check access to this store
          const { data: access } = await supabase
            .from("user_store_access")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("store_id", store.id)
            .single();

          if (access) {
            navigate(`/${storeSlug}/dashboard`);
          } else {
            toast.error(`Anda tidak memiliki akses ke ${store.name}`);
            await supabase.auth.signOut();
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, store, storeSlug]);

  const loadLoginSettings = async () => {
    if (!store) return;
    
    try {
      const { data } = await supabase
        .from('login_settings')
        .select('*')
        .eq('store_id', store.id)
        .single();

      if (data) {
        setLoginSettings({
          company_name: data.company_name || store.name,
          subtitle: data.subtitle || 'Masukkan email dan password Anda',
          logo_url: data.logo_url,
          primary_color: data.primary_color || '#3b82f6',
          background_color: data.background_color || '#f8fafc',
        });
      } else {
        setLoginSettings(prev => ({
          ...prev,
          company_name: store.name
        }));
      }
    } catch (error) {
      setLoginSettings(prev => ({
        ...prev,
        company_name: store?.name || ''
      }));
    }
  };

  const validateForm = (): boolean => {
    setErrors({});
    
    try {
      loginSchema.parse({ email, password });
      return true;
    } catch (error: any) {
      if (error.errors) {
        const newErrors: ValidationErrors = {};
        error.errors.forEach((err: any) => {
          const field = err.path[0] as keyof ValidationErrors;
          if (!newErrors[field]) {
            newErrors[field] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !store) {
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      
      // Check if super admin - redirect to main dashboard
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: data.user.id
      });

      if (isSuperAdmin) {
        toast.info("Super Admin akan diarahkan ke dashboard utama");
        navigate("/dashboard");
        return;
      }

      // Check access to this store
      const { data: access } = await supabase
        .from("user_store_access")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("store_id", store.id)
        .single();

      if (!access) {
        toast.error(`Anda tidak memiliki akses ke ${store.name}`);
        await supabase.auth.signOut();
        return;
      }

      // Save email if remember me
      if (rememberMe) {
        localStorage.setItem(`store_email_${storeSlug}`, email.trim());
      } else {
        localStorage.removeItem(`store_email_${storeSlug}`);
      }

      localStorage.setItem("current_store_id", store.id);
      
      await logActivity({
        actionType: 'login',
        entityType: 'System',
        description: `Login ke ${store.name}`,
        storeId: store.id,
      });
      
      toast.success("Login berhasil!");
      navigate(`/${storeSlug}/dashboard`);
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (storeLoading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold mb-2">Toko Tidak Ditemukan</h2>
            <p className="text-muted-foreground mb-4">
              URL "{storeSlug}" tidak valid atau toko tidak aktif.
            </p>
            <Button onClick={() => navigate("/auth")}>
              Kembali ke Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{ backgroundColor: loginSettings.background_color }}
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          {loginSettings.logo_url && (
            <div className="flex justify-center mb-2">
              <img 
                src={loginSettings.logo_url} 
                alt="Logo" 
                className="w-16 h-16 object-contain"
              />
            </div>
          )}
          <CardTitle 
            className="text-2xl font-bold text-center"
            style={{ color: loginSettings.primary_color }}
          >
            {loginSettings.company_name}
          </CardTitle>
          <CardDescription className="text-center">
            {loginSettings.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer"
              >
                Ingat email saya
              </Label>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Masuk
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Hanya untuk admin {store.name}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
