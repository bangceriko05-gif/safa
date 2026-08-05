import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/contexts/StoreContext";

interface Item {
  id: string;
  name: string;
  is_default?: boolean;
  qty?: number;
  sort_order?: number;
  pos_visible?: boolean;
}

interface Props {
  table:
    | "product_categories"
    | "product_brands"
    | "product_collections"
    | "product_materials"
    | "product_storages";
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
  const [dragId, setDragId] = useState<string | null>(null);
  const isCategory = table === "product_categories";

  const fetchItems = async () => {
    if (!currentStore) return;
    const selectCols =
      table === "product_materials"
        ? "id, name, is_default"
        : isCategory
        ? "id, name, sort_order, pos_visible"
        : "id, name";
    let query = supabase
      .from(table as any)
      .select(selectCols)
      .eq("store_id", currentStore.id);
    query = isCategory
      ? query.order("sort_order", { ascending: true }).order("name")
      : query.order("name");
    const { data, error } = await query;
    if (error) {
      toast.error("Gagal memuat data");
      return;
    }
    let list: Item[] = (data as any) || [];
    if (table === "product_materials" && list.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("material_id")
        .eq("store_id", currentStore.id);
      const counts: Record<string, number> = {};
      (prods || []).forEach((p: any) => {
        if (p.material_id) counts[p.material_id] = (counts[p.material_id] || 0) + 1;
      });
      list = list.map((i) => ({ ...i, qty: counts[i.id] || 0 }));
    }
    setItems(list);
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
      .from(table as any)
      .insert([
        {
          name: newName.trim(),
          store_id: currentStore.id,
          created_by: user.id,
          ...(isCategory
            ? { sort_order: items.reduce((m, i) => Math.max(m, i.sort_order || 0), 0) + 1 }
            : {}),
        },
      ]);
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
      .from(table as any)
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
    if (item.is_default) {
      toast.error("Jenis bahan default tidak dapat dihapus");
      return;
    }
    if (!confirm(`Hapus "${item.name}"?`)) return;
    const { error } = await supabase.from(table as any).delete().eq("id", item.id);
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

  const persistOrder = async (list: Item[]) => {
    setItems(list);
    await Promise.all(
      list.map((it, idx) =>
        supabase
          .from(table as any)
          .update({ sort_order: idx + 1 })
          .eq("id", it.id)
      )
    );
    onChanged?.();
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const list = [...items];
    [list[idx], list[target]] = [list[target], list[idx]];
    persistOrder(list);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const list = [...items];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    persistOrder(list);
  };

  const toggleVisible = async (item: Item) => {
    const next = !(item.pos_visible ?? true);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pos_visible: next } : i)));
    const { error } = await supabase
      .from(table as any)
      .update({ pos_visible: next })
      .eq("id", item.id);
    if (error) {
      toast.error("Gagal mengubah tampilan kategori");
      fetchItems();
      return;
    }
    toast.success(next ? "Kategori tampil di POS" : "Kategori disembunyikan dari POS");
    onChanged?.();
  };

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
                  <span className="flex-1 text-sm">
                    {item.name}
                    {table === "product_materials" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (qty. {item.qty || 0} produk)
                      </span>
                    )}
                    {item.is_default && (
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">(default)</span>
                    )}
                  </span>
                  {!item.is_default && (
                    <>
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
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}