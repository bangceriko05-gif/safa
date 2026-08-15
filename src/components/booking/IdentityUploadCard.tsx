import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, IdCard, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompress";

interface Props {
  storeId?: string;
  customerId?: string | null;
  name: string;
  phone: string;
  onUploaded?: (path: string) => void;
}

export default function IdentityUploadCard({ storeId, customerId, name, phone, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        toast.error("Tidak bisa mengakses kamera perangkat: " + (e?.message || ""));
        setCameraOpen(false);
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOpen, stopCamera]);

  const persist = async (file: File) => {
    if (!storeId) {
      toast.error("Pilih cabang terlebih dahulu");
      return;
    }
    const cleanName = (name || "").trim();
    const cleanPhone = (phone || "").trim();
    if (!cleanName && !cleanPhone) {
      toast.error("Isi nama atau nomor HP pelanggan terlebih dahulu");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxDim: 1400, quality: 0.7 });
      let targetId = customerId || null;

      if (!targetId) {
        let q = supabase.from("customers").select("id").eq("store_id", storeId).limit(1);
        q = cleanPhone ? q.eq("phone", cleanPhone) : q.ilike("name", cleanName);
        const { data: existing } = await q;
        targetId = existing?.[0]?.id || null;
      }

      if (!targetId) {
        const { data: auth } = await supabase.auth.getUser();
        const { data: created, error: insErr } = await supabase
          .from("customers")
          .insert([
            {
              name: cleanName || cleanPhone,
              phone: cleanPhone,
              store_id: storeId,
              created_by: auth.user?.id as string,
            },
          ])
          .select("id")
          .single();
        if (insErr) throw insErr;
        targetId = created.id;
      }

      const filePath = `${storeId}/${targetId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("identity-documents")
        .upload(filePath, compressed, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("customers")
        .update({ identity_document_url: filePath })
        .eq("id", targetId);
      if (updErr) throw updErr;

      toast.success("Identitas pelanggan berhasil diupload");
      onUploaded?.(filePath);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal mengupload identitas: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.85));
    if (!blob) return;
    setCameraOpen(false);
    await persist(new File([blob], `identitas-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center gap-2 text-sm font-semibold">
        <IdCard className="h-4 w-4" /> Upload ID Identitas
      </div>
      <div className="p-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Pelanggan ini belum memiliki data CRM / identitas. Upload foto KTP/SIM/Paspor untuk melengkapi data.
        </p>

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            uploading && "pointer-events-none opacity-70"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) persist(f);
          }}
          onPaste={(e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith("image/")) {
                const f = items[i].getAsFile();
                if (f) persist(f);
                break;
              }
            }
          }}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) persist(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Mengupload...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">Drag &amp; drop foto identitas</p>
              <p className="text-xs text-muted-foreground">Atau klik untuk pilih file • Ctrl+V untuk paste</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => setCameraOpen(true)}
        >
          <Camera className="h-4 w-4 mr-2" /> Ambil Foto (Kamera)
        </Button>
      </div>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ambil Foto Identitas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <video ref={videoRef} playsInline muted className="w-full rounded-md bg-black aspect-video object-contain" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCameraOpen(false)}>
                Batal
              </Button>
              <Button type="button" className="flex-1" onClick={capture}>
                <Camera className="h-4 w-4 mr-2" /> Ambil Foto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
