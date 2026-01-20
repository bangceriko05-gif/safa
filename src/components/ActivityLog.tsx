import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ActivityLog {
  id: string;
  user_name: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
  store_id: string | null;
}

export const ActivityLog = () => {
  const { currentStore } = useStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (currentStore?.id) {
      fetchLogs();
    }
  }, [currentStore?.id]);

  const fetchLogs = async () => {
    if (!currentStore?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Gagal memuat riwayat aktivitas");
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const colors = {
      created: "bg-green-100 text-green-800 border-green-200",
      updated: "bg-blue-100 text-blue-800 border-blue-200",
      deleted: "bg-red-100 text-red-800 border-red-200",
      login: "bg-gray-100 text-gray-800 border-gray-200",
    };

    const labels = {
      created: "Dibuat",
      updated: "Diubah",
      deleted: "Dihapus",
      login: "Login",
    };

    return (
      <Badge variant="outline" className={colors[action as keyof typeof colors]}>
        {labels[action as keyof typeof labels] || action}
      </Badge>
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    
    let matchesDate = true;
    if (startDate && endDate) {
      const logDate = new Date(log.created_at);
      matchesDate = logDate >= new Date(startDate) && logDate <= new Date(endDate);
    }

    return matchesSearch && matchesAction && matchesEntity && matchesDate;
  });

  const handleExport = () => {
    const exportData = filteredLogs.map((log) => ({
      Pengguna: log.user_name,
      Role: log.user_role,
      Aksi: log.action_type,
      Entitas: log.entity_type,
      Deskripsi: log.description,
      Waktu: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: id }),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Aktivitas");
    XLSX.writeFile(wb, `log-aktivitas-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Log aktivitas berhasil diexport");
  };

  const uniqueEntities = Array.from(new Set(logs.map((log) => log.entity_type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1f7acb] mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat riwayat aktivitas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Log Aktivitas</h2>
        <Button onClick={handleExport} className="bg-[#1f7acb] hover:bg-[#1a6ab0]">
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari pengguna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Jenis Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="created">Dibuat</SelectItem>
              <SelectItem value="updated">Diubah</SelectItem>
              <SelectItem value="deleted">Dihapus</SelectItem>
              <SelectItem value="login">Login</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Entitas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Entitas</SelectItem>
              {uniqueEntities.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Dari Tanggal"
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Sampai Tanggal"
          />
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Pengguna</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Jenis Aksi</TableHead>
                <TableHead>Entitas</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    Tidak ada riwayat aktivitas
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.user_role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action_type)}</TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: id })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
