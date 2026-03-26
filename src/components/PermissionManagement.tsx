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
import { Loader2, Shield, User, Users, Save, RefreshCw } from "lucide-react";
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
  role: 'admin' | 'leader' | 'user' | 'owner' | 'akuntan';
  permission_id: string;
}

// Action columns for the matrix
const ACTION_COLUMNS = ["Lihat", "Detail", "Tambah", "Ubah", "Hapus"] as const;

// Matrix structure: maps category > items > action columns to permission names
interface MatrixItem {
  label: string;
  actions: Partial<Record<typeof ACTION_COLUMNS[number], string>>;
}

interface MatrixSubCategory {
  label: string;
  items: MatrixItem[];
}

interface MatrixCategory {
  label: string;
  subCategories?: MatrixSubCategory[];
  items?: MatrixItem[];
  // standalone permissions that don't fit the matrix (shown as simple checkboxes)
  standalone?: { label: string; permissionName: string }[];
}

const permissionMatrix: MatrixCategory[] = [
  {
    label: "Booking",
    items: [
      { label: "Booking", actions: { Lihat: "view_bookings", Tambah: "create_bookings", Ubah: "edit_bookings", Hapus: "delete_bookings" } },
      { label: "Check-in", actions: { Lihat: "checkin_bookings" } },
      { label: "Check-out", actions: { Lihat: "checkout_bookings" } },
      { label: "Batal Booking", actions: { Lihat: "cancel_bookings" } },
      { label: "Batal Checkout", actions: { Lihat: "cancel_checkout_bookings" } },
    ],
  },
  {
    label: "Kamar & Pelanggan",
    items: [
      { label: "Kamar", actions: { Lihat: "view_rooms", Ubah: "manage_rooms" } },
      { label: "Pelanggan", actions: { Lihat: "view_customers", Ubah: "manage_customers" } },
    ],
  },
  {
    label: "Produk & Toko",
    items: [
      { label: "Produk", actions: { Lihat: "view_products", Ubah: "manage_products" } },
      { label: "Toko", actions: { Lihat: "view_stores", Ubah: "manage_stores" } },
    ],
  },
  {
    label: "Laporan",
    items: [
      { label: "Keseluruhan", actions: { Lihat: "report_overview_view", Detail: "report_overview_detail" } },
      { label: "Penjualan", actions: { Lihat: "report_sales_view", Detail: "report_sales_detail" } },
      { label: "Pemasukan", actions: { Lihat: "report_income_view", Detail: "report_income_detail", Tambah: "report_income_add", Ubah: "report_income_edit", Hapus: "report_income_delete" } },
      { label: "Pengeluaran", actions: { Lihat: "report_expense_view", Detail: "report_expense_detail", Tambah: "report_expense_add", Ubah: "report_expense_edit", Hapus: "report_expense_delete" } },
      { label: "Pembelian", actions: { Lihat: "report_purchase_view", Detail: "report_purchase_detail" } },
      { label: "Kinerja", actions: { Lihat: "report_performance_view", Detail: "report_performance_detail" } },
    ],
    standalone: [
      { label: "Lihat Laporan Keuangan", permissionName: "view_reports" },
      { label: "Kelola Pemasukan", permissionName: "manage_income" },
      { label: "Kelola Pengeluaran", permissionName: "manage_expense" },
    ],
  },
  {
    label: "Pengguna & Pengaturan",
    items: [
      { label: "Pengguna", actions: { Lihat: "manage_users" } },
      { label: "Permission", actions: { Lihat: "manage_permissions" } },
      { label: "Pengaturan", actions: { Lihat: "manage_settings" } },
      { label: "Log Aktivitas", actions: { Lihat: "view_activity_logs" } },
      { label: "Auth Orphans", actions: { Lihat: "view_auth_orphans" } },
      { label: "User Orphans", actions: { Lihat: "view_user_orphans" } },
    ],
  },
];

// Collect all permission names used in the matrix
function getAllMatrixPermissionNames(): string[] {
  const names: string[] = [];
  permissionMatrix.forEach(cat => {
    cat.items?.forEach(item => {
      Object.values(item.actions).forEach(name => { if (name) names.push(name); });
    });
    cat.subCategories?.forEach(sub => {
      sub.items.forEach(item => {
        Object.values(item.actions).forEach(name => { if (name) names.push(name); });
      });
    });
    cat.standalone?.forEach(s => names.push(s.permissionName));
  });
  return names;
}

export default function PermissionManagement() {
  const { currentStore } = useStore();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
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

  const fetchRolePermissions = async (role: 'admin' | 'leader' | 'user') => {
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
        const newPerms = toAdd.map(permId => ({ user_id: selectedUserId, permission_id: permId, granted_by: currentUser.data.user!.id }));
        const { error } = await supabase.from("user_permissions").insert(newPerms);
        if (error) throw error;
      }
      await logActivity({ actionType: "updated", entityType: "Permission", description: `Mengubah ${toAdd.length + toRemove.length} permission untuk pengguna`, storeId: currentStore?.id });
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
      for (const permId of toRemove) {
        const existing = rolePermissions.find(rp => rp.permission_id === permId);
        if (existing) await supabase.from("role_permissions").delete().eq("id", existing.id);
      }
      for (const permId of toAdd) {
        await supabase.from("role_permissions").insert({ role: selectedRole, permission_id: permId });
      }

      // Sync to users with this role
      if (toRemove.length > 0) {
        const { data: userRoles } = await supabase.from("user_roles").select("user_id").eq("role", selectedRole);
        if (userRoles && userRoles.length > 0) {
          const userIds = userRoles.map(ur => ur.user_id);
          await supabase.from("user_permissions").delete().in("permission_id", toRemove).in("user_id", userIds);
        }
      }

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
    const hasActions = items.some(item => Object.keys(item.actions).length > 0);
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

        {hasActions && items.length > 0 && (
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
              <tbody>
                {items.map((item, idx) => (
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
    <div className="space-y-4">
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
        <Button onClick={saveFn} disabled={saving || !hasUnsaved} size="sm">
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
                  <SelectItem value="admin">Admin</SelectItem>
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
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Pilih pengguna..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
