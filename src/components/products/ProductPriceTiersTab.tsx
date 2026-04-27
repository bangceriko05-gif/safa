import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Tier {
  id?: string;
  min_quantity: number;
  price: number;
  label: string;
}

interface Props {
  productId: string | null;
}

export default function ProductPriceTiersTab({ productId }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);

  const load = async () => {
    if (!productId) {
      setTiers([]);
      return;
    }
    const { data } = await supabase
      .from("product_price_tiers")
      .select("*")
      .eq("product_id", productId)
      .order("min_quantity");
    setTiers(data || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const addRow = () =>
    setTiers((prev) => [...prev, { min_quantity: 1, price: 0, label: "" }]);

  const update = (i: number, patch: Partial<Tier>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const remove = async (i: number) => {
    const t = tiers[i];
    if (t.id) {
      await supabase.from("product_price_tiers").delete().eq("id", t.id);
    }
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!productId) {
      toast.error("Simpan produk terlebih dahulu.");
      return;
    }
    for (const t of tiers) {
      const payload = {
        product_id: productId,
        min_quantity: Number(t.min_quantity) || 1,
        price: Number(t.price) || 0,
        label: t.label?.trim() || null,
      };
      if (t.id) {
        await supabase.from("product_price_tiers").update(payload).eq("id", t.id);
      } else {
        await supabase.from("product_price_tiers").insert([payload]);
      }
    }
    toast.success("Tingkatan harga disimpan");
    load();
  };

  if (!productId) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-md">
        Simpan produk terlebih dahulu untuk menambah tingkatan harga.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Harga grosir berdasarkan jumlah pembelian minimum.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Tingkatan
          </Button>
          <Button size="sm" onClick={save}>
            Simpan
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Min. Qty</TableHead>
              <TableHead>Harga / Unit</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Belum ada tingkatan harga
                </TableCell>
              </TableRow>
            ) : (
              tiers.map((t, i) => (
                <TableRow key={t.id ?? `new-${i}`}>
                  <TableCell>
                    <Input
                      value={t.label ?? ""}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="mis. Grosir"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={t.min_quantity}
                      onChange={(e) => update(i, { min_quantity: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={t.price}
                      onChange={(e) => update(i, { price: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}