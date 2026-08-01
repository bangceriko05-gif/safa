# Riwayat Perubahan (Audit Log) pada Halaman BID POS

Saat ini kartu "Log" di halaman detail order POS hanya menampilkan waktu dibuat dan waktu terakhir diperbarui. Tidak ada catatan siapa yang mengubah apa. Rencana ini menambahkan histori perubahan lengkap untuk setiap BID POS.

## Yang akan dibuat

1. **Setiap perubahan dicatat otomatis** pada halaman BID POS, mencakup:
   - Data pelanggan (nama, telepon, email, alamat)
   - Diskon order dan diskon per item
   - Item: tambah produk, ubah qty/harga, hapus item
   - Pembayaran: tambah/ubah pembayaran, metode, referensi, tanggal
   - Biaya kirim, pajak, biaya admin, pembulatan
   - Status proses (proses/selesai/batal) dan status pembayaran
   - Catatan pesanan, invoice footer, pelayan POS, jatuh tempo
   - Lampiran file (tambah/hapus)

2. **Format catatan**: menyimpan nilai lama dan nilai baru, contoh
   `Nama pelanggan: "Budi" → "Budi Santoso"`, `Diskon: Rp 0 → Rp 5.000`.

3. **Tampilan di kartu "Log"**: daftar riwayat urut terbaru di atas, tiap baris berisi
   nama pengguna, waktu (dd-MMM-yyyy HH:mm:ss), dan deskripsi perubahan.
   Baris "Waktu Pembuatan" dan "Terakhir Diperbarui" tetap ada di atas daftar.
   Jika riwayat panjang, ditampilkan 10 terbaru dengan tombol "Lihat semua".

## Detail teknis

- Menggunakan tabel `activity_logs` yang sudah ada lewat `src/utils/activityLogger.ts`,
  dengan `entity_type: "pos_order"` dan `entity_id` = id order, serta `store_id` order.
- Dibuat helper `logOrderChange(field, oldValue, newValue)` di `src/pages/PosOrderDetail.tsx`
  yang dipanggil di seluruh fungsi penyimpanan yang sudah ada
  (`saveNote`, `savePatch`, `saveItemEdit`, `applyPayment`, `saveAdjust`, hapus item,
  perubahan status, diskon, pembulatan, lampiran) dengan membandingkan nilai sebelum dan sesudah.
- Riwayat diambil dengan query `activity_logs` difilter `entity_id = order.id`
  diurutkan `created_at desc`, di-refresh setiap kali ada perubahan tersimpan.
- Catatan: aktivitas oleh Super Admin memang tidak dicatat (aturan logging yang berlaku saat ini).
- Tidak ada perubahan skema database yang diperlukan.
