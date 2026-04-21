import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Phone, Mail, MapPin, Package } from "lucide-react";
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
import SupplierForm from "./SupplierForm";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  photo_url: string | null;
  is_active: boolean;
}

export default function SupplierManagement() {
  const { currentStore } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers" as any)
      .select("id, name, contact_person, email, phone, city, province, photo_url, is_active")
      .eq("store_id", currentStore.id)
      .order("name");
    if (error) {
      toast.error("Gagal memuat supplier");
    } else {
      setSuppliers((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("suppliers" as any).delete().eq("id", deletingId);
    if (error) {
      toast.error("Gagal menghapus supplier");
    } else {
      toast.success("Supplier dihapus");
      load();
    }
    setDeletingId(null);
  };

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q)
    );
  });

  if (formOpen) {
    return (
      <SupplierForm
        supplierId={editingId}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        onSaved={() => {
          setFormOpen(false);
          setEditingId(null);
          load();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Supplier</CardTitle>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Tambah Supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, kontak, email, telpon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed rounded-lg">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Belum ada supplier</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Supplier</th>
                  <th className="text-left px-4 py-2 font-medium">Personal Yg Dihubungi</th>
                  <th className="text-left px-4 py-2 font-medium">Kontak</th>
                  <th className="text-left px-4 py-2 font-medium">Lokasi</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={s.name} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.contact_person || <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3 text-muted-foreground" /> {s.email}
                          </div>
                        )}
                        {!s.phone && !s.email && <span className="text-muted-foreground">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.city || s.province ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[s.city, s.province].filter(Boolean).join(", ")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_active ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-0">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingId(s.id);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeletingId(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Supplier akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}