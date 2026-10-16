const DEFAULT_MESSAGE = "Proses belum berhasil. Silakan coba lagi. Jika masih gagal, hubungi admin.";

/** Never display a raw service exception to the user. */
export function userFacingError(error: unknown, fallback = DEFAULT_MESSAGE): string {
  const details = typeof error === "string" ? { message: error } :
    error && typeof error === "object" ? error as { message?: unknown; code?: unknown; error?: unknown } : {};
  const message = String(details.error ?? details.message ?? "");
  if (/^(Password ini mudah ditebak atau pernah bocor\.|Password terlalu pendek\.|Password belum memenuhi syarat keamanan\.|Sesi Anda sudah berakhir\.|Anda tidak memiliki izin\.|Data belum lengkap\.|Pilih outlet terlebih dahulu\.|Perubahan akun belum berhasil\.)/.test(message)) return message;
  const text = `${details.code ?? ""} ${message}`.toLowerCase();
  if (/pwned|breach|leaked|compromised|weak_password|known to be weak|mudah ditebak|pernah bocor/.test(text)) {
    return "Password ini mudah ditebak atau pernah bocor. Gunakan password lain, misalnya gabungan beberapa kata yang tidak berkaitan.";
  }
  if (/password.*(least|minimum|minimal|short|characters)|password_too_short/.test(text)) {
    const minimum = message.match(/(?:least|minimal|minimum)\s+(\d+)/i)?.[1];
    return minimum ? `Password terlalu pendek. Gunakan minimal ${minimum} karakter.` : "Password terlalu pendek. Tambahkan beberapa karakter, lalu coba lagi.";
  }
  if (/password.*(required|contain|include|strength|character)|password.*kombinasi/.test(text)) {
    return "Password belum memenuhi syarat keamanan. Tambahkan huruf besar, huruf kecil, angka, atau simbol, lalu coba lagi.";
  }
  if (/sudah memiliki akses/.test(text)) return "Pengguna dengan email ini sudah memiliki akses ke outlet ini.";
  if (/email_exists|already.*registered|email.*sudah terdaftar|duplicate key|23505/.test(text)) return "Email atau data ini sudah terdaftar. Periksa pengguna yang sudah ada sebelum menambahkan lagi.";
  if (/invalid login credentials/.test(text)) return "Email atau password salah. Periksa kembali keduanya.";
  if (/email.*not confirmed/.test(text)) return "Email belum dikonfirmasi. Buka email konfirmasi sebelum masuk.";
  if (/invalid.*email|email.*invalid/.test(text)) return "Alamat email tidak valid. Periksa penulisannya, lalu coba lagi.";
  if (/not authenticated|authorization|invalid token|jwt|session.*expired/.test(text)) return "Sesi Anda sudah berakhir. Silakan masuk kembali, lalu ulangi proses ini.";
  if (/permission|not allowed|forbidden|leaders cannot|only admins|row.level security|42501/.test(text)) return "Anda tidak memiliki izin untuk tindakan ini. Hubungi admin untuk meminta akses.";
  if (/fetch|network|connection|relay/.test(text)) return "Tidak dapat terhubung. Periksa koneksi internet Anda, lalu coba lagi.";
  if (/rate.limit|too many requests/.test(text)) return "Terlalu banyak percobaan. Tunggu beberapa saat, lalu coba lagi.";
  // Only known, reviewed application messages may pass through unchanged.
  if (message === "Pilih toko terlebih dahulu") return "Pilih outlet terlebih dahulu, lalu coba lagi.";
  return fallback;
}

export async function functionErrorMessage(error: unknown, data?: unknown, fallback?: string): Promise<string> {
  if (data && typeof data === "object" && "error" in data) {
    return userFacingError(data, fallback);
  }
  const context = error && typeof error === "object" && "context" in error ? error.context : undefined;
  if (context instanceof Response) {
    try { return userFacingError(await context.clone().json(), fallback); } catch { /* Use safe fallback. */ }
  } else if (typeof context === "string") {
    try { return userFacingError(JSON.parse(context), fallback); } catch { /* Use safe fallback. */ }
  }
  return userFacingError(error, fallback);
}