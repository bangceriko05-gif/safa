import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

interface Item {
  id: string;
  name: string;
}

interface Props {
  table: "product_categories" | "product_brands";
  searchPlaceholder: string;
  onChanged?: () => void;
}

export default function ProductCategoryManager({ table, searchPlaceholder, onChanged }: Props) {
  const { currentStore } = useStore();
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchItems = async () => {
    if (!currentStore) return;
    const { data, error } = await supabase
      .from(table)
      .select("id, name")
      .eq("store_id", currentStore.id)
      .order("name");
    if (error) {
      toast.error("Gagal memuat data");
      return;
    }
    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const handleAdd = async () => {
    if (!newName.trim() || !currentStore) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from(table)
      .insert([{ name: newName.trim(), store_id: currentStore.id, created_by: user.id }]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Berhasil ditambahkan");
    setNewName("");
    setAdding(false);
    fetchItems();
    onChanged?.();
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    const { error } = await supabase
      .from(table)
      .update({ name: editingName.trim() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Berhasil diupdate");
    setEditingId(null);
    fetchItems();
    onChanged?.();
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Hapus "${item.name}"?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Berhasil dihapus");
    fetchItems();
    onChanged?.();
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1"
        />
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah
        </Button>
      </div>

      <div className="border rounded-md divide-y">
        {adding && (
          <div className="flex items-center gap-2 p-3">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama baru..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              className="flex-1"
            />
            <Button size="icon" variant="outline" onClick={handleAdd}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {filtered.length === 0 && !adding ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Belum ada data
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-3">
              {editingId === item.id ? (
                <>
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(item.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleUpdate(item.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{item.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(item)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}