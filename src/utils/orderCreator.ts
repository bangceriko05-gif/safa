/** Nama pembuat transaksi yang ditampilkan di kartu transaksi, mis. "Dibuat oleh: fauzan". */
export function creatorDisplayName(
  profile: { name?: string | null; email?: string | null } | null | undefined,
): string {
  const name = profile?.name?.trim();
  if (name) return name;
  const email = profile?.email?.trim();
  if (email && email.includes("@")) return email.split("@")[0];
  return "Petugas";
}
