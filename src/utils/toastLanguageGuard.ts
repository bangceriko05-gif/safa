import { toast } from "sonner";
import { userFacingError } from "@/utils/userFacingError";

// Pesan teknis (database, kode program, bahasa Inggris dari layanan) tidak boleh tampil ke pengguna.
const TECHNICAL = /violates|constraint|foreign key|duplicate key|null value|column|relation|syntax|schema|postgres|supabase|sqlstate|jwt|token|undefined|null\b|exception|stack|typeerror|referenceerror|failed to|unexpected|invalid input|cannot|could not|not found|permission denied|row.level|network ?error|fetch|status code|\b[45]\d\d\b|\{|\}|_fkey|_pkey|_key\b/i;
const ENGLISH = /\b(the|is|are|was|not|error|failed|please|unable|invalid|required|must|already|update|delete|insert|on table)\b/i;
const INDONESIAN = /\b(dan|yang|tidak|belum|silakan|berhasil|gagal|data|pilih|harap|sudah|untuk|ini|coba|wajib|mohon)\b/i;

export function plainIndonesian(message: string): string {
  const text = message.trim();
  if (!text) return text;
  if (/foreign key|_fkey|23503|still referenced|masih dipakai/i.test(text)) {
    return /delete|hapus/i.test(text)
      ? "Data ini belum bisa dihapus karena masih terhubung dengan transaksi lain. Hapus atau batalkan transaksi terkait terlebih dahulu."
      : "Data ini masih terhubung dengan transaksi lain sehingga belum bisa diubah.";
  }
  if (/null value|not-null|23502/i.test(text)) return "Data belum lengkap. Lengkapi kolom yang wajib diisi, lalu coba lagi.";
  if (/check constraint|23514|invalid input/i.test(text)) return "Isian belum sesuai. Periksa kembali data yang dimasukkan.";
  const technical = TECHNICAL.test(text) || (ENGLISH.test(text) && !INDONESIAN.test(text));
  return technical ? userFacingError(text) : text;
}

type Fn = (message: any, data?: any) => any;
const wrap = (fn: Fn): Fn => (message, data) => {
  const safeMessage = typeof message === "string" ? plainIndonesian(message) : message;
  const safeData = data && typeof data.description === "string" ? { ...data, description: plainIndonesian(data.description) } : data;
  return fn(safeMessage, safeData);
};

let installed = false;
export function installToastLanguageGuard() {
  if (installed) return;
  installed = true;
  const target = toast as unknown as Record<string, Fn>;
  for (const key of ["error", "warning", "info", "message", "success"]) {
    if (typeof target[key] === "function") target[key] = wrap(target[key].bind(toast));
  }
}
