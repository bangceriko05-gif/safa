import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { toast } from "sonner";

export interface UploadedFile {
  url: string;
  path: string;
  name: string;
  type: string;
}

export default function FileUploadGrid({
  label,
  files,
  onChange,
  storeId,
  folder,
}: {
  label: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  storeId: string;
  folder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    const next: UploadedFile[] = [...files];
    try {
      for (const f of Array.from(list)) {
        const compressed = await compressImage(f);
        const ext = compressed.name.split(".").pop() || "jpg";
        const path = `${storeId}/${folder}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("purchase-files")
          .upload(path, compressed, { upsert: false, contentType: compressed.type });
        if (error) throw error;
        const { data } = supabase.storage.from("purchase-files").getPublicUrl(path);
        next.push({ url: data.publicUrl, path, name: f.name, type: compressed.type });
      }
      onChange(next);
      toast.success("File berhasil diunggah");
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal mengunggah file: " + (e.message || ""));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (idx: number) => {
    const f = files[idx];
    try {
      await supabase.storage.from("purchase-files").remove([f.path]);
    } catch {}
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? "Mengunggah..." : "Tambah"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-md p-6 text-center text-sm text-muted-foreground cursor-pointer hover:bg-accent/40"
        >
          <Upload className="h-5 w-5 mx-auto mb-1" />
          Drop file atau klik untuk upload
          <div className="text-xs mt-1">Gambar otomatis dikompres</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative border rounded-md overflow-hidden bg-muted/30 group">
              {f.type.startsWith("image/") ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <img src={f.url} alt={f.name} className="w-full h-24 object-cover" />
                </a>
              ) : (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center h-24 text-xs"
                >
                  <FileText className="h-6 w-6 mb-1" />
                  <span className="truncate px-2 max-w-full">{f.name}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-90 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}