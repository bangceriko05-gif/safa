import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PurchaseItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PurchaseNoteDialogProps {
  purchaseId: string | null;
  onClose: () => void;
}

export default function PurchaseNoteDialog({ purchaseId, onClose }: PurchaseNoteDialogProps) {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!purchaseId) return;
    setLoading(true);
    supabase
      .from("purchase_items" as any)
      .select("*")
      .eq("purchase_id", purchaseId)
      .then(({ data, error }) => {
        if (!error) setItems((data as any[]) || []);
        setLoading(false);
      });
  }, [purchaseId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);

  return (
    <Dialog open={!!purchaseId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail Nota Pembelian</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-4 text-center text-muted-foreground">Memuat...</div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">Tidak ada item</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(item.subtotal))}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
