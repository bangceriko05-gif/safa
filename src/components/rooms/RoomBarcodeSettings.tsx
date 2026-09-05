import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, RefreshCw, Copy, Printer, Search, ExternalLink } from "lucide-react";

interface RoomRow {
  id: string;
  name: string;
  barcode_code: string | null;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function RoomBarcodeSettings() {
  const { currentStore } = useStore();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ room: RoomRow; dataUrl: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const scanBaseUrl = useMemo(() => `${window.location.origin}/room-scan`, []);

  const loadRooms = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, barcode_code")
      .eq("store_id", currentStore.id)
      .order("name");
    if (error) toast.error("Gagal memuat kamar");
    setRooms((data as RoomRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const saveCode = async (room: RoomRow, code: string) => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!clean) {
      toast.error("Kode barcode tidak boleh kosong");
      return;
    }
    setSavingId(room.id);
    const { error } = await supabase.from("rooms").update({ barcode_code: clean } as any).eq("id", room.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Kode sudah dipakai kamar lain" : "Gagal menyimpan kode");
      return;
    }
    toast.success(`Barcode ${room.name} disimpan`);
    setDrafts((d) => {
      const next = { ...d };
      delete next[room.id];
      return next;
    });
    setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, barcode_code: clean } : r)));
  };

  const generateCode = (room: RoomRow) =>
    saveCode(room, `${slugify(room.name).toUpperCase()}-${randomSuffix()}`);

  const generateAll = async () => {
    const targets = rooms.filter((r) => !r.barcode_code);
    if (!targets.length) {
      toast.info("Semua kamar sudah punya barcode");
      return;
    }
    for (const room of targets) {
      // eslint-disable-next-line no-await-in-loop
      await saveCode(room, `${slugify(room.name).toUpperCase()}-${randomSuffix()}`);
    }
  };

  const roomUrl = (room: RoomRow) => `${scanBaseUrl}?code=${encodeURIComponent(room.barcode_code || "")}`;

  const showQr = async (room: RoomRow) => {
    if (!room.barcode_code) return;
    const dataUrl = await QRCode.toDataURL(roomUrl(room), { width: 640, margin: 1 });
    setPreview({ room, dataUrl });
  };

  const copyLink = async (room: RoomRow) => {
    await navigator.clipboard.writeText(roomUrl(room));
    toast.success("Link scan disalin");
  };

  const printQr = () => {
    if (!preview) return;
    const w = window.open("", "_blank", "width=420,height=620");
    if (!w) return;
    w.document.write(`<html><head><title>QR ${preview.room.name}</title></head>
      <body style="font-family:system-ui;text-align:center;padding:24px">
        <h2 style="margin:0 0 4px">${preview.room.name}</h2>
        <p style="margin:0 0 16px;color:#666">${preview.room.barcode_code}</p>
        <img src="${preview.dataUrl}" style="width:280px;height:280px" />
        <p style="margin-top:16px;color:#666;font-size:12px">Scan untuk melihat pesanan POS kamar ini</p>
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`);
    w.document.close();
  };

  const filtered = rooms.filter((r) =>
    `${r.name} ${r.barcode_code || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Settingan Kamar — Barcode
          </CardTitle>
          <Button variant="outline" onClick={generateAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Buat Barcode Otomatis
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Setiap kamar bisa punya barcode/QR sendiri. Saat dipindai, sistem menampilkan pesanan produk POS dari kamar tersebut.
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kamar atau kode barcode..."
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Memuat kamar...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Tidak ada kamar.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((room) => {
              const value = drafts[room.id] ?? room.barcode_code ?? "";
              return (
                <div
                  key={room.id}
                  className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg border p-3"
                >
                  <div className="md:w-56">
                    <p className="font-medium">{room.name}</p>
                    {room.barcode_code ? (
                      <Badge variant="secondary" className="mt-1">Barcode aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1">Belum ada barcode</Badge>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Kode barcode</Label>
                    <Input
                      value={value}
                      onChange={(e) => setDrafts((d) => ({ ...d, [room.id]: e.target.value }))}
                      placeholder="Contoh: 101-KING-A1B2"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={savingId === room.id}
                      onClick={() => saveCode(room, value)}
                    >
                      Simpan
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generateCode(room)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!room.barcode_code}
                      onClick={() => showQr(room)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!room.barcode_code}
                      onClick={() => copyLink(room)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!room.barcode_code}
                      onClick={() => window.open(roomUrl(room), "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR {preview?.room.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="text-center space-y-3">
              <img src={preview.dataUrl} alt={`QR ${preview.room.name}`} className="mx-auto w-56 h-56" />
              <p className="text-sm text-muted-foreground break-all">{preview.room.barcode_code}</p>
              <Button className="w-full" onClick={printQr}>
                <Printer className="mr-2 h-4 w-4" />
                Cetak QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
