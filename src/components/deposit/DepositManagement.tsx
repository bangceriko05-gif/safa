import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { logActivity } from "@/utils/activityLogger";
import { 
  Banknote, 
  CreditCard, 
  Trash2, 
  Undo2, 
  Eye,
  Loader2,
  Shield,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Deposit {
  id: string;
  room_id: string;
  room_name?: string;
  deposit_type: "uang" | "identitas";
  amount: number | null;
  identity_type: string | null;
  identity_owner_name: string | null;
  notes: string | null;
  photo_url: string | null;
  status: "active" | "returned";
  created_at: string;
  created_by_name?: string;
  returned_at?: string;
  returned_by_name?: string;
}

interface DepositManagementProps {
  refreshTrigger?: number;
  onAddDeposit?: () => void;
}

export default function DepositManagement({ refreshTrigger, onAddDeposit }: DepositManagementProps) {
  const { currentStore } = useStore();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDepositId, setDeleteDepositId] = useState<string | null>(null);
  const [returnDepositId, setReturnDepositId] = useState<string | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "returned">("all");

  useEffect(() => {
    if (currentStore) {
      fetchDeposits();
    }
  }, [currentStore, refreshTrigger]);

  const fetchDeposits = async () => {
    if (!currentStore) return;
    setIsLoading(true);
    try {
      const { data: depositsData, error } = await supabase
        .from("room_deposits")
        .select(`
          *,
          rooms (name)
        `)
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user names
      const userIds = [
        ...new Set([
          ...(depositsData?.map(d => d.created_by) || []),
          ...(depositsData?.map(d => d.returned_by).filter(Boolean) || []),
        ]),
      ];

      let userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        profiles?.forEach(p => {
          userNames[p.id] = p.name;
        });
      }

      const depositsWithNames: Deposit[] = depositsData?.map(d => ({
        ...d,
        deposit_type: d.deposit_type as "uang" | "identitas",
        status: d.status as "active" | "returned",
        room_name: d.rooms?.name,
        created_by_name: userNames[d.created_by] || "Unknown",
        returned_by_name: d.returned_by ? userNames[d.returned_by] : undefined,
      })) || [];

      setDeposits(depositsWithNames);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      toast.error("Gagal memuat data deposit");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnDepositId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const deposit = deposits.find(d => d.id === returnDepositId);

      const { error } = await supabase
        .from("room_deposits")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          returned_by: user.id,
        })
        .eq("id", returnDepositId);

      if (error) throw error;

      await logActivity({
        actionType: "updated",
        entityType: "Deposit",
        entityId: returnDepositId,
        description: `Menandai deposit kamar ${deposit?.room_name} sebagai dikembalikan`,
        storeId: currentStore?.id,
      });

      toast.success("Deposit berhasil ditandai dikembalikan");
      fetchDeposits();
    } catch (error: any) {
      console.error("Error returning deposit:", error);
      toast.error("Gagal mengembalikan deposit");
    } finally {
      setReturnDepositId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDepositId) return;
    try {
      const deposit = deposits.find(d => d.id === deleteDepositId);

      const { error } = await supabase
        .from("room_deposits")
        .delete()
        .eq("id", deleteDepositId);

      if (error) throw error;

      await logActivity({
        actionType: "deleted",
        entityType: "Deposit",
        entityId: deleteDepositId,
        description: `Menghapus deposit kamar ${deposit?.room_name}`,
        storeId: currentStore?.id,
      });

      toast.success("Deposit berhasil dihapus");
      fetchDeposits();
    } catch (error: any) {
      console.error("Error deleting deposit:", error);
      toast.error("Gagal menghapus deposit");
    } finally {
      setDeleteDepositId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredDeposits = deposits.filter(d => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  const activeCount = deposits.filter(d => d.status === "active").length;
  const returnedCount = deposits.filter(d => d.status === "returned").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Manajemen Deposit</CardTitle>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onAddDeposit && (
            <Button size="sm" onClick={onAddDeposit}>
              <Plus className="h-4 w-4 mr-1" />
              Tambah Deposit
            </Button>
          )}
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Semua ({deposits.length})
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Aktif ({activeCount})
          </Button>
          <Button
            variant={filter === "returned" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("returned")}
          >
            Dikembalikan ({returnedCount})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada data deposit
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kamar</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Dibuat Oleh</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeposits.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell className="font-medium">{deposit.room_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {deposit.deposit_type === "uang" ? (
                        <Banknote className="h-4 w-4 text-green-600" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="capitalize">{deposit.deposit_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {deposit.deposit_type === "uang" ? (
                      <span className="font-semibold text-green-600">
                        {formatCurrency(deposit.amount || 0)}
                      </span>
                    ) : (
                      <div>
                        <span className="text-sm font-medium">{deposit.identity_type}</span>
                        <p className="text-xs text-muted-foreground">
                          {deposit.identity_owner_name}
                        </p>
                      </div>
                    )}
                    {deposit.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{deposit.notes}</p>
                    )}
                    {deposit.photo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 mt-1"
                        onClick={() => setViewPhotoUrl(deposit.photo_url)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Lihat Foto
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={deposit.status === "active" ? "default" : "secondary"}
                      className={deposit.status === "active" ? "bg-green-500" : ""}
                    >
                      {deposit.status === "active" ? "Aktif" : "Dikembalikan"}
                    </Badge>
                    {deposit.status === "returned" && deposit.returned_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(deposit.returned_at), "dd MMM yyyy", { locale: idLocale })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(deposit.created_at), "dd MMM yyyy", { locale: idLocale })}
                  </TableCell>
                  <TableCell>{deposit.created_by_name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {deposit.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReturnDepositId(deposit.id)}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          Kembalikan
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDepositId(deposit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Return confirmation dialog */}
      <AlertDialog open={!!returnDepositId} onOpenChange={() => setReturnDepositId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pengembalian Deposit</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menandai deposit ini sebagai dikembalikan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn}>Kembalikan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteDepositId} onOpenChange={() => setDeleteDepositId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Deposit</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus deposit ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewPhotoUrl} onOpenChange={() => setViewPhotoUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto Deposit</DialogTitle>
          </DialogHeader>
          {viewPhotoUrl && (
            <img
              src={viewPhotoUrl}
              alt="Deposit photo"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
