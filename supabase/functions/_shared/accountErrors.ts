export function accountError(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { message?: unknown; code?: unknown } : {};
  const message = typeof error === 'string' ? error : String(details.message ?? '');
  const text = `${details.code ?? ''} ${message}`.toLowerCase();
  if (/pwned|breach|leaked|compromised|weak_password|known to be weak/.test(text)) return 'Password ini mudah ditebak atau pernah bocor. Gunakan password lain, misalnya gabungan beberapa kata yang tidak berkaitan.';
  if (/password.*(least|minimum|minimal|short|characters)/.test(text)) {
    const minimum = message.match(/(?:least|minimal|minimum)\s+(\d+)/i)?.[1];
    return minimum ? `Password terlalu pendek. Gunakan minimal ${minimum} karakter.` : 'Password terlalu pendek. Tambahkan beberapa karakter, lalu coba lagi.';
  }
  if (/password.*(contain|include|required|strength)/.test(text)) return 'Password belum memenuhi syarat keamanan. Tambahkan huruf besar, huruf kecil, angka, atau simbol, lalu coba lagi.';
  if (/sudah memiliki akses/.test(text)) return 'Pengguna dengan email ini sudah memiliki akses ke outlet ini.';
  if (/email_exists|already.*registered|email.*sudah terdaftar/.test(text)) return 'Email sudah terdaftar. Periksa daftar pengguna atau gunakan email lain.';
  if (/invalid.*email|email.*invalid/.test(text)) return 'Alamat email tidak valid. Periksa penulisannya, lalu coba lagi.';
  if (/authorization|invalid token|jwt/.test(text)) return 'Sesi Anda sudah berakhir. Silakan masuk kembali, lalu ulangi proses ini.';
  if (/permission|only admins|leaders cannot|not allowed/.test(text)) return 'Anda tidak memiliki izin untuk tindakan ini. Hubungi admin untuk meminta akses.';
  if (/missing required fields/.test(text)) return 'Data belum lengkap. Isi semua kolom wajib, lalu coba lagi.';
  if (/store id is required/.test(text)) return 'Pilih outlet terlebih dahulu, lalu coba lagi.';
  return 'Perubahan akun belum berhasil. Silakan coba lagi. Jika masih gagal, hubungi admin.';
}