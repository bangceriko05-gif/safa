import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Shield, User, Users } from "lucide-react";
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

export default function PermissionManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'admin' | 'leader' | 'user' | ''>("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

      // Fetch all users with their profiles
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .order("name");

      if (userError) throw userError;
      setUsers(userData || []);
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

                <div className="grid gap-4 md:grid-cols-2">
                  {permissions.map((permission) => {
                    const isChecked = hasPermission(permission.id);
                    return (
                      <div
                        key={permission.id}
                        className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={permission.id}
                          checked={isChecked}
                          disabled={saving}
                          onCheckedChange={() =>
                            handleTogglePermission(permission.id, permission.name)
                          }
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={permission.id}
                            className="cursor-pointer font-medium"
                          >
                            {permission.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                <div className="pb-2 border-b">
                  <h3 className="font-semibold capitalize">
                    Permissions untuk role {selectedRole}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permissions ini akan otomatis diberikan ke semua user baru dengan role {selectedRole}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {permissions.map((permission) => {
                    const isChecked = hasRolePermission(permission.id);
                    return (
                      <div
                        key={permission.id}
                        className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={`role-${permission.id}`}
                          checked={isChecked}
                          disabled={saving}
                          onCheckedChange={() =>
                            handleToggleRolePermission(permission.id, permission.name)
                          }
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={`role-${permission.id}`}
                            className="cursor-pointer font-medium"
                          >
                            {permission.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
