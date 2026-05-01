import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, ArrowLeftRight } from "lucide-react";

interface Conversion {
  id: string;
  product_id: string;
  from_unit: string;
  to_unit: string;
  factor: number;
  price_per_from: number;
  is_active: boolean;
}

interface Props {
  productId: string | null;
}

const COMMON_UNITS = ["pcs", "kg", "gram", "liter", "ml", "dus", "lusin", "kodi"];

const fmt = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export default function ProductUnitConversionTab({ productId }: Props) {
  const [items, setItems] = useState<Conversion[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Conversion | null>(null);

  const [fromU, setFromU] = useState("");
  const [toU, setToU] = useState("");
  const [factor, setFactor] = useState<number>(0);
  const [pricePerFrom, setPricePerFrom] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    if (!productId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("product_unit_conversions")
      .select("*")
      .eq("product_id", productId)
      .order("created_at");
    setItems((data as any) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const openAdd = () => {
    setEditing(null);
    setFromU("");
    setToU("");
    setFactor(0);
    setPricePerFrom(0);
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (c: Conversion) => {
    setEditing(c);
    setFromU(c.from_unit);
    setToU(c.to_unit);
    setFactor(Number(c.factor));
    setPricePerFrom(Number(c.price_per_from));
    setIsActive(c.is_active);
    setOpen(true);
  };

  const save = async () => {
    if (!productId) {
      toast.error("Simpan produk terlebih dahulu");
      return;
    }
    if (!fromU || !toU) {
      toast.error("Pilih satuan asal dan tujuan");
      return;
    }
    if (!factor || factor <= 0) {
      toast.error("Faktor konversi wajib diisi");
      return;
    }
    const payload = {
      product_id: productId,
      from_unit: fromU,
      to_unit: toU,
      factor: Number(factor),
      price_per_from: Number(pricePerFrom) || 0,
      is_active: isActive,
    };
    if (editing) {
      const { error } = await supabase
        .from("product_unit_conversions")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("product_unit_conversions")
        .insert([payload]);
      if (error) return toast.error(error.message);
    }
    toast.success("Konversi disimpan");
    setOpen(false);
    load();
  };

  if (!productId) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-md">
        Simpan produk terlebih dahulu untuk menambahkan konversi satuan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Konversi Satuan</h3>
          <p className="text-sm text-muted-foreground">
            Atur konversi antar satuan untuk produk ini
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Konversi
        </Button>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Konversi Umum</p>
        <div className="flex flex-wrap gap-2">
          {[
            "1 kg = 1000 gram",
            "1 liter = 1000 ml",
            "1 lusin = 12 pcs",
            "1 kodi = 20 pcs",
            "1 dus = 24 pcs",
          ].map((t) => (
            <span
              key={t}
              className="px-3 py-1 text-xs rounded border bg-muted/40"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dari Satuan</TableHead>
              <TableHead></TableHead>
              <TableHead>Ke Satuan</TableHead>
              <TableHead>Faktor Konversi</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Belum ada konversi
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => {
                const perTo =
                  c.factor > 0 ? c.price_per_from / c.factor : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.from_unit}</TableCell>
                    <TableCell>
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>{c.to_unit}</TableCell>
                    <TableCell>
                      1 {c.from_unit} = {fmt(c.factor)} {c.to_unit}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        Rp {fmt(c.price_per_from)}/{c.from_unit}
                      </div>
                      <div className="text-xs text-blue-600">
                        = Rp {fmt(perTo)}/{c.to_unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                          Nonaktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Konversi Satuan" : "Tambah Konversi Satuan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Dari Satuan <span className="text-destructive">*</span>
                </Label>
                <Select value={fromU} onValueChange={setFromU}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Ke Satuan <span className="text-destructive">*</span>
                </Label>
                <Select value={toU} onValueChange={setToU}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Faktor Konversi <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={factor || ""}
                onChange={(e) => setFactor(Number(e.target.value))}
                placeholder="Contoh: 24 (untuk 1 dus = 24 pcs)"
              />
              <p className="text-xs text-muted-foreground">
                1 [dari] = [faktor] [ke]
              </p>
            </div>
            <div className="space-y-2">
              <Label>Harga per satuan asal</Label>
              <Input
                type="number"
                value={pricePerFrom || ""}
                onChange={(e) => setPricePerFrom(Number(e.target.value))}
                placeholder="Contoh: 24000 (harga per dus)"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Konversi Aktif</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button className="flex-1" onClick={save}>
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}