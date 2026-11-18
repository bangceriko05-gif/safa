/**
 * Judul panel nota POS.
 *
 * Nomor BID langsung tampil begitu kasir memasukkan item, bahkan sebelum
 * pesanan disimpan ke server, supaya kasir dan pelanggan menyebut nomor yang
 * sama sejak awal.
 */
export function posOrderTitleBid(input: {
  itemCount: number;
  orderBid?: string | null;
  bookingBid?: string | null;
  pendingBid?: string | null;
}): string | null {
  const candidates = [
    input.orderBid,
    input.bookingBid,
    input.itemCount > 0 ? input.pendingBid : null,
  ];
  for (const value of candidates) {
    const bid = typeof value === "string" ? value.trim() : "";
    if (bid) return bid;
  }
  return null;
}

/**
 * Nomor BID bisa keburu dipakai kasir lain. Tabrakan itu dikenali dari galat
 * unique constraint supaya pesanan tetap tersimpan dengan nomor baru.
 */
export function isDuplicateBidError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null | undefined;
  if (!err) return false;
  if (err.code === "23505") return true;
  return String(err.message || "").toLowerCase().includes("duplicate key");
}
