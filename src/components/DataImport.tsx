import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

type ImportType = "rooms" | "customers" | "products" | "room_categories" | "room_variants";

const IMPORT_TEMPLATES: Record<ImportType, { columns: string[]; example: Record<string, string>[] }> = {
  rooms: {
    columns: ["name", "category"],
    example: [
      { name: "Room 1", category: "Regular" },
      { name: "Room 2", category: "VIP" },
    ],
  },
  customers: {
    columns: ["name", "phone", "email", "notes"],
    example: [
      { name: "John Doe", phone: "081234567890", email: "john@example.com", notes: "VIP customer" },
    ],
  },
  products: {
    columns: ["name", "price"],
    example: [
      { name: "Snack A", price: "10000" },
      { name: "Minuman B", price: "15000" },
    ],
  },
  room_categories: {
    columns: ["name", "description"],
    example: [
      { name: "Regular", description: "Ruangan standar" },
      { name: "VIP", description: "Ruangan VIP dengan fasilitas lengkap" },
    ],
  },
  room_variants: {
    columns: ["room_name", "variant_name", "duration", "price", "description"],
    example: [
      { room_name: "Room 1", variant_name: "1 Jam", duration: "1", price: "50000", description: "Paket 1 jam" },
      { room_name: "Room 1", variant_name: "2 Jam", duration: "2", price: "90000", description: "Paket 2 jam" },
    ],
  },
};

const IMPORT_LABELS: Record<ImportType, string> = {
  rooms: "Ruangan",
  customers: "Pelanggan",
  products: "Produk",
  room_categories: "Kategori Ruangan",
  room_variants: "Varian Ruangan",
};

