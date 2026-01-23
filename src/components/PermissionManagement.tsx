import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Shield, User, Users, Check, Save } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface UserPermission {
  id: string;
  permission_id: string;
  user_id: string;
}

interface RolePermission {
  id: string;
  role: 'admin' | 'leader' | 'user';
  permission_id: string;
}

// Permission categories for better organization
const permissionCategories: Record<string, string[]> = {
  "Booking": ["create_bookings", "edit_bookings", "delete_bookings", "view_bookings", "checkin_bookings", "checkout_bookings", "cancel_bookings", "cancel_checkout_bookings"],
  "Kamar": ["manage_rooms", "view_rooms"],
  "Pelanggan": ["manage_customers", "view_customers"],
  "Keuangan": ["manage_income", "manage_expense", "view_reports"],
  "Produk": ["manage_products", "view_products"],
  "Toko": ["manage_stores", "view_stores"],
  "Pengguna": ["manage_users", "manage_permissions", "view_auth_orphans", "view_user_orphans"],
  "Pengaturan": ["manage_settings", "view_activity_logs"],
};

export default function PermissionManagement() {
  const { currentStore } = useStore();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'admin' | 'leader' | 'user' | ''>("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingUserChanges, setPendingUserChanges] = useState<Set<string>>(new Set());
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Set<string>>(new Set());
  const [hasUnsavedUserChanges, setHasUnsavedUserChanges] = useState(false);
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentStore?.id]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserPermissions(selectedUserId);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all permissions
      const { data: permData, error: permError } = await supabase
        .from("permissions")
        .select("*")
        .order("name");

      if (permError) throw permError;
      setPermissions(permData || []);

      // Filter users by current store access
      if (currentStore?.id) {
        // First get user IDs that have access to the current store
        const { data: storeAccessData, error: storeAccessError } = await supabase
          .from("user_store_access")
          .select("user_id")
          .eq("store_id", currentStore.id);

        if (storeAccessError) throw storeAccessError;

        const userIds = storeAccessData?.map(access => access.user_id) || [];

        if (userIds.length > 0) {
          // Fetch profiles for users with access to this store
          const { data: userData, error: userError } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds)
            .order("name");

          if (userError) throw userError;
          setUsers(userData || []);
        } else {
          setUsers([]);
        }
      } else {
        // No store selected, show no users
        setUsers([]);
      }
      
      // Reset selected user when store changes
      setSelectedUserId("");
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("id, permission_id, user_id")
        .eq("user_id", userId);

      if (error) throw error;
      setUserPermissions(data || []);
    } catch (error: any) {
      console.error("Error fetching user permissions:", error);
      toast.error("Gagal memuat permissions pengguna");
    }
  };

  const fetchRolePermissions = async (role: 'admin' | 'leader' | 'user') => {
    try {
      // Get permissions from role_permissions table
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id, role, permission_id")
        .eq("role", role);

      if (error) throw error;
      setRolePermissions(data || []);
    } catch (error: any) {
      console.error("Error fetching role permissions:", error);
      toast.error("Gagal memuat permissions role");
    }
  };

  const hasPermission = (permissionId: string) => {
    return userPermissions.some((up) => up.permission_id === permissionId);
  };

  const hasRolePermission = (permissionId: string) => {
    return rolePermissions.some((rp) => rp.permission_id === permissionId);
  };

  // Get permissions grouped by category
  const getPermissionsByCategory = () => {
    const result: Record<string, Permission[]> = {};
    
    Object.entries(permissionCategories).forEach(([category, permNames]) => {
      const categoryPerms = permissions.filter(p => permNames.includes(p.name));
      if (categoryPerms.length > 0) {
        result[category] = categoryPerms;
      }
    });
    
    // Add uncategorized permissions
    const categorizedNames = Object.values(permissionCategories).flat();
    const uncategorized = permissions.filter(p => !categorizedNames.includes(p.name));
    if (uncategorized.length > 0) {
      result["Lainnya"] = uncategorized;
    }
    
    return result;
  };

  const toggleUserPermissionLocal = (permissionId: string) => {
    setPendingUserChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
    setHasUnsavedUserChanges(true);
  };

  const toggleRolePermissionLocal = (permissionId: string) => {
    setPendingRoleChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
    setHasUnsavedRoleChanges(true);
  };

  const isUserPermissionChecked = (permissionId: string) => {
    const hasExisting = hasPermission(permissionId);
    const isPending = pendingUserChanges.has(permissionId);
    return hasExisting ? !isPending : isPending;
  };

  const isRolePermissionChecked = (permissionId: string) => {
    const hasExisting = hasRolePermission(permissionId);
    const isPending = pendingRoleChanges.has(permissionId);
    return hasExisting ? !isPending : isPending;
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserId || pendingUserChanges.size === 0) {
      toast.info("Tidak ada perubahan untuk disimpan");
      return;
    }

    setSaving(true);
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) throw new Error("User not authenticated");

      const toAdd: string[] = [];
      const toRemove: string[] = [];

      pendingUserChanges.forEach(permId => {
        if (hasPermission(permId)) {
          toRemove.push(permId);
        } else {
          toAdd.push(permId);
        }
      });

      // Remove permissions
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", selectedUserId)
          .in("permission_id", toRemove);
        if (error) throw error;
      }

      // Add permissions
      if (toAdd.length > 0) {
        const newPermissions = toAdd.map(permId => ({
          user_id: selectedUserId,
          permission_id: permId,
          granted_by: currentUser.data.user.id,
        }));
        const { error } = await supabase
          .from("user_permissions")
          .insert(newPermissions);
        if (error) throw error;
      }

      await logActivity({
        actionType: "updated",
        entityType: "Permission",
        description: `Mengubah ${toAdd.length + toRemove.length} permission untuk pengguna`,
      });

      toast.success("Perubahan permission berhasil disimpan");
      setPendingUserChanges(new Set());
      setHasUnsavedUserChanges(false);
      fetchUserPermissions(selectedUserId);
    } catch (error: any) {
      console.error("Error saving user permissions:", error);
      toast.error("Gagal menyimpan perubahan permission");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole || pendingRoleChanges.size === 0) {
      toast.info("Tidak ada perubahan untuk disimpan");
      return;
    }

    setSaving(true);
    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      pendingRoleChanges.forEach(permId => {
        if (hasRolePermission(permId)) {
          toRemove.push(permId);
        } else {
          toAdd.push(permId);
        }
      });

      // Remove permissions from role_permissions
      for (const permId of toRemove) {
        const existingPerm = rolePermissions.find(rp => rp.permission_id === permId);
        if (existingPerm) {
          await supabase.from("role_permissions").delete().eq("id", existingPerm.id);
        }
      }

      // Add permissions to role_permissions
      for (const permId of toAdd) {
        await supabase.from("role_permissions").insert({
          role: selectedRole,
          permission_id: permId,
        });
      }

      await logActivity({
        actionType: "updated",
        entityType: "Permission",
        description: `Mengubah ${toAdd.length + toRemove.length} permission untuk role ${selectedRole}`,
      });

      toast.success("Perubahan permission role berhasil disimpan");
      setPendingRoleChanges(new Set());
      setHasUnsavedRoleChanges(false);
      fetchRolePermissions(selectedRole);
    } catch (error: any) {
      console.error("Error saving role permissions:", error);
      toast.error("Gagal menyimpan perubahan permission role");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (permissionId: string, permissionName: string) => {
    if (!selectedUserId) {
      toast.error("Pilih pengguna terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) throw new Error("User not authenticated");

      const existingPermission = userPermissions.find((up) => up.permission_id === permissionId);

      if (existingPermission) {
        // Remove permission
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("id", existingPermission.id);

        if (error) throw error;

        await logActivity({
          actionType: "deleted",
          entityType: "Permission",
          entityId: existingPermission.id,
          description: `Mencabut permission '${permissionName}' dari pengguna`,
        });

        toast.success("Permission berhasil dicabut");
      } else {
        // Add permission
        const { error } = await supabase
          .from("user_permissions")
          .insert({
            user_id: selectedUserId,
            permission_id: permissionId,
            granted_by: currentUser.data.user.id,
          });

        if (error) throw error;

        await logActivity({
          actionType: "created",
          entityType: "Permission",
          entityId: permissionId,
          description: `Memberikan permission '${permissionName}' ke pengguna`,
        });

        toast.success("Permission berhasil diberikan");
      }

      // Refresh user permissions
      fetchUserPermissions(selectedUserId);
    } catch (error: any) {
      console.error("Error toggling permission:", error);
      toast.error("Gagal mengubah permission");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = async () => {
    if (!selectedUserId) {
      toast.error("Pilih pengguna terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) throw new Error("User not authenticated");

      // Get permissions that user doesn't have yet
      const permissionsToAdd = permissions.filter(
        (perm) => !hasPermission(perm.id)
      );

      if (permissionsToAdd.length === 0) {
        toast.info("Pengguna sudah memiliki semua permission");
        return;
      }

      // Add all missing permissions
      const newPermissions = permissionsToAdd.map((perm) => ({
        user_id: selectedUserId,
        permission_id: perm.id,
        granted_by: currentUser.data.user.id,
      }));

      const { error } = await supabase
        .from("user_permissions")
        .insert(newPermissions);

      if (error) throw error;

      await logActivity({
        actionType: "created",
        entityType: "Permission",
        description: `Memberikan semua permission ke pengguna`,
      });

      toast.success(`${permissionsToAdd.length} permission berhasil diberikan`);
      fetchUserPermissions(selectedUserId);
    } catch (error: any) {
      console.error("Error selecting all permissions:", error);
      toast.error("Gagal memberikan semua permission");
    } finally {
      setSaving(false);
    }
  };

  const handleDeselectAll = async () => {
    if (!selectedUserId) {
      toast.error("Pilih pengguna terlebih dahulu");
      return;
    }

    if (userPermissions.length === 0) {
      toast.info("Pengguna tidak memiliki permission");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", selectedUserId);

      if (error) throw error;

      await logActivity({
        actionType: "deleted",
        entityType: "Permission",
        description: `Mencabut semua permission dari pengguna`,
      });

      toast.success("Semua permission berhasil dicabut");
      fetchUserPermissions(selectedUserId);
    } catch (error: any) {
      console.error("Error deselecting all permissions:", error);
      toast.error("Gagal mencabut semua permission");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRolePermission = async (permissionId: string, permissionName: string) => {
    if (!selectedRole) {
      toast.error("Pilih role terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const existingPermission = rolePermissions.find((rp) => rp.permission_id === permissionId);

      if (existingPermission) {
        // Remove permission from role_permissions table
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("id", existingPermission.id);

        if (error) throw error;

        // Also remove from all existing users with this role
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", selectedRole);

        if (userRoles && userRoles.length > 0) {
          const userIds = userRoles.map(ur => ur.user_id);
          await supabase
            .from("user_permissions")
            .delete()
            .eq("permission_id", permissionId)
            .in("user_id", userIds);
        }

        await logActivity({
          actionType: "deleted",
          entityType: "Permission",
          entityId: existingPermission.id,
          description: `Mencabut permission '${permissionName}' dari role ${selectedRole}`,
        });

        toast.success(`Permission dicabut dari role ${selectedRole}`);
      } else {
        // Add permission to role_permissions table
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert({
            role: selectedRole,
            permission_id: permissionId,
          });

        if (insertError) throw insertError;

        // Trigger will automatically assign to all users with this role
        await logActivity({
          actionType: "created",
          entityType: "Permission",
          entityId: permissionId,
          description: `Memberikan permission '${permissionName}' ke role ${selectedRole}`,
        });

        toast.success(`Permission diberikan ke role ${selectedRole}`);
      }

      // Refresh role permissions
      fetchRolePermissions(selectedRole);
    } catch (error: any) {
      console.error("Error toggling role permission:", error);
      toast.error("Gagal mengubah permission untuk role");
    } finally {
      setSaving(false);
    }
  };

  // Select all role permissions
  const handleRoleSelectAll = async () => {
    if (!selectedRole) {
      toast.error("Pilih role terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      // Get permissions that role doesn't have yet
      const permissionsToAdd = permissions.filter(
        (perm) => !hasRolePermission(perm.id)
      );

      if (permissionsToAdd.length === 0) {
        toast.info("Role sudah memiliki semua permission");
        setSaving(false);
        return;
      }

      // Add all missing permissions to role_permissions table
      for (const perm of permissionsToAdd) {
        await supabase.from("role_permissions").insert({
          role: selectedRole,
          permission_id: perm.id,
        });
      }

      await logActivity({
        actionType: "created",
        entityType: "Permission",
        description: `Memberikan semua permission ke role ${selectedRole}`,
      });

      toast.success(`${permissionsToAdd.length} permission berhasil diberikan ke role ${selectedRole}`);
      fetchRolePermissions(selectedRole);
    } catch (error: any) {
      console.error("Error selecting all role permissions:", error);
      toast.error("Gagal memberikan semua permission");
    } finally {
      setSaving(false);
    }
  };

  // Deselect all role permissions
  const handleRoleDeselectAll = async () => {
    if (!selectedRole) {
      toast.error("Pilih role terlebih dahulu");
      return;
    }

    if (rolePermissions.length === 0) {
      toast.info("Role tidak memiliki permission");
      return;
    }

    setSaving(true);
    try {
      // Remove all permissions from role_permissions table
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", selectedRole);

      if (error) throw error;

      // Also remove from all existing users with this role
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", selectedRole);

      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map(ur => ur.user_id);
        const permIds = rolePermissions.map(rp => rp.permission_id);
        await supabase
          .from("user_permissions")
          .delete()
          .in("permission_id", permIds)
          .in("user_id", userIds);
      }

      await logActivity({
        actionType: "deleted",
        entityType: "Permission",
        description: `Mencabut semua permission dari role ${selectedRole}`,
      });

      toast.success(`Semua permission berhasil dicabut dari role ${selectedRole}`);
      fetchRolePermissions(selectedRole);
    } catch (error: any) {
      console.error("Error deselecting all role permissions:", error);
      toast.error("Gagal mencabut semua permission");
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Manajemen Permission</CardTitle>
        </div>
        <CardDescription>
          Atur hak akses pengguna secara detail
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="user" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="user" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Per Pengguna
            </TabsTrigger>
            <TabsTrigger value="role" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Per Role
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Pengguna</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pengguna..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h3 className="font-semibold">
                    Permissions untuk {selectedUser?.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {userPermissions.length} dari {permissions.length} permission aktif
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAll}
                      disabled={saving || userPermissions.length === permissions.length}
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeselectAll}
                      disabled={saving || userPermissions.length === 0}
                    >
                      Hapus Semua
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {Object.entries(getPermissionsByCategory()).map(([category, categoryPerms]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-medium text-sm text-primary border-b pb-2 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                          {category}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          ({categoryPerms.filter(p => isUserPermissionChecked(p.id)).length}/{categoryPerms.length})
                        </span>
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        {categoryPerms.map((permission) => {
                          const isChecked = isUserPermissionChecked(permission.id);
                          const hasChanged = pendingUserChanges.has(permission.id);
                          return (
                            <div
                              key={permission.id}
                              className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${hasChanged ? 'border-primary bg-primary/5' : ''}`}
                            >
                              <Checkbox
                                id={permission.id}
                                checked={isChecked}
                                disabled={saving}
                                onCheckedChange={() => toggleUserPermissionLocal(permission.id)}
                              />
                              <div className="flex-1 space-y-1">
                                <Label
                                  htmlFor={permission.id}
                                  className="cursor-pointer font-medium text-sm"
                                >
                                  {permission.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* OK Button for User Permissions */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveUserPermissions}
                    disabled={saving || !hasUnsavedUserChanges}
                    className="min-w-[120px]"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    OK - Simpan
                  </Button>
                </div>
              </div>
            )}

            {!selectedUserId && (
              <div className="text-center py-8 text-muted-foreground">
                Pilih pengguna untuk mengelola permissions
              </div>
            )}
          </TabsContent>

          <TabsContent value="role" className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Role</Label>
              <Select 
                value={selectedRole} 
                onValueChange={(value) => setSelectedRole(value as 'admin' | 'leader' | 'user' | '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h3 className="font-semibold capitalize">
                      Permissions untuk role {selectedRole}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permissions ini akan otomatis diberikan ke semua user baru dengan role {selectedRole}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {rolePermissions.length} dari {permissions.length} permission aktif
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRoleSelectAll}
                      disabled={saving || rolePermissions.length === permissions.length}
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRoleDeselectAll}
                      disabled={saving || rolePermissions.length === 0}
                    >
                      Hapus Semua
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {Object.entries(getPermissionsByCategory()).map(([category, categoryPerms]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-medium text-sm text-primary border-b pb-2 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                          {category}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          ({categoryPerms.filter(p => isRolePermissionChecked(p.id)).length}/{categoryPerms.length})
                        </span>
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        {categoryPerms.map((permission) => {
                          const isChecked = isRolePermissionChecked(permission.id);
                          const hasChanged = pendingRoleChanges.has(permission.id);
                          return (
                            <div
                              key={permission.id}
                              className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${hasChanged ? 'border-primary bg-primary/5' : ''}`}
                            >
                              <Checkbox
                                id={`role-${permission.id}`}
                                checked={isChecked}
                                disabled={saving}
                                onCheckedChange={() => toggleRolePermissionLocal(permission.id)}
                              />
                              <div className="flex-1 space-y-1">
                                <Label
                                  htmlFor={`role-${permission.id}`}
                                  className="cursor-pointer font-medium text-sm"
                                >
                                  {permission.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* OK Button for Role Permissions */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveRolePermissions}
                    disabled={saving || !hasUnsavedRoleChanges}
                    className="min-w-[120px]"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    OK - Simpan
                  </Button>
                </div>
              </div>
            )}

            {!selectedRole && (
              <div className="text-center py-8 text-muted-foreground">
                Pilih role untuk mengelola permissions
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
