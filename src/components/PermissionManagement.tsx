import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Shield, User, Users, Save, RefreshCw } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { clearPermissionCache } from "@/utils/permissionCache";

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
  role: 'admin' | 'leader' | 'user' | 'owner' | 'akuntan';
  permission_id: string;
}

import { ACTION_COLUMNS, permissionMatrix, type MatrixCategory } from "@/utils/permissionMatrix";

export default function PermissionManagement() {
  const { currentStore } = useStore();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'leader' | 'user' | 'owner' | 'akuntan' | ''>("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingUserChanges, setPendingUserChanges] = useState<Set<string>>(new Set());
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Set<string>>(new Set());
  const [hasUnsavedUserChanges, setHasUnsavedUserChanges] = useState(false);
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);

  // Build a name->id map for quick lookup
  const permissionNameToId = new Map<string, string>();
  const permissionIdToName = new Map<string, string>();
  permissions.forEach(p => {
    permissionNameToId.set(p.name, p.id);
    permissionIdToName.set(p.id, p.name);
  });

  useEffect(() => {
    fetchData();
  }, [currentStore?.id]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserPermissions(selectedUserId);
      setPendingUserChanges(new Set());
      setHasUnsavedUserChanges(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
      setPendingRoleChanges(new Set());
      setHasUnsavedRoleChanges(false);
    }
  }, [selectedRole]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: permData, error: permError } = await supabase
        .from("permissions")
        .select("*")
        .order("name");
      if (permError) throw permError;
      setPermissions(permData || []);

      if (currentStore?.id) {
        const { data: storeAccessData, error: storeAccessError } = await supabase
          .from("user_store_access")
          .select("user_id")
          .eq("store_id", currentStore.id);
        if (storeAccessError) throw storeAccessError;
        const userIds = storeAccessData?.map(access => access.user_id) || [];
        if (userIds.length > 0) {
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
        setUsers([]);
      }
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

  const fetchRolePermissions = async (role: 'admin' | 'leader' | 'user' | 'owner' | 'akuntan') => {
    try {
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

  const hasUserPerm = (permissionId: string) => userPermissions.some(up => up.permission_id === permissionId);
  const hasRolePerm = (permissionId: string) => rolePermissions.some(rp => rp.permission_id === permissionId);

  const toggleUserLocal = (permissionId: string) => {
    setPendingUserChanges(prev => {
      const n = new Set(prev);
      n.has(permissionId) ? n.delete(permissionId) : n.add(permissionId);
      return n;
    });
    setHasUnsavedUserChanges(true);
  };

  const toggleRoleLocal = (permissionId: string) => {
    setPendingRoleChanges(prev => {
      const n = new Set(prev);
      n.has(permissionId) ? n.delete(permissionId) : n.add(permissionId);
      return n;
    });
    setHasUnsavedRoleChanges(true);
  };

  const isUserChecked = (permissionId: string) => {
    const has = hasUserPerm(permissionId);
    const pending = pendingUserChanges.has(permissionId);
    return has ? !pending : pending;
  };

  const isRoleChecked = (permissionId: string) => {
    const has = hasRolePerm(permissionId);
    const pending = pendingRoleChanges.has(permissionId);
    return has ? !pending : pending;
  };

  // Get all permission IDs for a category
  const getCategoryPermissionIds = (cat: MatrixCategory): string[] => {
    const ids: string[] = [];
    cat.items?.forEach(item => {
      Object.values(item.actions).forEach(name => {
        const id = permissionNameToId.get(name);
        if (id) ids.push(id);
      });
    });
    cat.subCategories?.forEach(sub => {
      sub.items.forEach(item => {
        Object.values(item.actions).forEach(name => {
          const id = permissionNameToId.get(name);
          if (id) ids.push(id);
        });
      });
    });
    cat.standalone?.forEach(s => {
      const id = permissionNameToId.get(s.permissionName);
      if (id) ids.push(id);
    });
    return ids;
  };

  // Get all permission IDs for a column within a category
  const getColumnPermissionIds = (cat: MatrixCategory, col: typeof ACTION_COLUMNS[number]): string[] => {
    const ids: string[] = [];
    cat.items?.forEach(item => {
      const name = item.actions[col];
      if (name) {
        const id = permissionNameToId.get(name);
        if (id) ids.push(id);
      }
    });
    cat.subCategories?.forEach(sub => {
      sub.items.forEach(item => {
        const name = item.actions[col];
        if (name) {
          const id = permissionNameToId.get(name);
          if (id) ids.push(id);
        }
      });
    });
    return ids;
  };

  const toggleAllInCategory = (catPermIds: string[], isCheckedFn: (id: string) => boolean, toggleFn: (id: string) => void) => {
    const allChecked = catPermIds.every(id => isCheckedFn(id));
    catPermIds.forEach(id => {
      const currently = isCheckedFn(id);
      if (allChecked && currently) toggleFn(id);
      if (!allChecked && !currently) toggleFn(id);
    });
  };

  const toggleColumn = (colPermIds: string[], isCheckedFn: (id: string) => boolean, toggleFn: (id: string) => void) => {
    const allChecked = colPermIds.every(id => isCheckedFn(id));
    colPermIds.forEach(id => {
      const currently = isCheckedFn(id);
      if (allChecked && currently) toggleFn(id);
      if (!allChecked && !currently) toggleFn(id);
    });
  };

  // Save handlers
  const handleSaveUserPermissions = async () => {
    if (!selectedUserId || pendingUserChanges.size === 0) {
      toast.info("Tidak ada perubahan untuk disimpan");
      return;
    }
    setSaving(true);
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) throw new Error("User not authenticated");
      const grantingUserId = currentUser.data.user.id;
      const toAdd: string[] = [];
      const toRemove: string[] = [];
      pendingUserChanges.forEach(permId => {
        if (hasUserPerm(permId)) toRemove.push(permId);
        else toAdd.push(permId);
      });
      if (toRemove.length > 0) {
        const { error } = await supabase.from("user_permissions").delete().eq("user_id", selectedUserId).in("permission_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const newPerms = toAdd.map(permId => ({ user_id: selectedUserId, permission_id: permId, granted_by: grantingUserId }));
        const { error } = await supabase.from("user_permissions").insert(newPerms);
        if (error) throw error;
      }
      await logActivity({ actionType: "updated", entityType: "Permission", description: `Mengubah ${toAdd.length + toRemove.length} permission untuk pengguna`, storeId: currentStore?.id });
      clearPermissionCache();
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
        if (hasRolePerm(permId)) toRemove.push(permId);
        else toAdd.push(permId);
      });
      if (toRemove.length > 0) {
        const { error } = await supabase.from("role_permissions").delete().eq("role", selectedRole).in("permission_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(toAdd.map(permission_id => ({ role: selectedRole, permission_id })));
        if (error) throw error;
      }
      const { data: userRoles, error: rolesError } = await supabase.from("user_roles").select("user_id").eq("role", selectedRole);
      if (rolesError) throw rolesError;
      const userIds = userRoles?.map(ur => ur.user_id) ?? [];
      if (userIds.length > 0 && toRemove.length > 0) {
        const { error } = await supabase.from("user_permissions").delete().in("permission_id", toRemove).in("user_id", userIds);
        if (error) throw error;
      }
      if (userIds.length > 0 && toAdd.length > 0) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Sesi berakhir. Silakan masuk kembali.");
        const { error } = await supabase.from("user_permissions").upsert(userIds.flatMap(user_id =>
          toAdd.map(permission_id => ({ user_id, permission_id, granted_by: user.id }))
        ), { onConflict: "user_id,permission_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      clearPermissionCache();

      await logActivity({ actionType: "updated", entityType: "Permission", description: `Mengubah ${toAdd.length + toRemove.length} permission untuk role ${selectedRole}`, storeId: currentStore?.id });
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

  const handleSelectAll = (isCheckedFn: (id: string) => boolean, toggleFn: (id: string) => void) => {
    permissions.forEach(p => {
      if (!isCheckedFn(p.id)) toggleFn(p.id);
    });
  };

  const handleDeselectAll = (isCheckedFn: (id: string) => boolean, toggleFn: (id: string) => void) => {
    permissions.forEach(p => {
      if (isCheckedFn(p.id)) toggleFn(p.id);
    });
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Render the matrix table for a category
  const renderMatrixTable = (
    cat: MatrixCategory,
    isCheckedFn: (id: string) => boolean,
    toggleFn: (id: string) => void
  ) => {
    const items = cat.items || [];
    const rowGroups = [{ label: "", items }, ...(cat.subCategories || [])];
    const hasActions = rowGroups.some(group => group.items.length > 0);
    const catPermIds = getCategoryPermissionIds(cat);
    const allCatChecked = catPermIds.length > 0 && catPermIds.every(id => isCheckedFn(id));
    const someCatChecked = catPermIds.some(id => isCheckedFn(id));

    return (
      <div key={cat.label} className="border rounded-lg overflow-hidden">
        {/* Category header with master checkbox */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
          <Checkbox
            checked={allCatChecked}
            // @ts-ignore
            indeterminate={someCatChecked && !allCatChecked}
            disabled={saving || catPermIds.length === 0}
            onCheckedChange={() => toggleAllInCategory(catPermIds, isCheckedFn, toggleFn)}
          />
          <span className="font-semibold text-sm">{cat.label}</span>
        </div>

        {(hasActions || cat.subCategories?.length) && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium w-[40%]"></th>
                  {ACTION_COLUMNS.map(col => {
                    const colIds = getColumnPermissionIds(cat, col);
                    if (colIds.length === 0) return <th key={col} className="text-center px-2 py-2 font-medium min-w-[70px]">{col}</th>;
                    const allColChecked = colIds.every(id => isCheckedFn(id));
                    return (
                      <th key={col} className="text-center px-2 py-2 font-medium min-w-[70px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>{col}</span>
                          <Checkbox
                            checked={allColChecked}
                            disabled={saving}
                            className="h-3.5 w-3.5"
                            onCheckedChange={() => toggleColumn(colIds, isCheckedFn, toggleFn)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {rowGroups.map(group => (
                  <tbody key={group.label || "main"}>
                    {group.label && <tr className="border-y bg-muted/30"><th colSpan={6} scope="rowgroup" className="px-3 py-2 text-left font-medium">{group.label}</th></tr>}
                    {group.items.map((item, idx) => (
                  <tr key={item.label} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-3 py-2 text-muted-foreground">{item.label}</td>
                    {ACTION_COLUMNS.map(col => {
                      const permName = item.actions[col];
                      if (!permName) return <td key={col} className="text-center px-2 py-2"></td>;
                      const permId = permissionNameToId.get(permName);
                      if (!permId) return <td key={col} className="text-center px-2 py-2"></td>;
                      return (
                        <td key={col} className="text-center px-2 py-2">
                          <Checkbox
                            checked={isCheckedFn(permId)}
                            disabled={saving}
                            onCheckedChange={() => toggleFn(permId)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                  </tbody>
                ))}
            </table>
          </div>
        )}

        {/* Standalone permissions */}
        {cat.standalone && cat.standalone.length > 0 && (
          <div className="border-t">
            {cat.standalone.map(s => {
              const permId = permissionNameToId.get(s.permissionName);
              if (!permId) return null;
              return (
                <div key={s.permissionName} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30">
                  <Checkbox
                    checked={isCheckedFn(permId)}
                    disabled={saving}
                    onCheckedChange={() => toggleFn(permId)}
                  />
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPermissionContent = (
    mode: 'user' | 'role',
    isCheckedFn: (id: string) => boolean,
    toggleFn: (id: string) => void,
    saveFn: () => Promise<void>,
    hasUnsaved: boolean
  ) => (
    <div className="space-y-4 pb-24">
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleSelectAll(isCheckedFn, toggleFn)} disabled={saving}>
            Pilih Semua
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDeselectAll(isCheckedFn, toggleFn)} disabled={saving}>
            Hapus Semua
          </Button>
        </div>
        <Button
          onClick={saveFn}
          disabled={saving || !hasUnsaved}
          size="sm"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-11 gap-2 px-5 shadow-lg md:right-6"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Simpan
        </Button>
      </div>

      {/* Matrix tables */}
      <div className="space-y-4">
        {permissionMatrix.map(cat => renderMatrixTable(cat, isCheckedFn, toggleFn))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Manajemen Permission</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Atur hak akses pengguna secara detail</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="role" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="role" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Per Role
            </TabsTrigger>
            <TabsTrigger value="user" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Per Pengguna
            </TabsTrigger>
          </TabsList>

          <TabsContent value="role" className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Pilih role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="akuntan">Akuntan</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRole ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Permissions ini akan otomatis diberikan ke semua user baru dengan role <strong className="capitalize">{selectedRole}</strong>
                </p>
                {renderPermissionContent('role', isRoleChecked, toggleRoleLocal, handleSaveRolePermissions, hasUnsavedRoleChanges)}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Pilih role untuk mengelola permissions</div>
            )}
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
             <div className="space-y-2">
              <Label>Pilih Pengguna</Label>
              <div className="relative max-w-xs">
                <Input
                  placeholder="Ketik nama atau email pengguna..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setShowUserSuggestions(true);
                    if (!e.target.value) {
                      setSelectedUserId("");
                    }
                  }}
                  onFocus={() => setShowUserSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowUserSuggestions(false), 200)}
                />
                {showUserSuggestions && userSearchQuery && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {users
                      .filter(u => 
                        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                      .map(user => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedUserId(user.id);
                            setUserSearchQuery(`${user.name} (${user.email})`);
                            setShowUserSuggestions(false);
                          }}
                        >
                          {user.name} ({user.email})
                        </button>
                      ))}
                    {users.filter(u => 
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {selectedUserId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Permissions untuk <strong>{selectedUser?.name}</strong> — {userPermissions.length} dari {permissions.length} aktif
                </p>
                {renderPermissionContent('user', isUserChecked, toggleUserLocal, handleSaveUserPermissions, hasUnsavedUserChanges)}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Pilih pengguna untuk mengelola permissions</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
