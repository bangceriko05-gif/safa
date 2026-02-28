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
import { Plus, Pencil, Trash2, Users, Upload, Eye, X, CreditCard, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions } from "@/hooks/usePermissions";
import NoAccessMessage from "./NoAccessMessage";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  identity_type: string | null;
  identity_number: string | null;
  identity_document_url: string | null;
  created_at: string;
  created_by: string;
}

export default function CustomerManagement() {
  const { currentStore } = useStore();
  const { hasAnyPermission } = usePermissions();
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
    identity_type: "",
    identity_number: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [identityPreview, setIdentityPreview] = useState<string | null>(null);
  const [uploadingIdentity, setUploadingIdentity] = useState(false);
  const [viewingIdentity, setViewingIdentity] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [identityFilter, setIdentityFilter] = useState<string>("all"); // all, KTP, SIM, Passport
  const [showMissingKtp, setShowMissingKtp] = useState(false);

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

  const handleIdentityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      setIdentityFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdentityPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadIdentityDocument = async (customerId: string): Promise<string | null> => {
    if (!identityFile) return null;
    
    setUploadingIdentity(true);
    try {
      const fileExt = identityFile.name.split('.').pop();
      const fileName = `${customerId}-${Date.now()}.${fileExt}`;
      const filePath = `${currentStore?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(filePath, identityFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('identity-documents')
        .getPublicUrl(filePath);

      return filePath;
    } catch (error) {
      console.error("Error uploading identity:", error);
      toast.error("Gagal mengupload dokumen identitas");
      return null;
    } finally {
      setUploadingIdentity(false);
    }
  };

  const getIdentityDocumentUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('identity-documents')
      .createSignedUrl(path, 3600); // 1 hour expiry
    if (error || !data?.signedUrl) {
      toast.error("Gagal membuka dokumen identitas");
      return null;
    }
    return data.signedUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = validateCustomerInput({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      notes: formData.notes,
      identity_type: formData.identity_type,
      identity_number: formData.identity_number,
    });
    if (!validation.success) {
      setFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    // Validate identity document is required for all customers
    if (!editingCustomer) {
      // New customer - identity file is mandatory
      if (!identityFile) {
        toast.error("Upload dokumen identitas wajib diisi");
        return;
      }
    } else {
      // Existing customer - only required if no existing document
      if (!editingCustomer.identity_document_url && !identityFile) {
        toast.error("Upload dokumen identitas wajib diisi");
        return;
      }
    }

    setFormErrors({});

    try {
      if (editingCustomer) {
        let identityDocUrl = editingCustomer.identity_document_url;
        
        // Upload new identity if provided
        if (identityFile) {
          const uploadedPath = await uploadIdentityDocument(editingCustomer.id);
          if (uploadedPath) {
            identityDocUrl = uploadedPath;
          }
        }

        const { error } = await supabase
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            notes: formData.notes || null,
            identity_type: formData.identity_type || null,
            identity_number: formData.identity_number || null,
            identity_document_url: identityDocUrl,
          })
          .eq("id", editingCustomer.id);

        if (error) throw error;

        await logActivity({
          actionType: 'updated',
          entityType: 'Pelanggan',
          entityId: editingCustomer.id,
          description: `Mengubah data pelanggan ${formData.name}`,
          storeId: currentStore?.id,
        });

        toast.success("Pelanggan berhasil diupdate");
      } else {
        if (!currentStore) {
          toast.error("Pilih cabang terlebih dahulu");
          return;
        }

        // Create customer first
        const { data: newCustomer, error } = await supabase
          .from("customers")
          .insert([{
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            notes: formData.notes || null,
            identity_type: formData.identity_type || null,
            identity_number: formData.identity_number || null,
            created_by: userId,
            store_id: currentStore.id,
          }])
          .select()
          .single();

        if (error) throw error;

        // Upload identity document if provided
        if (identityFile && newCustomer) {
          const uploadedPath = await uploadIdentityDocument(newCustomer.id);
          if (uploadedPath) {
            await supabase
              .from("customers")
              .update({ identity_document_url: uploadedPath })
              .eq("id", newCustomer.id);
          }
        }

        await logActivity({
          actionType: 'created',
          entityType: 'Pelanggan',
          entityId: newCustomer.id,
          description: `Menambahkan pelanggan baru: ${formData.name}`,
          storeId: currentStore?.id,
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
      identity_type: customer.identity_type || "",
      identity_number: customer.identity_number || "",
    });
    if (customer.identity_document_url) {
      getIdentityDocumentUrl(customer.identity_document_url).then(url => {
        if (url) setIdentityPreview(url);
      });
    }
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
          storeId: currentStore?.id,
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
      identity_type: "",
      identity_number: "",
    });
    setFormErrors({});
    setIdentityFile(null);
    setIdentityPreview(null);
  };

  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(query)) ||
        (customer.identity_number && customer.identity_number.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Identity type filter
    if (identityFilter !== "all") {
      if (customer.identity_type !== identityFilter) return false;
    }

    // Missing KTP filter
    if (showMissingKtp) {
      if (customer.identity_document_url) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Pelanggan</h2>
          <p className="text-muted-foreground mt-1">Kelola database pelanggan {currentStore?.name}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pelanggan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daftar Pelanggan ({filteredCustomers.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, nomor HP, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Identity type filter */}
              <Select value={identityFilter} onValueChange={setIdentityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Identitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="KTP">KTP</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                </SelectContent>
              </Select>
              {/* Missing KTP filter */}
              <Button
                variant={showMissingKtp ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMissingKtp(!showMissingKtp)}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Belum Upload KTP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nama</TableHead>
                  <TableHead>Nomor HP</TableHead>
                  <TableHead>Identitas</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {customers.length === 0 ? "Belum ada data pelanggan" : "Tidak ada pelanggan yang cocok dengan filter"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => {
                    const canModify = userRole === "admin" || userRole === "leader" || customer.created_by === userId;
                    
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>
                          {customer.identity_type && customer.identity_number ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {customer.identity_type}
                              </Badge>
                              <span className="text-sm">{customer.identity_number}</span>
                              {customer.identity_document_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={async () => {
                                    const url = await getIdentityDocumentUrl(customer.identity_document_url!);
                                    if (url) window.open(url, '_blank');
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
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
    <DialogContent className="max-h-[85vh] overflow-y-auto">
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

            {/* Identity Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4" />
                <Label className="text-base font-semibold">Data Identitas *</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="identity_type">Jenis Identitas *</Label>
                  <Select
                    value={formData.identity_type}
                    onValueChange={(value) => setFormData({ ...formData, identity_type: value })}
                  >
                    <SelectTrigger className={formErrors.identity_type ? "border-red-500" : ""}>
                      <SelectValue placeholder="Pilih jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KTP">KTP</SelectItem>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="PASSPORT">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.identity_type && (
                    <p className="text-sm text-red-500">{formErrors.identity_type}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="identity_number">Nomor Identitas *</Label>
                  <Input
                    id="identity_number"
                    value={formData.identity_number}
                    onChange={(e) => setFormData({ ...formData, identity_number: e.target.value })}
                    placeholder="Masukkan nomor identitas"
                    className={formErrors.identity_number ? "border-red-500" : ""}
                  />
                  {formErrors.identity_number && (
                    <p className="text-sm text-red-500">{formErrors.identity_number}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label>
                  Upload Dokumen Identitas *
                </Label>
                
                {identityPreview ? (
                  <div className="relative border rounded-lg p-2">
                    <img 
                      src={identityPreview} 
                      alt="Preview identitas" 
                      className="max-h-40 mx-auto object-contain rounded"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => {
                        setIdentityFile(null);
                        setIdentityPreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      type="file"
                      id="identity_file"
                      accept="image/*"
                      onChange={handleIdentityFileChange}
                      className="hidden"
                    />
                    <label 
                      htmlFor="identity_file" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Klik untuk upload foto identitas
                      </span>
                      <span className="text-xs text-gray-400">
                        Format: JPG, PNG (Maks. 5MB)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Batal
              </Button>
              <Button 
                type="submit" 
                className="bg-[#1f7acb] hover:bg-[#1a6ab0]"
                disabled={uploadingIdentity}
              >
                {uploadingIdentity ? "Mengupload..." : editingCustomer ? "Update" : "Simpan"}
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

      {/* View Identity Document Dialog */}
      <Dialog open={!!viewingIdentity} onOpenChange={() => setViewingIdentity(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumen Identitas</DialogTitle>
          </DialogHeader>
          {viewingIdentity && (
            <div className="flex justify-center">
              <img 
                src={viewingIdentity} 
                alt="Dokumen identitas" 
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
