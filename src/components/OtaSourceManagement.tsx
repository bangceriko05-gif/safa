import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Check, X, Globe } from "lucide-react";

interface OtaSource {
  id: string;
  name: string;
  is_active: boolean;
}

export default function OtaSourceManagement() {
  const { currentStore } = useStore();
  const [sources, setSources] = useState<OtaSource[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentStore) fetchSources();
  }, [currentStore]);

  const fetchSources = async () => {
    if (!currentStore) return;
    const { data, error } = await supabase
      .from("ota_sources")
      .select("id, name, is_active")
      .eq("store_id", currentStore.id)
      .order("name");

    if (error) {
      console.error("Error fetching OTA sources:", error);
      return;
    }
    setSources(data || []);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !currentStore) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("ota_sources").insert({
        name: newName.trim(),
        store_id: currentStore.id,
      });
      if (error) throw error;
      toast.success("Sumber OTA berhasil ditambahkan");
      setNewName("");
      fetchSources();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan sumber OTA");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      const { error } = await supabase
        .from("ota_sources")
        .update({ name: editingName.trim() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Sumber OTA berhasil diubah");
      setEditingId(null);
      fetchSources();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah sumber OTA");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus sumber OTA ini?")) return;
    try {
      const { error } = await supabase.from("ota_sources").delete().eq("id", id);
      if (error) throw error;
      toast.success("Sumber OTA berhasil dihapus");
      fetchSources();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus sumber OTA");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Sumber OTA
        </CardTitle>
        <CardDescription>
          Kelola daftar sumber Online Travel Agent (Traveloka, Booking.com, dll)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama sumber OTA (contoh: Traveloka)"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={loading || !newName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        </div>

        <div className="space-y-2">
          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada sumber OTA. Tambahkan di atas.
            </p>
          )}
          {sources.map((source) => (
            <div key={source.id} className="flex items-center gap-2 p-2 border rounded-md">
              {editingId === source.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(source.id)}
                  />
                  <Button size="icon" variant="ghost" onClick={() => handleUpdate(source.id)}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{source.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(source.id);
                      setEditingName(source.name);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(source.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
