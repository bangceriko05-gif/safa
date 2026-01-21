import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, UserCog, Pencil, Key, Trash2, UserPlus, Building2, X } from "lucide-react";
import { logActivity } from "@/utils/activityLogger";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/contexts/StoreContext";

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role: "admin" | "leader" | "user";
  stores?: string[];
}

interface Store {
  id: string;
  name: string;
  location: string | null;
}

interface UserStoreAccess {
  store_id: string;
  role: string;
  stores: Store;
}

interface TempPassword {
  id: string;
  temp_password: string;
  created_at: string;
  is_used: boolean;
}

interface OrphanUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role: "admin" | "leader" | "user";
}

export default function UserManagement() {
  const { currentStore } = useStore();
  const [users, setUsers] = useState<User[]>([]);
  const [orphanUsers, setOrphanUsers] = useState<OrphanUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [tempPasswords, setTempPasswords] = useState<TempPassword[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showOrphanTab, setShowOrphanTab] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [addFormData, setAddFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "admin" | "leader" | "user",
  });
  const [isStoreAccessDialogOpen, setIsStoreAccessDialogOpen] = useState(false);
  const [storeAccessUser, setStoreAccessUser] = useState<User | null>(null);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [userStoreAccess, setUserStoreAccess] = useState<UserStoreAccess[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedStoreRole, setSelectedStoreRole] = useState<string>("staff");

  const [repairEmail, setRepairEmail] = useState<string>("");
  const [repairing, setRepairing] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (!currentStore?.id) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch users who have access to the current store
      const { data: storeAccessData, error: storeAccessError } = await supabase
        .from("user_store_access")
        .select("user_id, store_id, stores(name)")
        .eq("store_id", currentStore.id);

      if (storeAccessError) throw storeAccessError;

      // Get unique user IDs that have access to this store
      const userIdsWithAccess = [...new Set(storeAccessData?.map((sa: any) => sa.user_id) || [])];

      if (userIdsWithAccess.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch profiles only for users with access to current store
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIdsWithAccess)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles for these users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .in("user_id", userIdsWithAccess);

      if (rolesError) throw rolesError;

      // Fetch all store access for these users (to show all their stores)
      const { data: allStoreAccess, error: allStoreAccessError } = await supabase
        .from("user_store_access")
        .select("user_id, stores(name)")
        .in("user_id", userIdsWithAccess);

      if (allStoreAccessError) throw allStoreAccessError;

      // Combine the data
      const usersWithRoles = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userStores = allStoreAccess?.filter((sa: any) => sa.user_id === profile.id)
          .map((sa: any) => sa.stores?.name)
          .filter(Boolean) || [];
        
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          created_at: profile.created_at,
          role: userRole?.role || "user",
          stores: userStores,
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("Gagal memuat data pengguna: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStore?.id) {
      fetchUsers();
    }
    getCurrentUserRole();
    fetchAllStores();
  }, [currentStore?.id]);

  // Fetch orphan users - users in profiles but without access to current store
  // Visible to admin/leader of each store, not just super admin
  const fetchOrphanUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is super admin
      const { data: superAdminData } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      setIsSuperAdmin(!!superAdminData);

      // Only admin/leader can see orphan users
      if (currentUserRole !== 'admin' && currentUserRole !== 'leader' && !superAdminData) {
        setOrphanUsers([]);
        return;
      }

      // Get all profiles
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // For super admin: show users without ANY store access (global orphans)
      // For admin/leader: show users without access to CURRENT store
      let orphans: typeof allProfiles = [];
      
      if (superAdminData) {
        // Global orphans - no store access at all
        const { data: usersWithAccess, error: accessError } = await supabase
          .from("user_store_access")
          .select("user_id");

        if (accessError) throw accessError;

        const userIdsWithAccess = new Set(usersWithAccess?.map((ua: any) => ua.user_id) || []);
        orphans = allProfiles?.filter(profile => !userIdsWithAccess.has(profile.id)) || [];
      } else if (currentStore?.id) {
        // Users without access to current store - potential orphans for this branch
        const { data: usersWithCurrentStoreAccess, error: accessError } = await supabase
          .from("user_store_access")
          .select("user_id")
          .eq("store_id", currentStore.id);

        if (accessError) throw accessError;

        const userIdsWithCurrentStoreAccess = new Set(usersWithCurrentStoreAccess?.map((ua: any) => ua.user_id) || []);
        
        // Get users who have NO store access at all (truly orphaned users)
        const { data: allUsersWithAccess } = await supabase
          .from("user_store_access")
          .select("user_id");
        
        const allUserIdsWithAnyAccess = new Set(allUsersWithAccess?.map((ua: any) => ua.user_id) || []);
        
        // Only show users who have no access anywhere (global orphans) - visible to branch admin/leader
        orphans = allProfiles?.filter(profile => !allUserIdsWithAnyAccess.has(profile.id)) || [];
      }

      // Get roles for orphan users
      const orphanIds = orphans?.map(o => o.id) || [];
      let roles: any[] = [];
      
      if (orphanIds.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("*")
          .in("user_id", orphanIds);
        roles = rolesData || [];
      }

      const orphansWithRoles: OrphanUser[] = (orphans || []).map(profile => {
        const userRole = roles?.find((r: any) => r.user_id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          created_at: profile.created_at,
          role: userRole?.role || "user",
        };
      });

      setOrphanUsers(orphansWithRoles);
    } catch (error: any) {
      console.error("Error fetching orphan users:", error);
    }
  };

  useEffect(() => {
    if (currentUserRole) {
      fetchOrphanUsers();
    }
  }, [currentUserRole, currentStore?.id]);

  const fetchAllStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, location")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAllStores(data || []);
    } catch (error: any) {
      console.error("Error fetching stores:", error);
    }
  };

  const getCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData) {
        setCurrentUserRole(roleData.role);
      }
    } catch (error) {
      console.error("Error getting current user role:", error);
    }
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "leader" | "user") => {
    setUpdating(userId);
    try {
      // Get user name before updating
      const user = users.find(u => u.id === userId);
      
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      // Log activity
      if (user) {
        await logActivity({
          actionType: 'updated',
          entityType: 'User',
          entityId: userId,
          description: `Mengubah role ${user.name} menjadi ${newRole}`,
        });
      }

      toast.success("Role pengguna berhasil diperbarui!");
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal memperbarui role: " + error.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          email: formData.email,
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      await logActivity({
        actionType: 'updated',
        entityType: 'User',
        entityId: editingUser.id,
        description: `Mengubah data pengguna ${formData.name}`,
      });

      toast.success("Data pengguna berhasil diperbarui!");
      fetchUsers();
      handleCloseDialog();
    } catch (error: any) {
      toast.error("Gagal memperbarui data: " + error.message);
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
    });
  };

  const handleShowPassword = async (user: User) => {
    setPasswordUser(user);
    setNewPassword("");
    
    // Fetch temp passwords for this user
    const { data, error } = await supabase
      .from("user_temp_passwords")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setTempPasswords(data);
    } else {
      setTempPasswords([]);
    }
    
    setIsPasswordDialogOpen(true);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser || !newPassword) return;

    try {
      // Use edge function to actually reset password in auth system
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: passwordUser.id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logActivity({
        actionType: 'updated',
        entityType: 'User',
        entityId: passwordUser.id,
        description: `Mereset password untuk ${passwordUser.name}`,
      });

      toast.success("Password berhasil direset! Pengguna sekarang bisa login dengan password baru.");
      setNewPassword("");
      
      // Refresh temp passwords
      handleShowPassword(passwordUser);
    } catch (error: any) {
      toast.error("Gagal mereset password: " + error.message);
    }
  };

  const handleClosePasswordDialog = () => {
    setIsPasswordDialogOpen(false);
    setPasswordUser(null);
    setNewPassword("");
    setTempPasswords([]);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!currentStore?.id) {
        throw new Error("Pilih toko terlebih dahulu");
      }

      // Use edge function for secure user creation
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: addFormData.email,
          password: addFormData.password,
          name: addFormData.name,
          role: addFormData.role,
          storeId: currentStore.id,
        },
      });

      const { data, error } = response;

      // Handle edge function errors properly
      // When edge function returns non-2xx, error is set but data may also contain the response
      if (error || data?.error) {
        console.error('Edge function error:', error, data);
        
        // First check if data contains the error message (from JSON response body)
        if (data?.error) {
          toast.error(data.error);
          return;
        }
        
        // Then check error message
        const errorMessage = error?.message || "Unknown error";
        
        // Check if error message contains our custom messages
        if (errorMessage.includes("sudah") || 
            errorMessage.includes("already") || 
            errorMessage.includes("email_exists")) {
          toast.error(errorMessage.includes("akses") 
            ? "Pengguna dengan email ini sudah memiliki akses ke toko ini"
            : "Email sudah terdaftar, gunakan email lain");
          return;
        }
        
        // Try to parse error context if available
        if (error?.context) {
          try {
            const context = typeof error.context === 'string' 
              ? JSON.parse(error.context) 
              : error.context;
            if (context?.error) {
              toast.error(context.error);
              return;
            }
          } catch (e) {
            // Context parsing failed, continue with default error
          }
        }
        
        toast.error("Gagal menambah pengguna: " + errorMessage);
        return;
      }

      // Handle successful response - check if added to existing user or new user
      const successMessage = data?.addedToStore 
        ? `Akses toko berhasil ditambahkan untuk ${addFormData.name}`
        : `Pengguna baru ${addFormData.name} berhasil ditambahkan!`;

      await logActivity({
        actionType: data?.addedToStore ? 'updated' : 'created',
        entityType: 'User',
        entityId: data?.user?.id,
        description: successMessage,
      });

      toast.success(successMessage);
      fetchUsers();
      handleCloseAddDialog();
    } catch (error: any) {
      console.error('Unexpected error in handleAddUser:', error);
      toast.error("Gagal menambah pengguna: " + (error.message || "Terjadi kesalahan"));
    }
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setAddFormData({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      // Use edge function for secure user deletion
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId: deletingUser.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logActivity({
        actionType: 'deleted',
        entityType: 'User',
        entityId: deletingUser.id,
        description: `Menghapus pengguna ${deletingUser.name}`,
      });

      toast.success("Pengguna berhasil dihapus!");
      fetchUsers();
      fetchOrphanUsers(); // Also refresh orphan users
      handleCloseDeleteDialog();
    } catch (error: any) {
      toast.error("Gagal menghapus pengguna: " + error.message);
    }
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingUser(null);
  };

  const handleManageStoreAccess = async (user: User) => {
    setStoreAccessUser(user);
    
    // Fetch user's current store access
    const { data, error } = await supabase
      .from("user_store_access")
      .select("store_id, role, stores(*)")
      .eq("user_id", user.id);
    
    if (!error && data) {
      setUserStoreAccess(data as UserStoreAccess[]);
    } else {
      setUserStoreAccess([]);
    }
    
    setIsStoreAccessDialogOpen(true);
  };

  const handleAddStoreAccess = async () => {
    if (!storeAccessUser || !selectedStore) {
      toast.error("Pilih cabang terlebih dahulu");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_store_access")
        .insert({
          user_id: storeAccessUser.id,
          store_id: selectedStore,
          role: selectedStoreRole,
        });

      if (error) throw error;

      const storeName = allStores.find(s => s.id === selectedStore)?.name;
      await logActivity({
        actionType: 'created',
        entityType: 'User Store Access',
        entityId: storeAccessUser.id,
        description: `Memberikan akses ${storeName} kepada ${storeAccessUser.name}`,
      });

      toast.success("Akses cabang berhasil ditambahkan!");
      handleManageStoreAccess(storeAccessUser);
      setSelectedStore("");
      setSelectedStoreRole("staff");
      fetchUsers();
      fetchOrphanUsers(); // Refresh orphan users list since user now has access
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("User sudah memiliki akses ke cabang ini");
      } else {
        toast.error("Gagal menambahkan akses: " + error.message);
      }
    }
  };

  const handleRemoveStoreAccess = async (storeId: string) => {
    if (!storeAccessUser) return;

    try {
      const { error } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", storeAccessUser.id)
        .eq("store_id", storeId);

      if (error) throw error;

      const storeName = userStoreAccess.find(sa => sa.store_id === storeId)?.stores.name;
      await logActivity({
        actionType: 'deleted',
        entityType: 'User Store Access',
        entityId: storeAccessUser.id,
        description: `Menghapus akses ${storeName} dari ${storeAccessUser.name}`,
      });

      toast.success("Akses cabang berhasil dihapus!");
      handleManageStoreAccess(storeAccessUser);
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal menghapus akses: " + error.message);
    }
  };

  const handleCloseStoreAccessDialog = () => {
    setIsStoreAccessDialogOpen(false);
    setStoreAccessUser(null);
    setUserStoreAccess([]);
    setSelectedStore("");
    setSelectedStoreRole("staff");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const handleDeleteOrphanUser = async (user: OrphanUser) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId: user.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logActivity({
        actionType: 'deleted',
        entityType: 'User',
        entityId: user.id,
        description: `Menghapus pengguna orphan ${user.name} (${user.email})`,
      });

      toast.success("Pengguna berhasil dihapus!");
      fetchOrphanUsers();
    } catch (error: any) {
      toast.error("Gagal menghapus pengguna: " + error.message);
    }
  };

  const handleAddStoreAccessToOrphan = async (user: OrphanUser) => {
    setStoreAccessUser({
      ...user,
      stores: [],
    });
    setUserStoreAccess([]);
    setIsStoreAccessDialogOpen(true);
  };

  const handleRepairByEmail = async () => {
    if (!currentStore?.id) {
      toast.error("Pilih cabang terlebih dahulu");
      return;
    }
    if (!repairEmail.trim()) {
      toast.error("Masukkan email");
      return;
    }

    setRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'repair',
          email: repairEmail.trim(),
          storeId: currentStore.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User berhasil diperbaiki & diberi akses cabang ini");
      setRepairEmail("");
      fetchUsers();
      fetchOrphanUsers();
    } catch (e: any) {
      toast.error(e?.message || "Gagal memperbaiki user");
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Manajemen Pengguna</CardTitle>
              <CardDescription>
                Kelola pengguna dan atur hak akses mereka
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show orphan button to admin/leader - always visible for awareness */}
            {(currentUserRole === "admin" || currentUserRole === "leader") && (
              <Button
                variant={showOrphanTab ? "default" : "outline"}
                onClick={() => setShowOrphanTab(!showOrphanTab)}
                className={orphanUsers.length > 0 ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
              >
                <UserCog className="h-4 w-4 mr-2" />
                User Orphan {orphanUsers.length > 0 && `(${orphanUsers.length})`}
              </Button>
            )}
            {(currentUserRole === "admin" || currentUserRole === "leader") && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Tambah Pengguna
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Orphan Users Tab - visible to admin/leader */}
        {showOrphanTab && (currentUserRole === "admin" || currentUserRole === "leader") && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500">
                    Global View
                  </Badge>
                )}
                <CardTitle className="text-lg">User Tanpa Akses Cabang</CardTitle>
              </div>
              <CardDescription>
                Pengguna ini terdaftar di sistem tapi tidak memiliki akses ke cabang manapun. 
                Mereka tidak bisa login ke cabang apapun. Anda bisa menambahkan akses cabang atau menghapusnya.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="repairEmail">Perbaiki user berdasarkan email</Label>
                  <Input
                    id="repairEmail"
                    placeholder="contoh: ddoonnaa0397@gmail.com"
                    value={repairEmail}
                    onChange={(e) => setRepairEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleRepairByEmail}
                  disabled={repairing}
                >
                  {repairing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Perbaiki & Beri Akses
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Terdaftar</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphanUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Tidak ada user orphan
                        </TableCell>
                      </TableRow>
                    ) : (
                      orphanUsers.map((user) => (
                        <TableRow key={user.id} className="bg-amber-500/5">
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === "admin" ? "default" : 
                              user.role === "leader" ? "destructive" : 
                              "secondary"
                            }>
                              {user.role === "admin" ? "Admin" : 
                               user.role === "leader" ? "Leader" : 
                               "User"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString("id-ID", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddStoreAccessToOrphan(user)}
                                title="Tambah Akses Cabang"
                              >
                                <Building2 className="h-4 w-4 mr-1" />
                                Beri Akses
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeletingUser(user);
                                  setIsDeleteDialogOpen(true);
                                }}
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Main Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Akses Cabang</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Tidak ada pengguna ditemukan
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={
                        user.role === "admin" ? "default" : 
                        user.role === "leader" ? "destructive" : 
                        "secondary"
                      }>
                        {user.role === "admin" ? "Admin" : 
                         user.role === "leader" ? "Leader" : 
                         "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.stores && user.stores.length > 0 ? (
                          user.stores.map((store, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {store}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Tidak ada akses</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {/* Admin can do everything */}
                        {currentUserRole === "admin" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                              title="Edit Pengguna"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowPassword(user)}
                              title="Kelola Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleManageStoreAccess(user)}
                              title="Kelola Akses Cabang"
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateUserRole(user.id, value as "admin" | "leader" | "user")}
                              disabled={updating === user.id}
                            >
                              <SelectTrigger className="w-32">
                                {updating === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="leader">Leader</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {/* Leader can only change role for "user" type users */}
                        {currentUserRole === "leader" && user.role === "user" && (
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateUserRole(user.id, value as "admin" | "leader" | "user")}
                            disabled={updating === user.id}
                          >
                            <SelectTrigger className="w-32">
                              {updating === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {/* Leader can only set user to user role - cannot promote to leader or admin */}
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {/* Admin can delete anyone. Leader can only delete "user" type users */}
                        {(currentUserRole === "admin" || (currentUserRole === "leader" && user.role === "user")) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingUser(user);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Pengguna</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Batal
              </Button>
              <Button type="submit">
                Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Management Dialog (Admin Only) */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={handleClosePasswordDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Password - {passwordUser?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <form onSubmit={handleSetPassword} className="space-y-4 border-b pb-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Set Password Baru</Label>
                <Input
                  id="newPassword"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Minimal 6 karakter
                </p>
              </div>
              <Button type="submit">Simpan Password</Button>
            </form>

            <div className="space-y-2">
              <h3 className="font-medium">Riwayat Password</h3>
              {tempPasswords.length > 0 ? (
                <div className="space-y-2">
                  {tempPasswords.map((pwd) => (
                    <Card key={pwd.id} className="p-3">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <div className="font-mono font-semibold text-lg break-all">{pwd.temp_password}</div>
                          <div className="text-xs text-muted-foreground">
                            Dibuat: {new Date(pwd.created_at).toLocaleString("id-ID")}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(pwd.temp_password);
                              toast.success("Password disalin!");
                            }}
                          >
                            Salin
                          </Button>
                          <Badge variant={pwd.is_used ? "secondary" : "default"}>
                            {pwd.is_used ? "Sudah digunakan" : "Aktif"}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada password yang diatur</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleCloseAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Nama Lengkap *</Label>
              <Input
                id="add-name"
                value={addFormData.name}
                onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={addFormData.email}
                onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-password">Password *</Label>
              <Input
                id="add-password"
                type="password"
                value={addFormData.password}
                onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Minimal 6 karakter
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-role">Role *</Label>
              <Select
                value={addFormData.role}
                onValueChange={(value) => setAddFormData({ ...addFormData, role: value as "admin" | "leader" | "user" })}
              >
                <SelectTrigger id="add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentUserRole === "admin" && (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="leader">Leader</SelectItem>
                    </>
                  )}
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              {currentUserRole === "leader" && (
                <p className="text-xs text-muted-foreground">
                  Sebagai Leader, Anda hanya dapat menambahkan pengguna dengan role User
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCloseAddDialog}>
                Batal
              </Button>
              <Button type="submit">
                Tambah
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pengguna <strong>{deletingUser?.name}</strong>? 
              Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data yang terkait dengan pengguna ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Store Access Management Dialog */}
      <Dialog open={isStoreAccessDialogOpen} onOpenChange={handleCloseStoreAccessDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Akses Cabang - {storeAccessUser?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Add Store Access Form */}
            <Card className="p-4 bg-muted/50">
              <h3 className="font-medium mb-4">Tambah Akses Cabang</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pilih Cabang</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih cabang" />
                      </SelectTrigger>
                      <SelectContent>
                        {allStores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} {store.location && `(${store.location})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role di Cabang</Label>
                    <Select value={selectedStoreRole} onValueChange={setSelectedStoreRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleAddStoreAccess} className="w-full">
                  <Building2 className="h-4 w-4 mr-2" />
                  Tambah Akses
                </Button>
              </div>
            </Card>

            {/* Current Store Access */}
            <div className="space-y-3">
              <h3 className="font-medium">Akses Cabang Saat Ini</h3>
              {userStoreAccess.length > 0 ? (
                <div className="space-y-2">
                  {userStoreAccess.map((access) => (
                    <Card key={access.store_id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-medium">{access.stores.name}</div>
                          {access.stores.location && (
                            <div className="text-sm text-muted-foreground">{access.stores.location}</div>
                          )}
                          <div className="mt-2">
                            <Badge variant={
                              access.role === "super_admin" ? "default" : 
                              access.role === "admin" ? "destructive" : 
                              "secondary"
                            }>
                              {access.role === "super_admin" ? "Super Admin" : 
                               access.role === "admin" ? "Admin" : 
                               "Staff"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStoreAccess(access.store_id)}
                          title="Hapus Akses"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Pengguna belum memiliki akses ke cabang manapun
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
