import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface DemoRequest {
  id: string;
  full_name: string;
  hotel_name: string;
  email: string;
  whatsapp: string;
  room_count: string;
  created_at: string;
}

export default function DemoRequestsManagement() {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("demo_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      toast.error("Gagal memuat data permintaan demo");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus permintaan demo ini?")) return;
    try {
      const { error } = await supabase.from("demo_requests").delete().eq("id", id);
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Permintaan demo dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Permintaan Demo</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{requests.length} total</Badge>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Belum ada permintaan demo.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {format(new Date(req.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                    </TableCell>
                    <TableCell className="font-medium">{req.full_name}</TableCell>
                    <TableCell>{req.hotel_name || "-"}</TableCell>
                    <TableCell>
                      <a href={`mailto:${req.email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail className="h-3 w-3" />
                        {req.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://wa.me/${req.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {req.whatsapp}
                      </a>
                    </TableCell>
                    <TableCell>{req.room_count}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(req.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
