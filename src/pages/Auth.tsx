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
import { signupSchema, loginSchema } from "@/utils/authValidation";

interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved email only (password should never be stored)
    const savedEmail = localStorage.getItem("treebox_email");
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    
    // Clean up any previously stored passwords
    localStorage.removeItem("treebox_password");

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          navigate("/select-store");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = (): boolean => {
    setErrors({});
    
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ name, email, password });
      }
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
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        
        // Save or remove email based on remember me (never store password)
        if (rememberMe) {
          localStorage.setItem("treebox_email", email.trim());
        } else {
          localStorage.removeItem("treebox_email");
        }
        
        // Log login activity
        await logActivity({
          actionType: 'login',
          entityType: 'System',
          description: 'Login ke sistem',
        });
        
        toast.success("Login berhasil!");
        navigate("/select-store");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: name.trim(),
            },
          },
        });

        if (error) throw error;

        // Auto-promote to admin
        if (data.session) {
          try {
            await supabase.functions.invoke('setup-admin', {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`
              }
            });
            toast.success("Akun admin berhasil dibuat! Silakan login.");
          } catch (adminError) {
            toast.success("Akun berhasil dibuat! Silakan login.");
          }
        } else {
          toast.success("Akun berhasil dibuat! Silakan login.");
        }
        
        setIsLogin(true);
        setName("");
        setPassword("");
        setErrors({});
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-main)" }}>
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Masuk ke Treebox" : "Daftar Treebox"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? "Masukkan email dan password Anda"
              : "Buat akun baru untuk mengakses dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  placeholder="Nama lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>
            )}
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
              {!isLogin && !errors.password && (
                <p className="text-xs text-muted-foreground">
                  Minimal 8 karakter, mengandung huruf besar dan angka
                </p>
              )}
            </div>
            
            {isLogin && (
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
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Masuk" : "Daftar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setName("");
                setPassword("");
                setErrors({});
              }}
              className="text-primary hover:underline"
            >
              {isLogin
                ? "Belum punya akun? Daftar di sini"
                : "Sudah punya akun? Masuk di sini"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
