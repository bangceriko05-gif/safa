import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, Copy, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import SuperAdminStoreManagement from "@/components/super-admin/SuperAdminStoreManagement";
import StoreDuplication from "@/components/super-admin/StoreDuplication";

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is super admin
      const { data: isSuperAdminResult } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      if (!isSuperAdminResult) {
        toast.error("Akses ditolak. Hanya Super Admin yang dapat mengakses halaman ini.");
        navigate("/");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      setUserName(profile?.name || user.email || "Super Admin");
      setIsSuperAdmin(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Error checking super admin access:", error);
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Super Admin Panel</h1>
                  <p className="text-sm text-muted-foreground">Kelola semua outlet dan pengaturan global</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Login sebagai:</span>
              <span className="font-medium text-foreground">{userName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stores" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Kelola Outlet
            </TabsTrigger>
            <TabsTrigger value="duplicate" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Salin Outlet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stores">
            <SuperAdminStoreManagement />
          </TabsContent>

          <TabsContent value="duplicate">
            <StoreDuplication />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
