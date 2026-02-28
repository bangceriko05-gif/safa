import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePermissions() {
  const [userPermissionNames, setUserPermissionNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is admin (admins have all permissions)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role === "admin") {
        // Admin has all permissions - set a special flag
        setUserPermissionNames(new Set(["__admin__"]));
        setLoading(false);
        return;
      }

      // Fetch user's permissions with names
      const { data: userPerms, error } = await supabase
        .from("user_permissions")
        .select("permission_id, permissions(name)")
        .eq("user_id", user.id);

      if (error) throw error;

      const names = new Set<string>();
      userPerms?.forEach((up: any) => {
        if (up.permissions?.name) {
          names.add(up.permissions.name);
        }
      });

      setUserPermissionNames(names);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    // Admins have all permissions
    if (userPermissionNames.has("__admin__")) return true;
    return userPermissionNames.has(permissionName);
  };

  const hasAnyPermission = (permissionNames: string[]): boolean => {
    if (userPermissionNames.has("__admin__")) return true;
    return permissionNames.some(name => userPermissionNames.has(name));
  };

  return { hasPermission, hasAnyPermission, loading, refresh: fetchUserPermissions };
}
