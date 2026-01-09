import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { loginSchema } from "@/utils/authValidation";

interface ValidationErrors {
  email?: string;
  password?: string;
}

export default function AdminAuth() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if super admin
        const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
          _user_id: user.id
        });

        if (isSuperAdmin) {
          navigate("/dashboard");
          return;
        }

        // Not super admin - check if admin toko
        const { data: storeAccess } = await supabase
          .from("user_store_access")
          .select("store_id, stores(slug)")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (storeAccess?.stores) {
          // Redirect to their store
          navigate(`/${(storeAccess.stores as any).slug}/dashboard`);
          return;
        }

        // No valid access - sign out
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
    const savedEmail = localStorage.getItem("admin_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Check if super admin
          const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
            _user_id: session.user.id
          });

          if (isSuperAdmin) {
            navigate("/dashboard");
          } else {
            // Check for store access
            const { data: storeAccess } = await supabase
              .from("user_store_access")
              .select("store_id, stores(slug)")
              .eq("user_id", session.user.id)
              .limit(1)
              .single();

            if (storeAccess?.stores) {
              navigate(`/${(storeAccess.stores as any).slug}/dashboard`);
            } else {
              toast.error("Anda tidak memiliki akses ke sistem ini");
              await supabase.auth.signOut();
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      
      // Save or remove email based on remember me
      if (rememberMe) {
        localStorage.setItem("admin_email", email.trim());
      } else {
        localStorage.removeItem("admin_email");
      }

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: data.user.id
      });

      if (isSuperAdmin) {
        await logActivity({
          actionType: 'login',
          entityType: 'System',
          description: 'Super Admin login ke sistem',
        });
        toast.success("Login berhasil!");
        navigate("/dashboard");
      } else {
        // Check for store access
        const { data: storeAccess } = await supabase
          .from("user_store_access")
          .select("store_id, stores(slug)")
          .eq("user_id", data.user.id)
          .limit(1)
          .single();

        if (storeAccess?.stores) {
          await logActivity({
            actionType: 'login',
            entityType: 'System',
            description: 'Admin Toko login ke sistem',
            storeId: storeAccess.store_id,
          });
          toast.success("Login berhasil!");
          navigate(`/${(storeAccess.stores as any).slug}/dashboard`);
        } else {
          toast.error("Anda tidak memiliki akses ke sistem ini");
          await supabase.auth.signOut();
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            SafaClouds Admin
          </CardTitle>
          <CardDescription>
            Masuk untuk mengakses panel administrasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@safaclouds.com"
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
            Hanya untuk administrator yang memiliki akses
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
