import { useEffect, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  requiredRole: "super_admin" | "admin_toko";
  storeId?: string;
}

export function AuthGuard({ children, requiredRole, storeId }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [location.pathname, storeId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to appropriate auth page
        if (requiredRole === "super_admin") {
          navigate("/auth");
        } else if (storeId) {
          // Get store slug for redirect
          const { data: store } = await supabase
            .from("stores")
            .select("slug")
            .eq("id", storeId)
            .single();
          
          if (store) {
            navigate(`/${store.slug}/auth`);
          } else {
            navigate("/auth");
          }
        }
        return;
      }

      if (requiredRole === "super_admin") {
        // Check if user is super admin
        const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
          _user_id: user.id
        });

        if (!isSuperAdmin) {
          // Check if user has access to any store - redirect there
          const { data: storeAccess } = await supabase
            .from("user_store_access")
            .select("store_id, stores(slug)")
            .eq("user_id", user.id)
            .limit(1)
            .single();

          if (storeAccess?.stores) {
            navigate(`/${(storeAccess.stores as any).slug}/dashboard`);
          } else {
            // No access anywhere - sign out
            await supabase.auth.signOut();
            navigate("/auth");
          }
          return;
        }

        setIsAuthorized(true);
      } else if (requiredRole === "admin_toko" && storeId) {
        // Check if super admin first - they should not access store pages
        const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
          _user_id: user.id
        });

        if (isSuperAdmin) {
          // Super admin should go to main dashboard
          navigate("/dashboard");
          return;
        }

        // Check if user has access to this specific store
        const { data: access } = await supabase
          .from("user_store_access")
          .select("role")
          .eq("user_id", user.id)
          .eq("store_id", storeId)
          .single();

        if (!access) {
          // User doesn't have access to this store
          // Check if they have access to another store
          const { data: otherAccess } = await supabase
            .from("user_store_access")
            .select("store_id, stores(slug)")
            .eq("user_id", user.id)
            .limit(1)
            .single();

          if (otherAccess?.stores) {
            navigate(`/${(otherAccess.stores as any).slug}/dashboard`);
          } else {
            await supabase.auth.signOut();
            navigate("/auth");
          }
          return;
        }

        setIsAuthorized(true);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
