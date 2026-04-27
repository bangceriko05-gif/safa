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

interface Variant {
  id?: string;
  variant_name: string;
  sku: string;
  price: number;
  purchase_price: number;
  stock: number;
  is_active: boolean;
  _new?: boolean;
}

interface Props {
  productId: string | null;
}

export default function ProductVariantsTab({ productId }: Props) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!productId) {
      setVariants([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("created_at");
    setVariants(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const addRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        variant_name: "",
        sku: "",
        price: 0,
        purchase_price: 0,
        stock: 0,
        is_active: true,
        _new: true,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<Variant>) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const removeRow = async (idx: number) => {
    const v = variants[idx];
    if (v.id) {
      const { error } = await supabase.from("product_variants").delete().eq("id", v.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    if (!productId) {
      toast.error("Simpan produk dulu sebelum menambah varian.");
      return;
    }
    for (const v of variants) {
      const payload = {
        product_id: productId,
        variant_name: v.variant_name.trim(),
        sku: v.sku?.trim() || null,
        price: Number(v.price) || 0,
        purchase_price: Number(v.purchase_price) || 0,
        stock: Number(v.stock) || 0,
        is_active: v.is_active,
      };
      if (!payload.variant_name) continue;
      if (v.id) {
        await supabase.from("product_variants").update(payload).eq("id", v.id);
      } else {
        await supabase.from("product_variants").insert([payload]);
      }
    }
    toast.success("Varian disimpan");
    load();
  };

  if (!productId) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-md">
        Simpan produk terlebih dahulu untuk menambahkan varian.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Tambahkan varian (size, warna, dll). Setiap varian punya stok sendiri.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Varian
          </Button>
          <Button size="sm" onClick={saveAll} disabled={loading}>
            Simpan
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Varian</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Harga Beli</TableHead>
              <TableHead>Harga Jual</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Belum ada varian
                </TableCell>
              </TableRow>
            ) : (
              variants.map((v, idx) => (
                <TableRow key={v.id ?? `new-${idx}`}>
                  <TableCell>
                    <Input
                      value={v.variant_name}
                      onChange={(e) => updateRow(idx, { variant_name: e.target.value })}
                      placeholder="mis. Size 39"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={v.sku ?? ""}
                      onChange={(e) => updateRow(idx, { sku: e.target.value })}
                      placeholder="SKU"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={v.purchase_price}
                      onChange={(e) => updateRow(idx, { purchase_price: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={v.price}
                      onChange={(e) => updateRow(idx, { price: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={v.stock}
                      onChange={(e) => updateRow(idx, { stock: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(idx)}
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