export default function DataImport() {
  const { currentStore } = useStore();
  const [importType, setImportType] = useState<ImportType>("rooms");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: "" });
        
        setPreviewData(jsonData.slice(0, 10)); // Preview first 10 rows
        toast.success(`File berhasil dimuat: ${jsonData.length} baris data`);
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Gagal membaca file. Pastikan format file benar.");
        setPreviewData([]);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const downloadTemplate = () => {
    const template = IMPORT_TEMPLATES[importType];
    const ws = XLSX.utils.json_to_sheet(template.example);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template-${importType}.xlsx`);
    toast.success("Template berhasil diunduh");
  };

  const handleImport = async () => {
    if (!currentStore) {
      toast.error("Silakan pilih cabang terlebih dahulu");
      return;
    }

    if (!file || previewData.length === 0) {
      toast.error("Silakan pilih file terlebih dahulu");
      return;
    }

    setIsImporting(true);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    try {
      // Read full file data
      const reader = new FileReader();
      const fileData = await new Promise<Record<string, string>[]>((resolve, reject) => {
        reader.onload = (event) => {
          try {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: "" });
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }

      // Process based on import type
      switch (importType) {
        case "rooms":
          for (const row of fileData) {
            try {
              const { error } = await supabase.from("rooms").insert({
                name: row.name?.trim(),
                category: row.category?.trim() || "Regular",
                store_id: currentStore.id,
                status: "Aktif",
              });
              if (error) throw error;
              result.success++;
            } catch (error: any) {
              result.failed++;
              result.errors.push(`Row ${row.name}: ${error.message}`);
            }
          }
          break;

        case "customers":
          for (const row of fileData) {
            try {
              const { error } = await supabase.from("customers").insert({
                name: row.name?.trim(),
                phone: row.phone?.trim(),
                email: row.email?.trim() || null,
                notes: row.notes?.trim() || null,
                store_id: currentStore.id,
                created_by: user.id,
              });
              if (error) throw error;
              result.success++;
            } catch (error: any) {
              result.failed++;
              result.errors.push(`Row ${row.name}: ${error.message}`);
            }
          }
          break;

        case "products":
          for (const row of fileData) {
            try {
              const { error } = await supabase.from("products").insert({
                name: row.name?.trim(),
                price: parseFloat(row.price) || 0,
                store_id: currentStore.id,
                created_by: user.id,
              });
              if (error) throw error;
              result.success++;
            } catch (error: any) {
              result.failed++;
              result.errors.push(`Row ${row.name}: ${error.message}`);
            }
          }
          break;

        case "room_categories":
          for (const row of fileData) {
            try {
              const { error } = await supabase.from("room_categories").insert({
                name: row.name?.trim(),
                description: row.description?.trim() || null,
                store_id: currentStore.id,
                is_active: true,
              });
              if (error) throw error;
              result.success++;
            } catch (error: any) {
              result.failed++;
              result.errors.push(`Row ${row.name}: ${error.message}`);
            }
          }
          break;

        case "room_variants":
          // First, get all rooms for mapping
          const { data: rooms } = await supabase
            .from("rooms")
            .select("id, name")
            .eq("store_id", currentStore.id);
          
          const roomMap = new Map(rooms?.map(r => [r.name.toLowerCase(), r.id]) || []);

          for (const row of fileData) {
            try {
              const roomId = roomMap.get(row.room_name?.toLowerCase().trim());
              if (!roomId) {
                throw new Error(`Ruangan "${row.room_name}" tidak ditemukan`);
              }

              const { error } = await supabase.from("room_variants").insert({
                room_id: roomId,
                variant_name: row.variant_name?.trim(),
                duration: parseFloat(row.duration) || 1,
                price: parseFloat(row.price) || 0,
                description: row.description?.trim() || null,
                store_id: currentStore.id,
                is_active: true,
              });
              if (error) throw error;
              result.success++;
            } catch (error: any) {
              result.failed++;
              result.errors.push(`Row ${row.variant_name}: ${error.message}`);
            }
          }
          break;
      }

      setImportResult(result);
      
      if (result.success > 0) {
        toast.success(`Berhasil import ${result.success} data`);
      }
      if (result.failed > 0) {
        toast.error(`Gagal import ${result.failed} data`);
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Terjadi kesalahan saat import");
    } finally {
      setIsImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Import data dari file Excel atau CSV ke database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Import Type Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Jenis Data</Label>
              <Select value={importType} onValueChange={(v) => { setImportType(v as ImportType); resetForm(); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rooms">Ruangan</SelectItem>
                  <SelectItem value="customers">Pelanggan</SelectItem>
                  <SelectItem value="products">Produk</SelectItem>
                  <SelectItem value="room_categories">Kategori Ruangan</SelectItem>
                  <SelectItem value="room_variants">Varian Ruangan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Download Template</Label>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Template {IMPORT_LABELS[importType]}
              </Button>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File Excel/CSV</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground">
              Kolom yang diperlukan: {IMPORT_TEMPLATES[importType].columns.join(", ")}
            </p>
          </div>

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview Data (10 baris pertama)</Label>
              <div className="border rounded-lg overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewData[0]).map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.values(row).map((value, i) => (
                          <TableCell key={i}>{String(value)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>Berhasil: {importResult.success}</span>
                </div>
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span>Gagal: {importResult.failed}</span>
                  </div>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 max-h-32 overflow-auto">
                  <p className="font-medium mb-1">Error:</p>
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-sm">{err}</p>
                  ))}
                  {importResult.errors.length > 5 && (
                    <p className="text-sm">...dan {importResult.errors.length - 5} error lainnya</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || previewData.length === 0 || isImporting}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Mengimport...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import Data
                </>
              )}
            </Button>
            {(file || importResult) && (
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Panduan Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Langkah-langkah:</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Pilih jenis data yang ingin diimport</li>
              <li>Download template Excel untuk melihat format yang benar</li>
              <li>Isi data di template sesuai format</li>
              <li>Upload file yang sudah diisi</li>
              <li>Periksa preview data</li>
              <li>Klik "Import Data" untuk memulai import</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Format Kolom per Jenis Data:</h4>
            <div className="grid gap-2 text-sm">
              <div className="p-2 bg-muted rounded">
                <strong>Ruangan:</strong> name (wajib), category (opsional)
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>Pelanggan:</strong> name (wajib), phone (wajib), email, notes
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>Produk:</strong> name (wajib), price (wajib, angka)
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>Kategori Ruangan:</strong> name (wajib), description
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>Varian Ruangan:</strong> room_name (wajib, harus ada di database), variant_name, duration (jam), price
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
