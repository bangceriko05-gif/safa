import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logActivity } from "@/utils/activityLogger";
import { useStore } from "@/contexts/StoreContext";
import { validateCustomerInput } from "@/utils/customerValidation";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
}

export default function CustomerManagement() {
  const { currentStore } = useStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("user");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentStore) return;
    fetchCustomers();
    getCurrentUser();
  }, [currentStore]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      
      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (roleData) {
        setUserRole(roleData.role);
      }
    }
  };

  const fetchCustomers = async () => {
    try {
      if (!currentStore) return;

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = validateCustomerInput(formData);
    if (!validation.success) {
      setFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }
    setFormErrors({});

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            notes: formData.notes || null,
          })
          .eq("id", editingCustomer.id);

        if (error) throw error;

        await logActivity({
          actionType: 'updated',
          entityType: 'Pelanggan',
          entityId: editingCustomer.id,
          description: `Mengubah data pelanggan ${formData.name}`,
        });

        toast.success("Pelanggan berhasil diupdate");
      } else {
        if (!currentStore) {
          toast.error("Pilih cabang terlebih dahulu");
          return;
        }

        const { data: newCustomer, error } = await supabase
          .from("customers")
          .insert([{
            ...formData,
            email: formData.email || null,
            notes: formData.notes || null,
            created_by: userId,
            store_id: currentStore.id,
          }])
          .select()
          .single();

        if (error) throw error;

        await logActivity({
          actionType: 'created',
          entityType: 'Pelanggan',
          entityId: newCustomer.id,
          description: `Menambahkan pelanggan baru: ${formData.name}`,
        });

        toast.success("Pelanggan berhasil ditambahkan");
      }

      fetchCustomers();
      handleCloseDialog();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Nomor HP sudah terdaftar");
      } else {
        toast.error(error.message || "Terjadi kesalahan");
      }
      console.error(error);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCustomerId) return;

    try {
      const customerToDelete = customers.find(c => c.id === deleteCustomerId);
      
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", deleteCustomerId);

      if (error) throw error;

      if (customerToDelete) {
        await logActivity({
          actionType: 'deleted',
          entityType: 'Pelanggan',
          entityId: deleteCustomerId,
          description: `Menghapus pelanggan: ${customerToDelete.name}`,
        });
      }

      toast.success("Pelanggan berhasil dihapus");
      fetchCustomers();
    } catch (error: any) {
      toast.error("Gagal menghapus pelanggan");
      console.error(error);
    } finally {
      setDeleteCustomerId(null);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      notes: "",
    });
    setFormErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Data Pelanggan</h2>
          <p className="text-gray-600 mt-1">Kelola database pelanggan Treebox</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-[#1f7acb] hover:bg-[#1a6ab0]">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pelanggan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daftar Pelanggan ({customers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nama</TableHead>
                  <TableHead>Nomor HP</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      Belum ada data pelanggan
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => {
                    const canModify = userRole === "admin" || userRole === "leader" || customer.created_by === userId;
                    
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.email || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {customer.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canModify ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(customer)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteCustomerId(customer.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={100}
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                maxLength={20}
                className={formErrors.phone ? "border-red-500" : ""}
              />
              {formErrors.phone && (
                <p className="text-sm text-red-500">{formErrors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                maxLength={255}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-sm text-red-500">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                maxLength={500}
                className={formErrors.notes ? "border-red-500" : ""}
              />
              {formErrors.notes && (
                <p className="text-sm text-red-500">{formErrors.notes}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Batal
              </Button>
              <Button type="submit" className="bg-[#1f7acb] hover:bg-[#1a6ab0]">
                {editingCustomer ? "Update" : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCustomerId} onOpenChange={() => setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pelanggan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pelanggan ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
