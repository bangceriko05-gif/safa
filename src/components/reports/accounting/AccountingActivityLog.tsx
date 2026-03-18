import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface AccountingLog {
  id: string;
  user_name: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  description: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; variant: string }> = {
  created: { label: "Dibuat", variant: "default" },
  updated: { label: "Diperbarui", variant: "secondary" },
  deleted: { label: "Dihapus", variant: "destructive" },
  converted: { label: "Dikonversi", variant: "outline" },
};

export default function AccountingActivityLog() {
  const { currentStore } = useStore();
  const [logs, setLogs] = useState<AccountingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentStore) fetchLogs();
  }, [currentStore]);

  const fetchLogs = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_activity_logs' as any)
        .select('*')
        .eq('store_id', currentStore.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs((data as any) || []);
    } catch (error) {
      console.error("Error fetching accounting logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search.trim()
    ? logs.filter((l) => {
        const q = search.toLowerCase();
        return (
          l.user_name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          l.action_type.toLowerCase().includes(q)
        );
      })
    : logs;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari pengguna, deskripsi, tipe..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
              <TableHead className="text-primary-foreground font-semibold text-xs w-[150px]">Waktu</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[140px]">Pengguna</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[100px]">Aksi</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs w-[120px]">Modul</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-xs">Deskripsi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Belum ada aktivitas akuntansi.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => {
                const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type, variant: "outline" };
                return (
                  <TableRow key={log.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs py-3">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-xs py-3 font-medium">{log.user_name}</TableCell>
                    <TableCell className="text-xs py-3">
                      <Badge variant={actionInfo.variant as any} className="text-[10px]">
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs py-3">{log.entity_type}</TableCell>
                    <TableCell className="text-xs py-3 max-w-[400px] truncate">{log.description}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
