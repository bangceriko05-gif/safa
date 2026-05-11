import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import DiscountDialog from "./DiscountDialog";

export interface PickedProduct {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

interface Product {
  id: string;
  name: string;
  purchase_price: number;
  price: number;
  sku: string | null;
  stock_qty: number;
}

export default function AddProductDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (p: PickedProduct) => void;
}) {
  const { currentStore } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"rp" | "pct">("rp");
  const [discountInput, setDiscountInput] = useState(0);

  useEffect(() => {
    if (!open || !currentStore) return;
    setSelected(null); setSearch(""); setQty(1); setUnitPrice(0); setDiscount(0);
    setDiscountMode("rp"); setDiscountInput(0);
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,purchase_price,price,sku,stock_qty")
        .eq("store_id", currentStore.id)
        .eq("is_active", true)
        .order("name");
      setProducts((data as Product[]) || []);
    })();
  }, [open, currentStore]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [products, search]);

  const pick = (p: Product) => {
    setSelected(p);
    setUnitPrice(Number(p.purchase_price) || 0);
  };

  const submit = () => {
    if (!selected) return;
    onAdd({
      product_id: selected.id,
      product_name: selected.name,
      quantity: qty,
      unit_price: unitPrice,
      discount,
    });
    onClose();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Produk</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="pl-9"
            />
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Produk tidak ditemukan</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent border-b last:border-b-0 ${
                    selected?.id === p.id ? "bg-accent" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku ? `SKU: ${p.sku} · ` : ""}Stok: {p.stock_qty}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmt(Number(p.purchase_price) || 0)}</div>
                </button>
              ))
            )}
          </div>

          {selected && (
            <div className="grid grid-cols-3 gap-3 border-t pt-4">
              <div>
                <Label>Qty</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Harga (IDR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Diskon (IDR)</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setDiscountOpen(true)}
                >
                  <span>{fmt(discount)}</span>
                  <span className="text-xs text-muted-foreground">Atur</span>
                </Button>
              </div>
              <div className="col-span-3 text-right text-sm">
                Subtotal: <span className="font-bold">{fmt(qty * unitPrice - discount)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={submit} disabled={!selected}>Tambahkan</Button>
          </div>
        </div>
        <DiscountDialog
          open={discountOpen}
          onClose={() => setDiscountOpen(false)}
          baseAmount={qty * unitPrice}
          initialMode={discountMode}
          initialValue={discountInput}
          onApply={(abs, mode, value) => {
            setDiscount(abs);
            setDiscountMode(mode);
            setDiscountInput(value);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
