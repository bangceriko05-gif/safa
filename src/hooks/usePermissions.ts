import { useEffect, useState } from "react";
import { fetchCurrentUserPermissionAccess } from "@/utils/permissionCache";

export function usePermissions(enabled = true, knownRole?: string | null) {
  const [userPermissionNames, setUserPermissionNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchUserPermissions();
  }, [enabled, knownRole]);

  const fetchUserPermissions = async (force = false) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { names } = await fetchCurrentUserPermissionAccess(knownRole, force);
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

  return { hasPermission, hasAnyPermission, loading, refresh: () => fetchUserPermissions(true) };
}
