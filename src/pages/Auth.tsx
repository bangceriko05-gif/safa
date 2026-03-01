import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
    const savedEmail = localStorage.getItem("anka_pms_email");
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    
    // Clean up any previously stored passwords
    localStorage.removeItem("anka_pms_password");

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Check if user exists in profiles (registered via User Management)
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (!profile) {
            // User not registered in PMS - sign out and show error
            await supabase.auth.signOut();
            toast.error("Akun Anda belum terdaftar di sistem. Hubungi admin untuk didaftarkan melalui Manajemen Pengguna.");
            return;
          }

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

        if (error) {
          // Handle specific error messages
          if (error.message === "Invalid login credentials") {
            // Check if email exists by attempting password reset (doesn't reveal if email exists in error)
            // For better UX, we show specific field errors
            setErrors({
              email: "Email atau password salah",
              password: "Periksa kembali email dan password Anda"
            });
            toast.error("Email atau password salah");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Email belum dikonfirmasi. Cek inbox email Anda.");
          } else {
            toast.error(error.message || "Terjadi kesalahan");
          }
          setLoading(false);
          return;
        }
        
        // Save or remove email based on remember me (never store password)
        if (rememberMe) {
          localStorage.setItem("anka_pms_email", email.trim());
        } else {
          localStorage.removeItem("anka_pms_email");
        }
        
        // Login activity will be logged in SelectStore when user selects a store
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

        if (error) {
          if (error.message.includes("already registered")) {
            setErrors({ email: "Email sudah terdaftar" });
            toast.error("Email sudah terdaftar, silakan login");
          } else {
            toast.error(error.message || "Terjadi kesalahan");
          }
          setLoading(false);
          return;
        }

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
            {isLogin ? "Masuk ke ANKA PMS" : "Daftar ANKA PMS"}
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) {
                  toast.error("Gagal login dengan Google");
                  console.error(error);
                }
              } catch (err) {
                toast.error("Gagal login dengan Google");
              } finally {
                setLoading(false);
              }
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Masuk dengan Google
          </Button>

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
