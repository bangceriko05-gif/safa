import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, RefreshCw, Copy, Printer, Search, ExternalLink } from "lucide-react";

interface RoomRow {
  id: string;
  name: string;
  barcode_code: string | null;
}

// Kode barcode = nama kamar (uppercase, spasi jadi strip)
function codeFromName(name: string) {
  return name.trim().toUpperCase().replace(/\s+/g, "-");
}

// Gambar QR + logo di tengah sesuai pengaturan Super Admin
async function buildQrWithLogo(
  text: string,
  logoMode: string,
  storeImage: string | null
): Promise<string> {
  const size = 640;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return QRCode.toDataURL(text, { width: size, margin: 1 });

  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  if (logoMode === "none") return canvas.toDataURL("image/png");

  const box = Math.round(size * 0.24);
  const x = (size - box) / 2;
  const radius = 16;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + radius, x);
  ctx.arcTo(x + box, x, x + box, x + box, radius);
  ctx.arcTo(x + box, x + box, x, x + box, radius);
  ctx.arcTo(x, x + box, x, x, radius);
  ctx.arcTo(x, x, x + box, x, radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (logoMode === "outlet" && storeImage) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = storeImage;
      });
      const pad = box * 0.1;
      const inner = box - pad * 2;
      const scale = Math.min(inner / img.width, inner / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, x + (box - w) / 2, x + (box - h) / 2, w, h);
      return canvas.toDataURL("image/png");
    } catch {
      /* fallback ke teks di bawah */
    }
  }

  ctx.fillStyle = "#1d4ed8";
  ctx.font = `bold ${Math.round(box * 0.32)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ANKA", size / 2, size / 2);
  return canvas.toDataURL("image/png");
}

export default function RoomBarcodeSettings() {
  const { currentStore } = useStore();
  const [logoMode, setLogoMode] = useState<string>("anka");
  const [storeImage, setStoreImage] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ room: RoomRow; dataUrl: string } | null>(null);

  const scanBaseUrl = useMemo(() => `${window.location.origin}/room-scan`, []);

  useEffect(() => {
    if (!currentStore?.id) return;
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("qr_logo_mode, image_url")
        .eq("id", currentStore.id)
        .maybeSingle();
      setLogoMode(((data as any)?.qr_logo_mode as string) || "anka");
      setStoreImage(((data as any)?.image_url as string) || null);
    })();
  }, [currentStore?.id]);

  const loadRooms = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, barcode_code")
      .eq("store_id", currentStore.id)
      .order("name");
    if (error) {
      toast.error("Gagal memuat kamar");
      setLoading(false);
      return;
    }
    const list = (data as RoomRow[]) || [];
    setRooms(list);
    setLoading(false);

    // Otomatis isi barcode dari nama kamar untuk yang belum punya / kodenya berbeda dari nama
    const toFix = list.filter((r) => r.barcode_code !== codeFromName(r.name));
    if (toFix.length) {
      for (const room of toFix) {
        const clean = codeFromName(room.name);
        // eslint-disable-next-line no-await-in-loop
        const { error: upErr } = await supabase
          .from("rooms")
          .update({ barcode_code: clean } as any)
          .eq("id", room.id);
        if (upErr) {
          // Kode bentrok dengan kamar lain — tambahkan suffix unik
          const alt = `${clean}-${room.id.slice(0, 4).toUpperCase()}`;
          // eslint-disable-next-line no-await-in-loop
          await supabase.from("rooms").update({ barcode_code: alt } as any).eq("id", room.id);
          setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, barcode_code: alt } : r)));
        } else {
          setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, barcode_code: clean } : r)));
        }
      }
    }
  };

  useEffect(() => {
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const roomUrl = (room: RoomRow) => `${scanBaseUrl}?code=${encodeURIComponent(room.barcode_code || "")}`;

  const showQr = async (room: RoomRow) => {
    if (!room.barcode_code) return;
    const dataUrl = await buildQrWithLogo(roomUrl(room), logoMode, storeImage);
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
          <Button variant="outline" onClick={loadRooms}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Kode barcode otomatis sama dengan nama kamar. Saat dipindai, sistem menampilkan pesanan produk POS dari kamar tersebut.
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
            {filtered.map((room) => (
              <div
                key={room.id}
                className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg border p-3"
              >
                <div className="md:w-56">
                  <p className="font-medium">{room.name}</p>
                  {room.barcode_code ? (
                    <Badge variant="secondary" className="mt-1">Barcode aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1">Membuat barcode...</Badge>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Kode barcode</p>
                  <p className="font-mono text-sm">{room.barcode_code || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
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
            ))}
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
