import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/contexts/StoreContext";
import { Loader2, Plus, Eye, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";

interface JournalEntry {
  id: string;
  entry_date: string;
  description: string;
  reference_no: string | null;
  created_at: string;
}

export default function JournalEntries() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entry_date: format(new Date(), "yyyy-MM-dd"), description: "", reference_no: "" });

  useEffect(() => {
    if (!currentStore) return;
    fetchEntries();
  }, [currentStore]);

  const fetchEntries = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("entry_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      setEntries((data as JournalEntry[]) || []);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("journal_entries").insert({
        store_id: currentStore.id,
        entry_date: form.entry_date,
        description: form.description,
        reference_no: form.reference_no || null,
        created_by: user.id,
      });

      if (error) throw error;
      toast.success("Jurnal berhasil ditambahkan");
      setShowForm(false);
      setForm({ entry_date: format(new Date(), "yyyy-MM-dd"), description: "", reference_no: "" });
      fetchEntries();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan jurnal");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Jurnal Umum
        </h3>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Jurnal
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Referensi</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Belum ada jurnal. Klik "Tambah Jurnal" untuk membuat catatan baru.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {format(new Date(entry.entry_date), "d MMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{entry.reference_no || "-"}</TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Jurnal Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>No. Referensi</Label>
              <Input value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} placeholder="Opsional" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required placeholder="Deskripsi transaksi" />
            </div>
            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
