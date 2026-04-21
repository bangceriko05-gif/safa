import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2 } from "lucide-react";

interface Props {
  supplierId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const PROVINCES = [
  "Aceh", "Bali", "Banten", "Bengkulu", "DI Yogyakarta", "DKI Jakarta",
  "Gorontalo", "Jambi", "Jawa Barat", "Jawa Tengah", "Jawa Timur",
  "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah",
  "Kalimantan Timur", "Kalimantan Utara", "Kepulauan Bangka Belitung",
  "Kepulauan Riau", "Lampung", "Maluku", "Maluku Utara",
  "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Papua", "Papua Barat",
  "Riau", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tengah",
  "Sulawesi Tenggara", "Sulawesi Utara", "Sumatera Barat",
  "Sumatera Selatan", "Sumatera Utara",
];

export default function SupplierForm({ supplierId, onClose, onSaved }: Props) {
  const { currentStore } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [country, setCountry] = useState("Indonesia");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(!!supplierId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!supplierId) return;
      const { data } = await supabase
        .from("suppliers" as any)
        .select("*")
        .eq("id", supplierId)
        .maybeSingle();
      if (data) {
        const r: any = data;
        setName(r.name || "");
        setContactPerson(r.contact_person || "");
        setEmail(r.email || "");
        setPhone(r.phone || "");
        setNotes(r.notes || "");
        setPhotoUrl(r.photo_url || null);
        setCountry(r.country || "Indonesia");
        setProvince(r.province || "");
        setCity(r.city || "");
        setPostalCode(r.postal_code || "");
        setAddress(r.address || "");
      }
      setLoading(false);
    };
    load();
  }, [supplierId]);

  const handleUpload = async (file: File) => {
    if (!currentStore) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${currentStore.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("supplier-photos")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("supplier-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (e: any) {
      toast.error("Gagal mengunggah foto: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama supplier wajib diisi");
      return;
    }
    if (!currentStore) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const payload: any = {
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        photo_url: photoUrl,
        country: country || null,
        province: province || null,
        city: city || null,
        postal_code: postalCode.trim() || null,
        address: address.trim() || null,
      };

      if (supplierId) {
        const { error } = await supabase
          .from("suppliers" as any)
          .update(payload)
          .eq("id", supplierId);
        if (error) throw error;
        toast.success("Supplier diperbarui");
      } else {
        const { error } = await supabase
          .from("suppliers" as any)
          .insert({
            ...payload,
            store_id: currentStore.id,
            created_by: user.id,
            is_active: true,
          });
        if (error) throw error;
        toast.success("Supplier ditambahkan");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Memuat...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-card border rounded-lg px-6 py-4">
        <h2 className="text-lg font-semibold">{supplierId ? "Edit Supplier" : "Tambah Supplier"}</h2>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="text-primary hover:text-primary">
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-500 hover:bg-green-600 text-white px-6"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Rincian */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-green-600">Rincian Pelanggan</h3>

          <div>
            <Label className="text-sm">
              <span className="text-destructive">*</span> Nama Supplier
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan Nama Supplier"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm">Personal Yg Dihubungi</Label>
            <Input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Masukkan Personal Yg Dihubungi"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Contoh: olsera@gmail.com"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm">Telpon</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Masukkan angka contoh: 1234"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm">Catatan</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Masukkan Catatan"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Right: Alamat */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-green-600">Alamat</h3>

          {/* Photo */}
          <div className="border rounded-md px-4 py-3 flex items-center justify-between">
            <span className="text-sm">Foto Supplier</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-12 w-14 border rounded bg-muted/40 hover:bg-muted flex items-center justify-center overflow-hidden"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Negara</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indonesia">Indonesia</SelectItem>
                  <SelectItem value="Malaysia">Malaysia</SelectItem>
                  <SelectItem value="Singapore">Singapore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Propinsi</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pilih salah satu" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Kota</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Masukkan Kota"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm">Kode Pos</Label>
              <Input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Masukkan angka contoh: 1234"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Alamat</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Masukkan Alamat"
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}