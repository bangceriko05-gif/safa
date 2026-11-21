import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Notice {
  id: string;
  description: string;
  user_name: string;
  created_at: string;
}

export default function DashboardNotifications({ storeId, userId }: { storeId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const readKey = `anka:notifications:read:${userId}:${storeId}`;
  const [lastRead, setLastRead] = useState(() => localStorage.getItem(readKey) || "");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("activity_logs")
      .select("id, description, user_name, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }).limit(20);
    setFailed(Boolean(error));
    if (error) console.error("Notification history unavailable", error);
    else setNotices(data || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void load();
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase.channel(`dashboard-notifications-${storeId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs", filter: `store_id=eq.${storeId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load(), 400);
      }).subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [load, storeId, userId]);

  useEffect(() => {
    const latest = notices[0]?.created_at;
    if (open && latest) {
      localStorage.setItem(readKey, latest);
      setLastRead(latest);
    }
  }, [open, notices, readKey]);

  const unread = notices.some(notice => !lastRead || new Date(notice.created_at) > new Date(lastRead));
  return (
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) void load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifikasi" title="Notifikasi" className="relative h-9 w-9 shrink-0 rounded-full">
          <Bell className="h-4 w-4" />
          {unread && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-24px)] p-0" aria-label="Daftar notifikasi">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifikasi</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Muat ulang notifikasi" title="Muat ulang" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[min(420px,65vh)] overflow-y-auto">
          {loading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : failed ? <div className="space-y-2 p-4 text-sm"><p>Notifikasi belum dapat dimuat. Silakan coba lagi.</p><Button variant="outline" size="sm" onClick={() => void load()}>Coba lagi</Button></div>
            : notices.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
            : <ul className="divide-y divide-border">{notices.map(notice => (
              <li key={notice.id} className="space-y-1 px-4 py-3">
                <p className="break-words text-sm text-foreground">{notice.description}</p>
                <p className="break-words text-xs text-muted-foreground">{notice.user_name} · {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(notice.created_at))} WIB</p>
              </li>
            ))}</ul>}
        </div>
      </PopoverContent>
    </Popover>
  );
}