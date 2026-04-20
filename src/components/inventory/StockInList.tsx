import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import StockInForm from "./StockInForm";

interface StockInRow {
  id: string;
  bid: string;
  date: string;
  supplier_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const statusBadge = (status: string) => {
  if (status === "posted") return <Badge className="bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/10">Posted</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-destructive border-destructive/30">Batal</Badge>;
  return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/10">Draft</Badge>;
};

export default function StockInList() {
  const { currentStore, userRole } = useStore();
  const [rows, setRows] = useState<StockInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockInRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [canHardDelete, setCanHardDelete] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // super admin via RPC
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (isSuper) {
        setCanHardDelete(true);
        return;
      }
      // akuntan role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAkuntan = (roles || []).some((r: any) => r.role === "akuntan");
      setCanHardDelete(isAkuntan);
    };
    checkRole();
  }, []);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_in" as any)
      .select("id, bid, date, supplier_name, total_amount, status, created_at")
      .eq("store_id", currentStore.id)
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentStore]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.bid?.toLowerCase().includes(q) ||
      (r.supplier_name || "").toLowerCase().includes(q)
    );
  });

  const handleOpenNew = () => {
    setEditId(null);
    setOpenForm(true);
  };

  const handleOpenEdit = (id: string) => {
    setEditId(id);
    setOpenForm(true);
  };

  const handleHardDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // If posted, revert stock first by cancelling (trigger reverts qty)
      if (deleteTarget.status === "posted") {
        const { error: cErr } = await supabase
          .from("stock_in" as any)
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", deleteTarget.id);
        if (cErr) throw cErr;
      }
      // Delete items then header
      const { error: iErr } = await supabase
        .from("stock_in_items" as any)
        .delete()
        .eq("stock_in_id", deleteTarget.id);
      if (iErr) throw iErr;
      const { error: hErr } = await supabase
        .from("stock_in" as any)
        .delete()
        .eq("id", deleteTarget.id);
      if (hErr) throw hErr;
      toast.success("Data berhasil dihapus permanen");
      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal menghapus: " + (e.message || ""));
    } finally {
      setDeleting(false);
    }
  };

  if (openForm) {
    return (
      <StockInForm
        stockInId={editId}
        onBack={() => {
          setOpenForm(false);
          setEditId(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor stok masuk / supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Stok Masuk
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No. Stok Masuk</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Memuat...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Belum ada data stok masuk
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{r.bid}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.supplier_name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.total_amount)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(r.id)}>
                          Buka
                        </Button>
                        {canHardDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1"
                            onClick={() => setDeleteTarget(r)}
                            title="Hapus permanen (Akuntan / Super Admin)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus permanen stok masuk?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus permanen dokumen <span className="font-mono font-semibold">{deleteTarget?.bid}</span>.
              {deleteTarget?.status === "posted" && (
                <> Stok produk yang sebelumnya ditambahkan akan <b>dikembalikan</b> (dikurangi) terlebih dahulu sebelum dokumen dihapus.</>
              )}
              <br />
              Tindakan ini <b>tidak dapat dibatalkan</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleHardDelete();
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
