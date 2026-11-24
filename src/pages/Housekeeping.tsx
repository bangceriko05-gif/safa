import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, Brush, Check, Clock, Loader2, RefreshCw, Search, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStore } from '@/contexts/StoreContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { housekeepingRooms, jakartaDate, type CleaningStage, type HousekeepingStatus } from '@/utils/housekeeping';
import { logActivity } from '@/utils/activityLogger';
import { toast } from 'sonner';

const timeLabel = (value: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export default function Housekeeping() {
  const navigate = useNavigate();
  const { currentStore, userStores, setCurrentStore, isLoading, isStoreInactive } = useStore();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [stage, setStage] = useState<CleaningStage>('dirty');
  const [search, setSearch] = useState('');
  const [today, setToday] = useState(jakartaDate());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const key = ['housekeeping', currentStore?.id, userId, today];

  useEffect(() => {
    let active = true;
    let revision = 0;
    const validateUser = async () => {
      const request = ++revision;
      const { data, error } = await supabase.auth.getUser();
      if (!active || request !== revision) return;
      setUserId(error ? null : data.user?.id ?? null);
      setAuthLoaded(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        revision++;
        setUserId(null);
        setAuthLoaded(true);
      } else {
        setTimeout(() => { if (active) void validateUser(); }, 0);
      }
    });
    void validateUser();
    const timer = setInterval(() => setToday(jakartaDate()), 60_000);
    return () => { active = false; subscription.unsubscribe(); clearInterval(timer); };
  }, []);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: key,
    enabled: Boolean(userId && currentStore && !isStoreInactive),
    queryFn: async () => {
      if (!currentStore) throw new Error('Outlet unavailable');
      const { data: rooms, error } = await supabase.from('rooms').select('id,name,room_categories(name)').eq('store_id', currentStore.id).order('name');
      if (error) throw error;
      const statuses: HousekeepingStatus[] = [];
      if (rooms?.length) {
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from('room_daily_status').select('*').in('room_id', rooms.map(room => room.id)).lte('date', today).order('date', { ascending: false }).order('id').range(offset, offset + 999);
          if (result.error) throw result.error;
          statuses.push(...(result.data ?? []));
          if ((result.data?.length ?? 0) < 1000) break;
        }
      }
      const tasks = housekeepingRooms(statuses, today);
      const ids = [...new Set(tasks.flatMap(task => [task.cleaning_started_by, task.updated_by]).filter((id): id is string => Boolean(id)))];
      const profiles = ids.length ? await supabase.from('profiles').select('id,name').in('id', ids) : { data: [] };
      return { rooms: rooms ?? [], tasks, names: new Map((profiles.data ?? []).map(profile => [profile.id, profile.name])) };
    },
  });

  useEffect(() => {
    if (!currentStore || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void queryClient.invalidateQueries({ queryKey: ['housekeeping', currentStore.id, userId] }); }, 400); };
    const channel = supabase.channel(`housekeeping-${currentStore.id}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_daily_status' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `store_id=eq.${currentStore.id}` }, refresh).subscribe();
    window.addEventListener('booking-changed', refresh);
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); window.removeEventListener('booking-changed', refresh); };
  }, [currentStore?.id, userId, queryClient]);

  const action = async (id: string, name: string, command: 'start' | 'complete') => {
    if (!userId || !currentStore || busy) return;
    setBusy(id);
    try {
      const { error } = await supabase.rpc('housekeeping_action', { p_status_id: id, p_action: command });
      if (error) throw error;
      await queryClient.cancelQueries({ queryKey: key });
      const result = await refetch();
      if (result.error) throw result.error;
      const saved = result.data?.tasks.find(task => task.id === id || (task.room_id === data?.tasks.find(task => task.id === id)?.room_id));
      if (saved?.stage !== (command === 'start' ? 'process' : 'done')) throw new Error('Status changed');
      void logActivity({ actionType: 'updated', entityType: 'Room', entityId: saved.room_id, storeId: currentStore.id, description: `${command === 'start' ? 'Mulai membersihkan' : 'Selesai membersihkan'} kamar ${name}` });
      setStage(command === 'start' ? 'process' : 'done');
      toast.success(command === 'start' ? `Pembersihan kamar ${name} dimulai` : `Kamar ${name} sudah bersih`);
      window.dispatchEvent(new CustomEvent('booking-changed'));
    } catch (error) {
      console.error('Housekeeping action failed', error);
      toast.error('Status kamar belum berhasil diperbarui. Muat ulang daftar dan coba kembali.');
      void refetch();
    } finally { setBusy(null); setConfirm(null); }
  };

  const tasks = data?.tasks ?? [];
  const counts = { dirty: tasks.filter(task => task.stage === 'dirty').length, process: tasks.filter(task => task.stage === 'process').length, done: tasks.filter(task => task.stage === 'done').length };
  const total = tasks.length;
  const visible = tasks.filter(task => task.stage === stage).filter(task => {
    const room = data?.rooms.find(room => room.id === task.room_id);
    return `${room?.name} ${room?.room_categories?.name ?? ''}`.toLowerCase().includes(search.toLowerCase());
  });

  if (!authLoaded) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Memuat" /></div>;
  if (!userId) return <Navigate to="/auth?next=%2Fprofil" replace />;
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Memuat" /></div>;
  if (isStoreInactive || !currentStore) return <main className="min-h-screen bg-background p-6 flex flex-col items-center justify-center gap-4"><h1 className="text-2xl font-bold">Housekeeping</h1><p>{isStoreInactive ? 'Outlet belum aktif.' : 'Belum ada outlet yang dapat diakses.'}</p><Button onClick={() => navigate('/select-store?next=%2Fprofil')}>Pilih Outlet</Button></main>;

  return <main className="min-h-screen bg-muted/40 text-foreground pb-6">
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0"><Button variant="ghost" size="icon" aria-label="Kembali ke dashboard" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-6 w-6" /></Button><h1 className="text-2xl sm:text-3xl font-bold">Housekeeping</h1></div>
        <Button variant="ghost" size="icon" aria-label="Lihat kamar perlu dibersihkan" onClick={() => { setStage('dirty'); setSearch(''); }} className="relative shrink-0"><Bell className="h-6 w-6" />{counts.dirty > 0 && <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-destructive" />}</Button>
      </header>
      <div className="flex items-center gap-3 mb-5"><Select value={currentStore.id} onValueChange={id => { const store = userStores.find(store => store.id === id); if (store) { setCurrentStore(store); setSearch(''); } }}><SelectTrigger className="bg-card min-w-0 flex-1" aria-label="Outlet"><SelectValue /></SelectTrigger><SelectContent>{userStores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Muat ulang daftar kamar" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
      <section className="flex items-center gap-3 sm:gap-5 bg-destructive text-destructive-foreground rounded-lg px-4 py-5 sm:p-6">
        <Brush className="h-10 w-10 sm:h-12 sm:w-12 shrink-0" /><div className="min-w-0 flex-1"><h2 className="text-lg sm:text-2xl font-bold leading-snug">Kamar Perlu Dibersihkan</h2><p className="text-sm mt-1">{counts.process} kamar sedang dibersihkan</p></div><span className="shrink-0 rounded-lg bg-card text-destructive px-3 py-3 font-bold text-sm sm:text-lg">{counts.dirty} Kamar</span>
      </section>
      <nav aria-label="Status pembersihan" className="grid grid-cols-3 gap-2 mt-6 mb-5">{([{ value: 'dirty', label: 'Perlu Dibersihkan' }, { value: 'process', label: 'Proses' }, { value: 'done', label: 'Selesai' }] as const).map(tab => <Button key={tab.value} data-navigation aria-pressed={stage === tab.value} variant="secondary" className="h-auto min-h-12 whitespace-normal text-xs sm:text-sm px-2" onClick={() => setStage(tab.value)}>{tab.label} ({counts[tab.value]})</Button>)}</nav>
      <div className="relative mb-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9 bg-card" placeholder="Cari kamar atau kategori" value={search} onChange={event => setSearch(event.target.value)} aria-label="Cari kamar" /></div>
      <section aria-label="Daftar kamar" className="space-y-3">
        {isPending && <p className="text-center py-12 text-muted-foreground">Memuat kamar...</p>}
        {isError && <div className="py-10 text-center space-y-3"><p>Daftar kamar belum bisa dimuat.</p><Button variant="outline" onClick={() => void refetch()}>Coba lagi</Button></div>}
        {!isPending && !isError && !visible.length && <div className="py-12 text-center text-muted-foreground"><Sparkles className="h-10 w-10 mx-auto mb-3 text-success" /><p>{search ? 'Kamar tidak ditemukan.' : stage === 'dirty' ? 'Tidak ada kamar yang perlu dibersihkan.' : stage === 'process' ? 'Belum ada pembersihan yang sedang berjalan.' : 'Belum ada kamar selesai dibersihkan hari ini.'}</p></div>}
        {visible.map(task => { const room = data?.rooms.find(room => room.id === task.room_id); const person = data?.names.get(task.stage === 'done' ? task.updated_by ?? '' : task.cleaning_started_by ?? ''); return <article key={task.id} className="bg-card border border-border rounded-lg p-4 sm:p-5 flex items-center gap-4 shadow-sm"><div className={`self-stretch w-1.5 shrink-0 rounded-full ${task.stage === 'done' ? 'bg-success' : task.stage === 'process' ? 'bg-occupancy-low' : 'bg-destructive'}`} /><div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground font-semibold break-words">{room?.room_categories?.name || 'Kamar'}</p><h3 className="text-2xl sm:text-3xl font-bold break-words mt-1">{room?.name}</h3><div className="text-xs sm:text-sm mt-2 flex items-start gap-1.5 text-muted-foreground"><Clock className="h-4 w-4 shrink-0 mt-0.5" /><span>{task.stage === 'done' ? 'Selesai' : task.stage === 'process' ? 'Mulai' : 'Ditandai kotor'} {timeLabel(task.stage === 'process' ? task.cleaning_started_at ?? task.updated_at : task.updated_at)} WIB</span></div>{person && <p className="text-xs text-muted-foreground mt-1 break-words">Petugas: {person}</p>}<div className="mt-3 sm:hidden">{task.stage !== 'done' && <Button disabled={Boolean(busy)} variant={task.stage === 'dirty' ? 'destructive' : 'default'} className="h-11 max-w-full" onClick={() => task.stage === 'dirty' ? void action(task.id, room?.name ?? '', 'start') : setConfirm({ id: task.id, name: room?.name ?? '' })}>{busy === task.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brush className="h-4 w-4 mr-2" />}{task.stage === 'dirty' ? 'Mulai Bersihkan' : 'Selesai Bersihkan'}</Button>}</div></div><div className="hidden sm:block shrink-0">{task.stage === 'done' ? <span className="inline-flex items-center gap-2 text-success font-semibold"><Check className="h-5 w-5" />Bersih</span> : <Button disabled={Boolean(busy)} variant={task.stage === 'dirty' ? 'destructive' : 'default'} className="h-12" onClick={() => task.stage === 'dirty' ? void action(task.id, room?.name ?? '', 'start') : setConfirm({ id: task.id, name: room?.name ?? '' })}>{busy === task.id ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Brush className="h-5 w-5 mr-2" />}{task.stage === 'dirty' ? 'Mulai Bersihkan' : 'Selesai Bersihkan'}</Button>}</div></article>; })}
      </section>
      <footer className="border-t border-border mt-7 pt-5 flex gap-3 items-center"><Sparkles className="h-8 w-8 text-success shrink-0" /><div className="flex-1 min-w-0"><div className="flex justify-between gap-3 text-sm font-bold mb-3"><span>Progress Hari Ini</span><span className="shrink-0">{counts.done} / {total} Kamar</span></div><Progress value={total ? counts.done / total * 100 : 0} aria-label="Progress pembersihan" className="h-2.5 [&>div]:bg-success" /><p className="text-xs text-muted-foreground mt-2">Selesai dibersihkan · {new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p></div></footer>
    </div>
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kamar {confirm?.name} sudah bersih?</AlertDialogTitle><AlertDialogDescription>Kamar akan ditandai bersih dan status pada kalender diperbarui menjadi Ready.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={Boolean(busy)}>Batal</AlertDialogCancel><AlertDialogAction disabled={Boolean(busy)} onClick={event => { event.preventDefault(); if (confirm) void action(confirm.id, confirm.name, 'complete'); }}>Ya, Selesai</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}